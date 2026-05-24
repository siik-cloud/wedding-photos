/**
 * Download utilities for single files and ZIP bundles.
 *
 * Single files
 * ─────────────
 * `downloadFileAsBlob` — fetch → Blob → same-origin object URL → anchor click.
 * The `download` attribute is silently ignored for cross-origin URLs in Chrome/Edge
 * but IS honoured for blob: URLs (always same-origin), so this is required to force
 * the browser to save rather than preview.
 *
 * `downloadSingleFile` — wraps `downloadFileAsBlob` and falls back to `window.open`
 * only for the fallback link buttons in the UI (user-initiated, last-resort).
 * The primary action buttons call `downloadFileAsBlob` directly to avoid ever
 * opening the raw Supabase URL.
 *
 * ZIP bundles
 * ─────────────
 * Sequential programmatic anchor clicks are blocked by every major browser after the
 * first one (popup-blocker heuristic).  Packing selected files into a single ZIP and
 * triggering one download is the only reliable cross-browser solution.
 *
 * JSZip is loaded dynamically so it stays out of the initial bundle.
 */

// ─── Mobile detection ─────────────────────────────────────────────────────────

/** Returns `true` when running on a phone or tablet. Safe in SSR (returns `false`). */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// ─── Web Share API ────────────────────────────────────────────────────────────

export type ShareResult = "shared" | "cancelled" | "not-supported" | "error";

/**
 * Fetches `url` as a Blob, constructs a File, and passes it to
 * `navigator.share()` (Web Share API Level 2).
 *
 * IMPORTANT: call this directly inside a button-click handler.
 * Modern Safari (iOS 15+) allows the intermediate `await fetch()` because the
 * entire call chain originates from a trusted user activation.
 */
export async function shareFileFromUrl(
  url: string,
  filename: string,
  mimeType: string
): Promise<ShareResult> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    return "not-supported";
  }
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return "error";
    const blob = await res.blob();
    const resolvedType = mimeType || blob.type || "application/octet-stream";
    const file = new File([blob], filename, { type: resolvedType });
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
      return "not-supported";
    }
    await navigator.share({ files: [file], title: filename });
    return "shared";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "cancelled";
    return "error";
  }
}

// ─── Download state (shared by GalleryView + AdminPanel UI) ──────────────────

export type DownloadState = "idle" | "preparing" | "downloading" | "done";

export interface DownloadProgress {
  current: number;
  total:   number;
}

// ─── Single-file blob download ────────────────────────────────────────────────

/**
 * Fetches one file as a Blob and triggers a native save-file dialog.
 * Returns `true` on success, `false` on any network / memory error.
 *
 * Use this as the PRIMARY action for download buttons — it never opens the
 * raw signed URL in a new tab.
 */
export async function downloadFileAsBlob(
  url: string,
  filename: string
): Promise<boolean> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return false;

    const blob    = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a    = document.createElement("a");
    a.href     = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Keep the element in DOM briefly so the click isn't lost
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 400);

    return true;
  } catch {
    return false;
  }
}

/**
 * Same as `downloadFileAsBlob` but falls back to `window.open` when the Blob
 * path fails (e.g. very large video, memory exhaustion).
 *
 * Use only for FALLBACK LINK BUTTONS in the UI (user explicitly clicked a link
 * after a bulk-download error).  Do NOT use for primary action buttons.
 */
export async function downloadSingleFile(url: string, filename: string): Promise<boolean> {
  const ok = await downloadFileAsBlob(url, filename);
  if (!ok) {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return ok;
}

// ─── ZIP bulk download ────────────────────────────────────────────────────────

/** ZIP download filename shown to the user. */
export const ZIP_FILENAME = "katka-simon-fotky.zip";

/** Desktop: warn when total selection exceeds this before zipping. */
export const DESKTOP_ZIP_WARN_BYTES = 500 * 1024 * 1024;   // 500 MB

/** Mobile: refuse ZIP when total exceeds this. */
export const MOBILE_ZIP_MAX_BYTES = 100 * 1024 * 1024;     // 100 MB

/** Mobile: refuse ZIP when file count exceeds this. */
export const MOBILE_ZIP_MAX_FILES = 30;

export type ZipPhase = "fetching" | "generating";

export interface ZipProgress {
  phase:   ZipPhase;
  /** How many files have been fetched so far (fetching phase) or total (generating). */
  current: number;
  total:   number;
}

/** Appends ` (1)`, ` (2)`, … to prevent silent overwrites inside the ZIP. */
function makeUniqueFilename(name: string, seen: Set<string>): string {
  if (!seen.has(name)) { seen.add(name); return name; }
  const dot  = name.lastIndexOf(".");
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext  = dot >= 0 ? name.slice(dot)    : "";
  let i = 1;
  let candidate: string;
  do { candidate = `${base} (${i++})${ext}`; } while (seen.has(candidate));
  seen.add(candidate);
  return candidate;
}

/**
 * Fetches every file, packs them into a ZIP, and triggers one download.
 * Files that fail to fetch are skipped and returned in `failedFiles`.
 * Progress callbacks fire before each fetch and before ZIP generation.
 */
export async function downloadAsZip<
  T extends { downloadUrl: string; original_file_name: string }
>(
  files:      T[],
  zipName:    string,
  onProgress: (p: ZipProgress) => void
): Promise<{ added: number; failed: number; failedFiles: T[] }> {
  // Dynamic import keeps JSZip (~100 KB) out of the initial page bundle.
  const JSZip = (await import("jszip")).default;
  const zip   = new JSZip();
  const seen  = new Set<string>();
  let added   = 0;
  const failedFiles: T[] = [];

  // Phase 1 — fetch each file and add to ZIP
  for (let i = 0; i < files.length; i++) {
    onProgress({ phase: "fetching", current: i + 1, total: files.length });
    const f = files[i];
    try {
      const res = await fetch(f.downloadUrl, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      zip.file(makeUniqueFilename(f.original_file_name, seen), blob);
      added++;
    } catch {
      failedFiles.push(f);
    }
  }

  // Phase 2 — compress and trigger one download
  onProgress({ phase: "generating", current: files.length, total: files.length });
  const zipBlob = await zip.generateAsync({ type: "blob" });

  const blobUrl = URL.createObjectURL(zipBlob);
  const a       = document.createElement("a");
  a.href        = blobUrl;
  a.download    = zipName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(blobUrl); }, 400);

  return { added, failed: failedFiles.length, failedFiles };
}
