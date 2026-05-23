"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  ChangeEvent,
  DragEvent,
} from "react";
import {
  Upload,
  CheckCircle,
  XCircle,
  Loader2,
  ImageIcon,
  Video,
  RotateCcw,
  Camera,
  Trash2,
  SkipForward,
} from "lucide-react";
import Link from "next/link";
import { createId } from "@/lib/utils";
import { compressImage, isCompressible } from "@/lib/imageCompression";

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".heic", ".heif",
  ".mp4", ".mov", ".avi", ".mkv", ".webm",
];
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i;

const MAX_IMAGE_SIZE  = 25  * 1024 * 1024; // 25 MB
const MAX_VIDEO_SIZE  = 250 * 1024 * 1024; // 250 MB
const MAX_FILES       = 30;
const CONCURRENT      = 2;                 // gentle on slow connections
const RESUME_KEY      = "wedding_upload_queue";
const RESUME_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Types ────────────────────────────────────────────────────────────────────

type FileStatus = "pending" | "compressing" | "uploading" | "done" | "error" | "skipped";

interface FileItem {
  id: string;
  file: File;
  isVideo: boolean;
  status: FileStatus;
  progress: number;
  errorMsg?: string;
  previewUrl?: string;
  isDuplicate?: boolean;
}

interface Rejected {
  name: string;
  reason: string;
}

interface ResumeData {
  guestName: string;
  fileCount: number;
  fileNames: string[];
  startedAt: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function detectKind(file: File): "image" | "video" | "unknown" {
  if (file.type.startsWith("video/") || VIDEO_EXT.test(file.name)) return "video";
  if (file.type.startsWith("image/") || IMAGE_EXT.test(file.name)) return "image";
  return "unknown";
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function plural(n: number): string {
  if (n === 1) return "súbor";
  if (n >= 2 && n <= 4) return "súbory";
  return "súborov";
}

function validateFile(file: File): { ok: boolean; reason?: string } {
  const kind = detectKind(file);
  if (kind === "unknown")
    return { ok: false, reason: "Nepodporovaný formát (akceptujeme fotky a videá)" };
  const max = kind === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > max)
    return { ok: false, reason: `Súbor je príliš veľký (max ${kind === "video" ? "250 MB" : "25 MB"})` };
  return { ok: true };
}

function saveResumeData(guestName: string, files: FileItem[]) {
  try {
    const data: ResumeData = {
      guestName,
      fileCount: files.length,
      fileNames: files.map((f) => f.file.name),
      startedAt: Date.now(),
    };
    localStorage.setItem(RESUME_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable; silently skip
  }
}

function clearResumeData() {
  try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
}

function loadResumeData(): ResumeData | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ResumeData;
    if (Date.now() - data.startedAt > RESUME_STALE_MS) {
      localStorage.removeItem(RESUME_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// ─── Status label ─────────────────────────────────────────────────────────────

function statusLabel(item: FileItem): string {
  switch (item.status) {
    case "pending":     return "Čaká";
    case "compressing": return "Pripravujem...";
    case "uploading":   return `${item.progress}%`;
    case "done":        return item.isDuplicate ? "Preskočené" : "Nahraté";
    case "skipped":     return "Preskočené";
    case "error":       return "Nepodarilo sa nahrať";
  }
}

function statusColor(status: FileStatus): string {
  switch (status) {
    case "done":        return "text-green-600";
    case "skipped":     return "text-amber-500";
    case "error":       return "text-red-500";
    case "uploading":
    case "compressing": return "text-sage-600";
    default:            return "text-gray-400";
  }
}

// ─── FileRow sub-component ────────────────────────────────────────────────────

function FileRow({
  item,
  onRemove,
  canRemove,
}: {
  item: FileItem;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const busy = item.status === "compressing" || item.status === "uploading";
  const isSkipped = item.isDuplicate || item.status === "skipped";

  return (
    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
      {/* Thumbnail / icon */}
      <div className="w-11 h-11 rounded-lg bg-white border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
        ) : item.isVideo ? (
          <Video className="w-5 h-5 text-blue-400" />
        ) : (
          <ImageIcon className="w-5 h-5 text-sage-400" />
        )}
      </div>

      {/* Name + size + progress */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate leading-tight">
          {item.file.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{fmtSize(item.file.size)}</p>

        {/* Upload progress bar */}
        {item.status === "uploading" && (
          <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sage-400 rounded-full transition-all duration-200"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}

        {/* Compression shimmer */}
        {item.status === "compressing" && (
          <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-amber-300 rounded-full animate-pulse" />
          </div>
        )}

        {/* Duplicate notice */}
        {isSkipped && (
          <p className="text-xs text-amber-600 mt-0.5 leading-tight">
            Tento súbor bol nahratý nedávno
          </p>
        )}

        {/* Error detail */}
        {item.status === "error" && item.errorMsg && (
          <p className="text-xs text-red-500 mt-0.5 leading-tight">{item.errorMsg}</p>
        )}
      </div>

      {/* Status badge + icon / remove button */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1 min-w-[80px] text-right">
        <span className={`text-xs font-semibold ${statusColor(item.status)}`}>
          {statusLabel(item)}
        </span>
        {item.status === "done" && !isSkipped && <CheckCircle className="w-4 h-4 text-green-500" />}
        {isSkipped              && <SkipForward  className="w-4 h-4 text-amber-400" />}
        {item.status === "error" && <XCircle     className="w-4 h-4 text-red-400" />}
        {busy                    && <Loader2     className="w-4 h-4 text-sage-400 animate-spin" />}
        {item.status === "pending" && canRemove && (
          <button
            onClick={onRemove}
            aria-label="Odstrániť súbor"
            className="text-gray-300 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Resume banner ────────────────────────────────────────────────────────────

function ResumeBanner({
  data,
  onResume,
  onDismiss,
}: {
  data: ResumeData;
  onResume: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <p className="text-sm font-semibold text-amber-800 mb-1">
        ⚠️ Našli sme nedokončené nahrávanie
      </p>
      <p className="text-sm text-amber-700 leading-relaxed mb-3">
        {data.fileCount} {plural(data.fileCount)} · {data.guestName || "bez mena"}
        <br />
        <span className="text-xs text-amber-500">
          Spustené pred {Math.round((Date.now() - data.startedAt) / 60000)} min
        </span>
      </p>
      <div className="flex gap-2">
        <button
          onClick={onResume}
          className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold
                     hover:bg-amber-600 transition-colors"
        >
          Pokračovať
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 py-2.5 border border-amber-300 text-amber-700 rounded-xl
                     text-sm font-semibold hover:bg-amber-100 transition-colors"
        >
          Začať odznova
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UploadForm() {
  const [guestName, setGuestName]       = useState("");
  const [items, setItems]               = useState<FileItem[]>([]);
  const [rejected, setRejected]         = useState<Rejected[]>([]);
  const [isUploading, setIsUploading]   = useState(false);
  const [isDragOver, setIsDragOver]     = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [resumeData, setResumeData]     = useState<ResumeData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false); // sync guard against double-tap

  // ── Check for interrupted upload on mount ────────────────────────────────
  useEffect(() => {
    const data = loadResumeData();
    if (data) setResumeData(data);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const updateItem = useCallback((id: string, patch: Partial<FileItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  // ── Resume handlers ──────────────────────────────────────────────────────

  const handleResume = () => {
    if (resumeData) setGuestName(resumeData.guestName);
    setResumeData(null);
    clearResumeData();
    // User re-selects files manually; we just pre-fill the name
    fileInputRef.current?.click();
  };

  const handleDismissResume = () => {
    setResumeData(null);
    clearResumeData();
  };

  // ── Adding files ─────────────────────────────────────────────────────────

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const valid: FileItem[] = [];
      const bad: Rejected[]   = [];

      for (const file of newFiles) {
        if (items.length + valid.length >= MAX_FILES) {
          bad.push({ name: file.name, reason: `Max ${MAX_FILES} súborov naraz` });
          continue;
        }

        const { ok, reason } = validateFile(file);
        if (!ok) { bad.push({ name: file.name, reason: reason! }); continue; }

        // Skip client-side duplicates (same name + size already in the list)
        const dup = items.some((i) => i.file.name === file.name && i.file.size === file.size);
        if (dup) continue;

        const isVideo = detectKind(file) === "video";
        let previewUrl: string | undefined;
        if (!isVideo && file.size < 8 * 1024 * 1024)
          previewUrl = URL.createObjectURL(file);

        valid.push({
          id: createId(),
          file,
          isVideo,
          status: "pending",
          progress: 0,
          previewUrl,
        });
      }

      if (valid.length > 0) setItems((prev) => [...prev, ...valid]);
      if (bad.length  > 0) setRejected((prev) => [...prev, ...bad]);
    },
    [items]
  );

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = ""; }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  // ── Upload a single file ──────────────────────────────────────────────────

  const uploadOne = async (item: FileItem, name: string): Promise<boolean> => {
    let toUpload = item.file;

    // ── Compression phase (images only) ──────────────────────────────────
    if (isCompressible(item.file)) {
      updateItem(item.id, { status: "compressing", progress: 0, errorMsg: undefined });
      try {
        toUpload = await compressImage(item.file);
      } catch {
        toUpload = item.file; // always fall back to original
      }
    }

    // ── Upload phase ──────────────────────────────────────────────────────
    updateItem(item.id, { status: "uploading", progress: 0, errorMsg: undefined });

    try {
      // 1. Request a signed upload URL from our server
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: toUpload.name,
          fileSize: toUpload.size,
          mimeType: toUpload.type || "application/octet-stream",
          guestName: name || null,
        }),
      });

      // Handle server-side duplicate detection (409)
      if (initRes.status === 409) {
        const body = await initRes.json().catch(() => ({})) as { isDuplicate?: boolean };
        if (body.isDuplicate) {
          updateItem(item.id, { status: "done", progress: 100, isDuplicate: true });
          return true; // treat as success for progress counting
        }
      }

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Chyba pri príprave nahrávania"
        );
      }

      const { signedUrl, storagePath } = (await initRes.json()) as {
        signedUrl: string;
        storagePath: string;
      };

      // 2. Upload directly to Supabase via XHR (enables progress events)
      //    File never passes through Vercel — bypasses the 4.5 MB limit.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            // Reserve last 5 % for the confirm step
            const pct = Math.min(94, Math.round((e.loaded / e.total) * 95));
            updateItem(item.id, { progress: pct });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Chyba servera (HTTP ${xhr.status})`));
        });
        xhr.addEventListener("error", () =>
          reject(new Error("Chyba siete — skontroluj pripojenie"))
        );
        xhr.addEventListener("abort", () =>
          reject(new Error("Nahrávanie bolo prerušené"))
        );

        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", toUpload.type || "application/octet-stream");
        xhr.send(toUpload);
      });

      // 3. Record the upload in the database
      const confirmRes = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          originalFileName: item.file.name, // always the original name
          fileSize: toUpload.size,
          mimeType: toUpload.type || "application/octet-stream",
          guestName: name || null,
        }),
      });

      if (!confirmRes.ok) {
        // Non-critical: file is in storage but might not appear in gallery.
        console.warn("[upload] DB confirm failed for", storagePath);
      }

      updateItem(item.id, { status: "done", progress: 100 });
      return true;
    } catch (err) {
      updateItem(item.id, {
        status: "error",
        errorMsg: err instanceof Error ? err.message : "Neznáma chyba — skús znova",
      });
      return false;
    }
  };

  // ── Start uploading all pending / failed items ────────────────────────────

  const startUpload = async (overrideItems?: FileItem[]) => {
    if (uploadingRef.current) return; // prevent double-tap
    uploadingRef.current = true;
    setIsUploading(true);

    const source     = overrideItems ?? items;
    const uploadable = source.filter((i) => i.status === "pending" || i.status === "error");
    const name       = guestName.trim();

    // Persist resume data before starting
    saveResumeData(name, source);

    let successes = 0;

    for (let i = 0; i < uploadable.length; i += CONCURRENT) {
      const batch   = uploadable.slice(i, i + CONCURRENT);
      const results = await Promise.all(batch.map((item) => uploadOne(item, name)));
      successes    += results.filter(Boolean).length;
    }

    uploadingRef.current = false;
    setIsUploading(false);

    // If every item finished (done/skipped) → clear resume + show thank-you screen
    setItems((current) => {
      const allDone = current.every((i) => i.status === "done" || i.status === "skipped");
      if (allDone) {
        clearResumeData();
        setSuccessCount(successes);
        setShowSuccess(true);
      }
      return current;
    });
  };

  // ── Retry failed files ────────────────────────────────────────────────────

  const retryFailed = () => {
    if (uploadingRef.current) return;
    const reset = items.map((i) =>
      i.status === "error"
        ? { ...i, status: "pending" as FileStatus, progress: 0, errorMsg: undefined }
        : i
    );
    setItems(reset);
    // Pass reset list directly so we don't race with React's async state flush
    startUpload(reset);
  };

  // ── After success ─────────────────────────────────────────────────────────

  const handleUploadMore = () => {
    items.forEach((i) => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
    setItems([]);
    setRejected([]);
    setGuestName("");
    setShowSuccess(false);
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const doneCount      = items.filter((i) => i.status === "done" || i.status === "skipped").length;
  const errorCount     = items.filter((i) => i.status === "error").length;
  const hasUploadable  = items.some((i) => i.status === "pending" || i.status === "error");
  const anyCompressing = items.some((i) => i.status === "compressing");

  // ── Success screen ────────────────────────────────────────────────────────

  if (showSuccess) {
    return (
      <div className="text-center py-8 px-2">
        <div className="text-5xl mb-4">💚</div>

        <h2 className="text-2xl font-bold text-sage-700 leading-snug mb-3">
          Ďakujeme, že si nám zachytil/a
          <br />
          kúsok nášho dňa&nbsp;💚
        </h2>

        <p className="text-gray-600 leading-relaxed mb-1">
          Fotky a videá sú nahraté.
          <br />
          Galériu sprístupníme po svadbe.
        </p>
        <p className="text-sm text-gray-400 mb-8">
          ({successCount} {plural(successCount)} nahratých)
        </p>

        {/* Gallery CTA */}
        <div className="bg-sage-50 border border-sage-200 rounded-2xl p-5 mb-5">
          <p className="text-sm font-semibold text-sage-700 mb-3">
            Galériu nájdeš tu:
          </p>
          <Link
            href="/gallery"
            className="block w-full py-4 bg-sage-500 text-white rounded-2xl
                       font-bold text-lg text-center hover:bg-sage-600 transition-colors"
          >
            Otvoriť galériu
          </Link>
        </div>

        <button
          onClick={handleUploadMore}
          className="text-sage-600 hover:text-sage-700 underline text-sm"
        >
          Nahrať ďalšie fotky
        </button>
      </div>
    );
  }

  // ── Main upload form ──────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Resume banner */}
      {resumeData && items.length === 0 && (
        <ResumeBanner
          data={resumeData}
          onResume={handleResume}
          onDismiss={handleDismissResume}
        />
      )}

      {/* Guest name */}
      <input
        type="text"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        placeholder="Tvoje meno / prezývka (voliteľné)"
        disabled={isUploading}
        maxLength={100}
        className="w-full px-4 py-4 border border-gray-200 rounded-2xl text-base
                   focus:outline-none focus:ring-2 focus:ring-sage-300 focus:border-transparent
                   disabled:opacity-60 disabled:cursor-not-allowed
                   placeholder-gray-300 text-gray-800 bg-white"
      />

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Vybrať fotky alebo videá"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isUploading) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={[
          "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer",
          "transition-all duration-150 select-none",
          isDragOver
            ? "border-sage-400 bg-sage-50 scale-[1.01]"
            : "border-gray-200 hover:border-sage-300 hover:bg-gray-50",
          isUploading ? "cursor-not-allowed opacity-50 pointer-events-none" : "",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleFileInput}
          className="hidden"
          disabled={isUploading}
        />
        <Camera className="w-12 h-12 text-sage-300 mx-auto mb-3" />
        <p className="text-lg font-bold text-gray-700 mb-1">
          {isDragOver ? "Pusti fotky sem 👇" : "Vybrať fotky a videá"}
        </p>
        <p className="text-sm text-gray-400 leading-relaxed">
          Klikni alebo presuň sem
          <br />
          Fotky max 25&nbsp;MB · Videá max 250&nbsp;MB · Max {MAX_FILES} naraz
        </p>
      </div>

      {/* Instructions (shown when nothing is selected yet) */}
      {items.length === 0 && !resumeData && (
        <div className="bg-sage-50 rounded-2xl px-5 py-4 text-sm text-sage-700 text-center leading-relaxed">
          Vyber fotky alebo videá z telefónu.
          Počkaj, kým sa nahrávanie dokončí.
          Hotovo.
        </div>
      )}

      {/* Rejected files */}
      {rejected.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-orange-700 mb-1.5">
            Niektoré súbory neboli pridané:
          </p>
          <ul className="text-sm text-orange-600 space-y-1">
            {rejected.map((r, i) => (
              <li key={i}>
                •&nbsp;<strong>{r.name}</strong>: {r.reason}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setRejected([])}
            className="text-xs text-orange-400 hover:text-orange-600 mt-2 transition-colors"
          >
            Zavrieť
          </button>
        </div>
      )}

      {/* Compression notice */}
      {anyCompressing && (
        <div className="flex items-center gap-2 text-sm text-amber-700
                        bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Pripravujem fotky…</span>
        </div>
      )}

      {/* Upload-in-progress warning */}
      {isUploading && (
        <div className="flex items-start gap-2 text-sm text-sage-700
                        bg-sage-50 border border-sage-200 rounded-xl px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 mt-0.5" />
          <span>
            <strong>Prosíme, nezatváraj túto stránku</strong> počas nahrávania.
            {doneCount > 0 && (
              <span className="text-sage-500 ml-1">
                ({doneCount}/{items.length})
              </span>
            )}
          </span>
        </div>
      )}

      {/* File list */}
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-600">
              Vybrané ({items.length})
              {doneCount > 0 && doneCount < items.length && (
                <span className="text-sage-500 ml-1">· {doneCount} hotových</span>
              )}
            </p>
            {!isUploading && (
              <button
                onClick={() => {
                  items.forEach((i) => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
                  setItems([]);
                }}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                Odstrániť všetky
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto gallery-scroll pr-1">
            {items.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
                canRemove={!isUploading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Primary upload button */}
      {items.length > 0 && (
        <button
          onClick={() => startUpload()}
          disabled={isUploading || !hasUploadable}
          className={[
            "w-full py-5 rounded-2xl text-lg font-bold transition-all",
            "flex items-center justify-center gap-2",
            isUploading || !hasUploadable
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-sage-500 text-white hover:bg-sage-600 active:scale-[0.98] shadow-lg shadow-sage-200",
          ].join(" ")}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {anyCompressing ? "Pripravujem fotky…" : "Nahrávanie…"}
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Nahrať {items.length} {plural(items.length)}
            </>
          )}
        </button>
      )}

      {/* Retry button */}
      {!isUploading && errorCount > 0 && (
        <button
          onClick={retryFailed}
          className="w-full py-4 border-2 border-orange-300 text-orange-600 rounded-2xl
                     hover:bg-orange-50 transition-colors font-semibold
                     flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Skúsiť znova ({errorCount} {plural(errorCount)})
        </button>
      )}
    </div>
  );
}
