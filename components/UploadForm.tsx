"use client";

import React, {
  useState, useRef, useCallback, useEffect,
  ChangeEvent, DragEvent,
} from "react";
import {
  Upload, CheckCircle, XCircle, Loader2, ImageIcon, Video,
  RotateCcw, Camera, Trash2, SkipForward, AlertCircle, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { createId } from "@/lib/utils";
import { compressImage, isCompressible } from "@/lib/imageCompression";
import { generateVideoThumbnail } from "@/lib/videoThumbnail";
import { generateImageThumbnail } from "@/lib/imageThumbnail";

const ACCEPTED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".heic", ".heif",
  ".mp4", ".mov", ".avi", ".mkv", ".webm",
];
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i;
const MAX_IMAGE_SIZE  = 25  * 1024 * 1024;
const MAX_VIDEO_SIZE  = 250 * 1024 * 1024;
const MAX_FILES       = 30;
const CONCURRENT      = 2;
const RESUME_KEY      = "wedding_upload_queue";
const RESUME_STALE_MS = 2 * 60 * 60 * 1000;

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

interface Rejected { name: string; reason: string; }

interface ResumeData {
  guestName: string;
  fileCount: number;
  fileNames: string[];
  startedAt: number;
}

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

/** Returns true for HEIC/HEIF files — most browsers can't render them in <img>. */
function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

/** Maps XHR HTTP status codes from the storage PUT to human-readable Slovak messages. */
function xhrStatusMessage(status: number): string {
  if (status === 400) return "Neplatný súbor — skús znova";
  if (status === 403) return "Nahrávacie povolenie vypršalo — začni odznova";
  if (status === 413) return "Súbor je príliš veľký pre server";
  if (status === 507) return "Úložisko je plné — kontaktuj organizátora";
  return `Chyba pri nahrávaní (${status})`;
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
      guestName, fileCount: files.length,
      fileNames: files.map((f) => f.file.name),
      startedAt: Date.now(),
    };
    localStorage.setItem(RESUME_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function clearResumeData() { try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ } }

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
  } catch { return null; }
}

function statusLabel(item: FileItem): string {
  switch (item.status) {
    case "pending":     return "Čaká";
    case "compressing": return "Pripravujem";
    case "uploading":   return `${item.progress} %`;
    case "done":        return item.isDuplicate ? "Preskočené" : "Nahraté";
    case "skipped":     return "Preskočené";
    case "error":       return "Chyba";
  }
}

function statusColor(status: FileStatus): string {
  switch (status) {
    case "done":                      return "text-sage-700";
    case "skipped":                   return "text-amber-600";
    case "error":                     return "text-red-500";
    case "uploading": case "compressing": return "text-stone-600";
    default:                          return "text-stone-400";
  }
}

function FileRow({
  item, onRemove, canRemove,
}: {
  item: FileItem; onRemove: () => void; canRemove: boolean;
}) {
  const busy      = item.status === "compressing" || item.status === "uploading";
  const isSkipped = item.isDuplicate || item.status === "skipped";

  return (
    <div className="flex items-center gap-3 bg-stone-50 border border-stone-100 rounded-xl p-3">
      <div className="w-10 h-10 rounded-lg bg-white border border-stone-100 flex-shrink-0 overflow-hidden
                      flex items-center justify-center">
        {item.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
        ) : item.isVideo ? (
          <Video className="w-4.5 h-4.5 text-stone-400" strokeWidth={1.5} />
        ) : (
          <ImageIcon className="w-4.5 h-4.5 text-stone-400" strokeWidth={1.5} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">{item.file.name}</p>
        <p className="text-xs text-stone-400 mt-0.5">{fmtSize(item.file.size)}</p>

        {item.status === "uploading" && (
          <div className="mt-1.5 h-1 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sage-500 rounded-full transition-all duration-150"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}
        {item.status === "compressing" && (
          <div className="mt-1.5 h-1 bg-stone-200 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-amber-400 rounded-full progress-indeterminate" />
          </div>
        )}
        {isSkipped && (
          <p className="text-xs text-amber-600 mt-0.5">Súbor bol nedávno nahratý</p>
        )}
        {item.status === "error" && item.errorMsg && (
          <p className="text-xs text-red-500 mt-0.5 leading-tight">{item.errorMsg}</p>
        )}
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-1 min-w-[80px] text-right">
        <span className={`text-xs font-medium ${statusColor(item.status)}`}>
          {statusLabel(item)}
        </span>
        {item.status === "done" && !isSkipped && (
          <CheckCircle className="w-3.5 h-3.5 text-sage-600" strokeWidth={2} />
        )}
        {isSkipped  && <SkipForward className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />}
        {item.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-400" strokeWidth={1.5} />}
        {busy && <Loader2 className="w-3.5 h-3.5 text-stone-400 animate-spin" />}
        {item.status === "pending" && canRemove && (
          <button onClick={onRemove} aria-label="Odstrániť" className="text-stone-300 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  );
}

function ResumeBanner({
  data, onResume, onDismiss,
}: {
  data: ResumeData; onResume: () => void; onDismiss: () => void;
}) {
  const mins = Math.round((Date.now() - data.startedAt) / 60000);
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex gap-3">
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">Nedokončené nahrávanie</p>
          <p className="text-xs text-amber-700 mt-0.5">
            {data.fileCount} {plural(data.fileCount)} · pred {mins} min
            {data.guestName && ` · ${data.guestName}`}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onResume}
          className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold
                     hover:bg-amber-600 transition-colors"
        >
          Pokračovať
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 py-2 border border-amber-200 text-amber-700 rounded-lg text-xs
                     font-semibold hover:bg-amber-100 transition-colors"
        >
          Začať odznova
        </button>
      </div>
    </div>
  );
}

// Immediate count error — shown BEFORE any file processing
interface BatchLimitError { count: number; }

export default function UploadForm() {
  const [guestName, setGuestName]             = useState("");
  const [items, setItems]                     = useState<FileItem[]>([]);
  const [rejected, setRejected]               = useState<Rejected[]>([]);
  const [isUploading, setIsUploading]         = useState(false);
  const [isDragOver, setIsDragOver]           = useState(false);
  const [showSuccess, setShowSuccess]         = useState(false);
  const [successCount, setSuccessCount]       = useState(0);
  const [resumeData, setResumeData]           = useState<ResumeData | null>(null);
  const [batchLimitError, setBatchLimitError] = useState<BatchLimitError | null>(null);
  const [usedFirst30, setUsedFirst30]         = useState(false);
  const [isOffline, setIsOffline]             = useState(false);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const uploadingRef  = useRef(false);
  // Stores all selected files when count > MAX_FILES so "Use first 30" can access them
  const pendingAllRef = useRef<File[]>([]);

  useEffect(() => {
    const data = loadResumeData();
    if (data) setResumeData(data);
  }, []);

  // Detect loss of network connectivity so we can show an inline banner
  // rather than making users wonder why uploads are stuck.
  useEffect(() => {
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<FileItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleResume = () => {
    if (resumeData) setGuestName(resumeData.guestName);
    setResumeData(null);
    clearResumeData();
    fileInputRef.current?.click();
  };

  const handleDismissResume = () => { setResumeData(null); clearResumeData(); };

  const addFiles = useCallback((newFiles: File[]) => {
    const valid: FileItem[] = [];
    const bad: Rejected[]   = [];

    for (const file of newFiles) {
      if (items.length + valid.length >= MAX_FILES) {
        bad.push({ name: file.name, reason: `Max ${MAX_FILES} súborov naraz` });
        continue;
      }
      const { ok, reason } = validateFile(file);
      if (!ok) { bad.push({ name: file.name, reason: reason! }); continue; }

      const dup = items.some((i) => i.file.name === file.name && i.file.size === file.size);
      if (dup) continue;

      const isVideo = detectKind(file) === "video";
      // HEIC/HEIF: most browsers cannot render these in <img> elements.
      // Skip object URL creation to avoid a broken preview icon.
      const heic = isHeicFile(file);
      let previewUrl: string | undefined;
      if (!isVideo && !heic && file.size < 8 * 1024 * 1024)
        previewUrl = URL.createObjectURL(file);

      valid.push({ id: createId(), file, isVideo, status: "pending", progress: 0, previewUrl });
    }

    if (valid.length > 0) setItems((prev) => [...prev, ...valid]);
    if (bad.length  > 0) setRejected((prev) => [...prev, ...bad]);
  }, [items]);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const all = Array.from(e.target.files);
    e.target.value = ""; // clear immediately — must happen before any early return
    if (all.length === 0) return; // user cancelled the picker on some browsers
    commitFiles(all);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const all = Array.from(e.dataTransfer.files);
    commitFiles(all);
  };

  /**
   * Gate between raw file selection and addFiles().
   * Checks total count first — before ANY preview URL creation or compression.
   * If the count exceeds MAX_FILES, shows an error immediately without processing.
   */
  const commitFiles = (all: File[]) => {
    setBatchLimitError(null);
    setUsedFirst30(false);
    const incoming = items.length + all.length;
    if (incoming > MAX_FILES) {
      pendingAllRef.current = all;
      setBatchLimitError({ count: all.length });
      return;
    }
    pendingAllRef.current = [];
    addFiles(all);
  };
  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const uploadOne = async (item: FileItem, name: string): Promise<boolean> => {
    let toUpload = item.file;

    if (isCompressible(item.file)) {
      updateItem(item.id, { status: "compressing", progress: 0, errorMsg: undefined });
      try { toUpload = await compressImage(item.file); } catch { toUpload = item.file; }
    }

    updateItem(item.id, { status: "uploading", progress: 0, errorMsg: undefined });

    try {
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

      if (initRes.status === 409) {
        const body = await initRes.json().catch(() => ({})) as { isDuplicate?: boolean };
        if (body.isDuplicate) {
          updateItem(item.id, { status: "done", progress: 100, isDuplicate: true });
          return true;
        }
      }

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Chyba pri príprave nahrávania");
      }

      const { signedUrl, storagePath } = (await initRes.json()) as { signedUrl: string; storagePath: string };

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            updateItem(item.id, { progress: Math.min(94, Math.round((e.loaded / e.total) * 95)) });
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(xhrStatusMessage(xhr.status)));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Chyba siete — skontroluj pripojenie")));
        xhr.addEventListener("abort", () => reject(new Error("Nahrávanie bolo prerušené")));
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", toUpload.type || "application/octet-stream");
        xhr.send(toUpload);
      });

      // ── Thumbnail generation ───────────────────────────────────────────────
      // Generate a 600 px JPEG thumbnail from the local file before confirming.
      // For videos: Canvas is not involved; we seek the <video> element to frame 0.
      // For images: Canvas-based downscale (skips HEIC/GIF which return null).
      // Failure is non-fatal — the file uploads fine without a thumbnail.
      let thumbnailPath: string | null = null;

      if (item.isVideo) {
        try {
          updateItem(item.id, { progress: 97 }); // pause briefly at 97% while generating
          const thumb = await generateVideoThumbnail(item.file);
          if (thumb) {
            const thumbInitRes = await fetch("/api/upload/thumbnail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileSize: thumb.blob.size }),
            });
            if (thumbInitRes.ok) {
              const thumbData = await thumbInitRes.json() as {
                signedUrl: string;
                thumbnailPath: string;
              };
              const thumbPutRes = await fetch(thumbData.signedUrl, {
                method: "PUT",
                body: thumb.blob,
                headers: { "Content-Type": "image/jpeg" },
              });
              if (thumbPutRes.ok) thumbnailPath = thumbData.thumbnailPath;
            }
          }
        } catch (thumbErr) {
          console.warn("[upload] video thumbnail generation failed:", thumbErr);
        }
      } else {
        // Images: generate a 600 px JPEG thumbnail for fast grid display.
        // Returns null for HEIC/HEIF and GIF — those are skipped gracefully.
        try {
          updateItem(item.id, { progress: 97 });
          const thumb = await generateImageThumbnail(toUpload);
          if (thumb) {
            const thumbInitRes = await fetch("/api/upload/thumbnail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileSize: thumb.blob.size }),
            });
            if (thumbInitRes.ok) {
              const thumbData = await thumbInitRes.json() as {
                signedUrl: string;
                thumbnailPath: string;
              };
              const thumbPutRes = await fetch(thumbData.signedUrl, {
                method: "PUT",
                body: thumb.blob,
                headers: { "Content-Type": "image/jpeg" },
              });
              if (thumbPutRes.ok) thumbnailPath = thumbData.thumbnailPath;
            }
          }
        } catch (thumbErr) {
          console.warn("[upload] image thumbnail generation failed:", thumbErr);
        }
      }

      const confirmRes = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          originalFileName: item.file.name,
          fileSize: toUpload.size,
          mimeType: toUpload.type || "application/octet-stream",
          guestName: name || null,
          thumbnailPath,
        }),
      });

      if (!confirmRes.ok) {
        // The bytes landed in storage but the DB record failed.
        // Show an error so the user can retry — a retry will re-upload cleanly.
        console.warn("[upload] confirm failed for", storagePath);
        const errBody = await confirmRes.json().catch(() => ({}));
        throw new Error(
          (errBody as { error?: string }).error || "Nahrávanie sa nepodarilo dokončiť — skús znova"
        );
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

  const startUpload = async (overrideItems?: FileItem[]) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setIsUploading(true);

    const source     = overrideItems ?? items;
    const uploadable = source.filter((i) => i.status === "pending" || i.status === "error");
    const name       = guestName.trim();

    saveResumeData(name, source);

    let successes = 0;
    for (let i = 0; i < uploadable.length; i += CONCURRENT) {
      const batch   = uploadable.slice(i, i + CONCURRENT);
      const results = await Promise.all(batch.map((item) => uploadOne(item, name)));
      successes    += results.filter(Boolean).length;
    }

    uploadingRef.current = false;
    setIsUploading(false);

    setItems((current) => {
      const allDone = current.every((i) => i.status === "done" || i.status === "skipped");
      if (allDone) { clearResumeData(); setSuccessCount(successes); setShowSuccess(true); }
      return current;
    });
  };

  const retryFailed = () => {
    if (uploadingRef.current) return;
    const reset = items.map((i) =>
      i.status === "error"
        ? { ...i, status: "pending" as FileStatus, progress: 0, errorMsg: undefined }
        : i
    );
    setItems(reset);
    startUpload(reset);
  };

  const handleUploadMore = () => {
    items.forEach((i) => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
    setItems([]); setRejected([]); setGuestName(""); setShowSuccess(false);
    setBatchLimitError(null); setUsedFirst30(false); pendingAllRef.current = [];
  };

  const doneCount      = items.filter((i) => i.status === "done" || i.status === "skipped").length;
  const errorCount     = items.filter((i) => i.status === "error").length;
  const hasUploadable  = items.some((i) => i.status === "pending" || i.status === "error");
  const anyCompressing = items.some((i) => i.status === "compressing");

  /* ── Success screen ─────────────────────────────────────────────── */
  if (showSuccess) {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-7 h-7 text-sage-700" strokeWidth={1.5} />
        </div>

        <h2 className="text-xl font-semibold text-stone-900 tracking-tight mb-2">
          Ďakujeme
        </h2>
        <p className="text-stone-500 text-sm leading-relaxed mb-1">
          Tvoje fotky a videá boli nahraté.
        </p>
        <p className="text-xs text-stone-400 mb-8">
          {successCount} {plural(successCount)} nahratých
        </p>

        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-5">
          <p className="text-sm text-stone-600 mb-3">Galéria bude dostupná po svadbe.</p>
          <Link
            href="/gallery"
            className="flex items-center justify-center gap-2 w-full py-3 bg-sage-800 text-white
                       rounded-xl text-sm font-semibold hover:bg-sage-900 transition-colors"
          >
            Otvoriť galériu <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>

        <button
          onClick={handleUploadMore}
          className="text-sm text-stone-400 hover:text-stone-700 transition-colors underline underline-offset-2"
        >
          Nahrať ďalšie fotky
        </button>
      </div>
    );
  }

  /* ── Upload form ────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Offline warning — shown whenever the browser loses network */}
      {isOffline && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200
                        rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={1.5} />
          <p className="font-sans text-sm text-red-700">
            Nie si pripojený na internet. Nahrávanie bude pokračovať po obnovení spojenia.
          </p>
        </div>
      )}

      {resumeData && items.length === 0 && (
        <ResumeBanner data={resumeData} onResume={handleResume} onDismiss={handleDismissResume} />
      )}

      {/* Guest name */}
      <input
        type="text"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
        placeholder="Tvoje meno (voliteľné)"
        disabled={isUploading}
        maxLength={100}
        className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-900
                   placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-sage-200
                   focus:border-sage-400 disabled:opacity-50 transition-colors bg-white"
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
            e.preventDefault(); fileInputRef.current?.click();
          }
        }}
        className={[
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer select-none",
          "transition-all duration-200",
          isDragOver
            ? "border-sage-400 bg-sage-50"
            : "border-stone-200 hover:border-stone-300 hover:bg-stone-50",
          isUploading ? "cursor-not-allowed opacity-40 pointer-events-none" : "",
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
        <Camera className="w-9 h-9 text-stone-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-stone-700 mb-1">
          {isDragOver ? "Pusti súbory sem" : "Vybrať fotky a videá"}
        </p>
        <p className="text-xs text-stone-400 leading-relaxed">
          Klikni alebo presuň súbory sem
        </p>
        <p className="text-xs text-stone-400 mt-1.5">
          Max.&nbsp;{MAX_FILES}&nbsp;súborov naraz&nbsp;·&nbsp;fotka do&nbsp;25&nbsp;MB&nbsp;·&nbsp;video do&nbsp;250&nbsp;MB
        </p>
      </div>

      {/* Empty hint */}
      {items.length === 0 && !resumeData && !batchLimitError && (
        <p className="text-center text-xs text-stone-400 leading-relaxed">
          Máš viac súborov? Nahraj ich po častiach.
        </p>
      )}

      {/* ── Batch count error (shown immediately, before any processing) ── */}
      {batchLimitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800 mb-1">
                Príliš veľa súborov
              </p>
              <p className="text-sm text-red-700 leading-relaxed">
                Vybral/a si {batchLimitError.count}&nbsp;{plural(batchLimitError.count)}. Naraz môžeš
                nahrať maximálne {MAX_FILES}.
              </p>
              <p className="text-xs text-red-600 mt-1">
                Vyber prosím menej súborov alebo ich nahraj po častiach.
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                setBatchLimitError(null);
                pendingAllRef.current = [];
                fileInputRef.current?.click();
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold
                         hover:bg-red-600 transition-colors"
            >
              Vybrať znova
            </button>
            <button
              onClick={() => {
                const first = pendingAllRef.current.slice(0, MAX_FILES);
                pendingAllRef.current = [];
                setBatchLimitError(null);
                setUsedFirst30(true);
                addFiles(first);
              }}
              className="px-4 py-2 border border-red-200 text-red-700 rounded-xl text-sm
                         font-semibold hover:bg-red-50 transition-colors"
            >
              Použiť prvých&nbsp;{MAX_FILES}
            </button>
          </div>
        </div>
      )}

      {/* First-30 truncation notice */}
      {usedFirst30 && items.length > 0 && (
        <div className="flex items-start gap-2 bg-sage-50 border border-sage-200
                        rounded-xl px-4 py-3">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-sage-500"
                       strokeWidth={1.5} />
          <p className="font-sans text-xs text-stone-600 leading-relaxed">
            Používame prvých {MAX_FILES} súborov. Zvyšné môžeš nahrať potom.
          </p>
        </div>
      )}

      {/* Rejected files */}
      {rejected.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 mb-2">Niektoré súbory neboli pridané:</p>
          <ul className="text-xs text-red-600 space-y-1">
            {rejected.map((r, i) => (
              <li key={i}>· <strong>{r.name}</strong>: {r.reason}</li>
            ))}
          </ul>
          <button
            onClick={() => setRejected([])}
            className="text-xs text-red-400 hover:text-red-600 mt-2 transition-colors"
          >
            Zavrieť
          </button>
        </div>
      )}

      {/* Compression notice */}
      {anyCompressing && (
        <div className="flex items-center gap-2.5 text-xs text-stone-600
                        bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0 text-stone-400" />
          Optimalizujem fotky…
        </div>
      )}

      {/* Uploading warning */}
      {isUploading && (
        <div className="flex items-start gap-2.5 text-xs text-stone-600
                        bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0 mt-0.5 text-stone-400" />
          <span>
            <strong className="text-stone-800">Nezatváraj túto stránku</strong> počas nahrávania.
            {doneCount > 0 && (
              <span className="text-stone-400 ml-1.5">{doneCount}/{items.length}</span>
            )}
          </span>
        </div>
      )}

      {/* File list */}
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-stone-500">
              Vybrané ({items.length})
              {doneCount > 0 && doneCount < items.length && (
                <span className="text-sage-600 ml-1.5">· {doneCount} hotových</span>
              )}
            </p>
            {!isUploading && (
              <button
                onClick={() => {
                  items.forEach((i) => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
                  setItems([]); setUsedFirst30(false);
                }}
                className="text-xs text-stone-400 hover:text-red-400 transition-colors"
              >
                Odstrániť všetky
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto gallery-scroll pr-0.5">
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

      {/* Upload button */}
      {items.length > 0 && (
        <button
          onClick={() => startUpload()}
          disabled={isUploading || !hasUploadable}
          className={[
            "w-full py-4 rounded-xl text-sm font-semibold transition-all",
            "flex items-center justify-center gap-2",
            isUploading || !hasUploadable
              ? "bg-stone-100 text-stone-400 cursor-not-allowed"
              : "bg-sage-800 text-white hover:bg-sage-900 shadow-md shadow-sage-900/15",
          ].join(" ")}
        >
          {isUploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" />
              {anyCompressing ? "Optimalizujem…" : "Nahrávam…"}</>
          ) : (
            <><Upload className="w-4 h-4" strokeWidth={1.5} />
              Nahrať {items.length} {plural(items.length)}</>
          )}
        </button>
      )}

      {/* Retry */}
      {!isUploading && errorCount > 0 && (
        <button
          onClick={retryFailed}
          className="w-full py-3.5 border border-stone-200 text-stone-600 rounded-xl
                     hover:bg-stone-50 transition-colors text-sm font-medium
                     flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
          Skúsiť znova ({errorCount} {plural(errorCount)})
        </button>
      )}
    </div>
  );
}
