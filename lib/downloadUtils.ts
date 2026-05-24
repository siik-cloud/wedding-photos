/**
 * Bulk download utilities.
 *
 * The `download` HTML attribute is silently ignored for cross-origin URLs in
 * Chrome/Edge — the browser previews the file instead of saving it.
 * To force a real download we fetch the file as a Blob first, create a
 * same-origin object URL from it, and trigger the anchor click from there.
 * Blob URLs ARE same-origin, so the `download` attribute is honoured.
 *
 * Supabase Storage returns permissive CORS headers (Access-Control-Allow-Origin: *)
 * so `fetch()` works from any front-end origin.
 */

// ─── Mobile detection ────────────────────────────────────────────────────────

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
 *
 * Returns:
 *   "shared"        — share sheet opened (user may still cancel inside it)
 *   "cancelled"     — user dismissed the sheet
 *   "not-supported" — browser doesn't support file sharing
 *   "error"         — network or unexpected error
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

// ─── Download state ───────────────────────────────────────────────────────────

export type DownloadState = "idle" | "preparing" | "downloading" | "done";

/**
 * Downloads a single file via Blob and triggers a native save dialog.
 *
 * If the Blob fetch fails (e.g. very large video exhausting available memory,
 * or a transient network error) the file is opened in a new tab so the user
 * can still save it manually.  The caller page is never navigated away from.
 *
 * Returns `true` when the Blob path succeeded, `false` when the new-tab
 * fallback was used instead.
 */
export async function downloadSingleFile(url: string, filename: string): Promise<boolean> {
  const ok = await downloadFileAsBlob(url, filename);
  if (!ok) {
    // Fallback: open in a new tab — user can long-press / right-click → Save
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return ok;
}

export interface DownloadProgress {
  current: number;
  total: number;
}

/**
 * Fetches one file as a Blob and triggers a native save-file dialog.
 * Returns `true` on success, `false` on any network / browser error.
 */
export async function downloadFileAsBlob(
  url: string,
  filename: string
): Promise<boolean> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return false;

    const blob   = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
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
 * Downloads a list of files sequentially, with `delayMs` between each one.
 * Calls `onProgress(current, total)` before each download starts.
 * Returns the subset of files whose download failed.
 */
export async function downloadFilesSequentially<
  T extends { downloadUrl: string; original_file_name: string }
>(
  files: T[],
  delayMs: number,
  onProgress: (current: number, total: number) => void
): Promise<T[]> {
  const failed: T[] = [];

  for (let i = 0; i < files.length; i++) {
    onProgress(i + 1, files.length);
    const ok = await downloadFileAsBlob(files[i].downloadUrl, files[i].original_file_name);
    if (!ok) failed.push(files[i]);

    if (i < files.length - 1) {
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }

  return failed;
}
