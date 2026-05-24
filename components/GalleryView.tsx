"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
  Inbox,
  User,
  CheckCircle,
} from "lucide-react";
import type { UploadWithUrl } from "@/types";
import {
  downloadSingleFile,
  downloadFilesSequentially,
  type DownloadState,
  type DownloadProgress,
} from "@/lib/downloadUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pluralFiles(n: number): string {
  if (n === 1) return "súbor";
  if (n < 5)  return "súbory";
  return "súborov";
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GalleryView() {
  const [files, setFiles]               = useState<UploadWithUrl[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Selection state
  const [selecting, setSelecting]       = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  // Download state
  const [downloadState, setDownloadState]       = useState<DownloadState>("idle");
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({ current: 0, total: 0 });
  const [showFallback, setShowFallback]         = useState(false);
  const [fallbackFiles, setFallbackFiles]       = useState<UploadWithUrl[]>([]);

  useEffect(() => { fetchGallery(); }, []);

  const fetchGallery = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gallery");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Chyba pri načítaní galérie");
      }
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala chyba");
    } finally {
      setLoading(false);
    }
  };

  // ── Lightbox ────────────────────────────────────────────────────────────────

  const openLightbox = (index: number) => {
    if (selecting) return;
    setLightboxIndex(index);
  };
  const closeLightbox = () => setLightboxIndex(null);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => i !== null ? Math.max(0, i - 1) : null);
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => i !== null ? Math.min(files.length - 1, i + 1) : null);
  }, [files.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")     closeLightbox();
      if (e.key === "ArrowLeft")  goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, goPrev, goNext]);

  // ── Selection ───────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const enterSelectMode = () => {
    setSelecting(true);
    setDownloadState("idle");
    setShowFallback(false);
    setFallbackFiles([]);
  };

  const exitSelectMode = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setDownloadState("idle");
    setShowFallback(false);
    setFallbackFiles([]);
  };

  const selectAll   = () => setSelectedIds(new Set(files.map((f) => f.id)));
  const clearSelect = () => setSelectedIds(new Set());
  const allSelected = files.length > 0 && files.every((f) => selectedIds.has(f.id));

  // ── Bulk download ───────────────────────────────────────────────────────────
  //
  // Strategy: fetch each file as a Blob → same-origin object URL → anchor click.
  // The `download` attribute is IGNORED by Chrome for cross-origin hrefs (Supabase
  // URLs) but IS honoured for blob: URLs, which are always same-origin.
  //
  // Files are downloaded one at a time with a 600 ms delay to prevent the
  // browser's popup-blocker from killing subsequent downloads.

  const downloadSelected = async () => {
    const toDownload = files.filter((f) => selectedIds.has(f.id));
    if (toDownload.length === 0) return;

    setDownloadState("preparing");
    setShowFallback(false);
    setFallbackFiles(toDownload); // pre-fill fallback list

    // Brief pause so "Pripravujem…" is visible
    await new Promise<void>((r) => setTimeout(r, 400));

    setDownloadState("downloading");
    setDownloadProgress({ current: 0, total: toDownload.length });

    const failed = await downloadFilesSequentially(
      toDownload,
      600,
      (current, total) => setDownloadProgress({ current, total })
    );

    setDownloadState("done");
    // Show the fallback panel: failed files first, then all files as reference
    setFallbackFiles(failed.length > 0 ? failed : toDownload);
    setShowFallback(true);
  };

  // ── States ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 text-stone-300 animate-spin" />
        <p className="font-sans text-stone-400 text-sm">Načítava sa galéria…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="font-sans text-red-500 text-sm mb-4">{error}</p>
        <button
          onClick={fetchGallery}
          className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg font-sans text-sm
                     hover:bg-stone-200 transition-colors font-medium"
        >
          Skúsiť znova
        </button>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center
                        mx-auto mb-5">
          <Inbox className="w-6 h-6 text-sage-500" strokeWidth={1.5} />
        </div>
        <p className="font-sans text-stone-600 text-base">Galéria je zatiaľ prázdna.</p>
        <p className="font-sans text-stone-400 text-xs mt-1">Buď prvý, kto nahráš fotku.</p>
      </div>
    );
  }

  const currentFile    = lightboxIndex !== null ? files[lightboxIndex] : null;
  const selectedCount  = selectedIds.size;
  const isDownloading  = downloadState === "preparing" || downloadState === "downloading";

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <p className="font-sans text-xs text-stone-400">
          {files.length} {pluralFiles(files.length)}
        </p>

        {!selecting ? (
          <button
            onClick={enterSelectMode}
            className="font-sans text-xs font-medium text-stone-500 hover:text-stone-800
                       tracking-[0.02em] transition-colors px-3 py-1.5 border border-stone-200
                       rounded-lg hover:border-stone-300 hover:bg-stone-50"
          >
            Vybrať
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={allSelected ? clearSelect : selectAll}
              className="font-sans text-xs font-medium text-stone-500 hover:text-stone-700
                         transition-colors"
            >
              {allSelected ? "Zrušiť výber" : "Vybrať všetky"}
            </button>
            <button
              onClick={exitSelectMode}
              className="font-sans text-xs font-medium text-stone-400 hover:text-stone-600
                         transition-colors"
            >
              Zrušiť
            </button>
          </div>
        )}
      </div>

      {/* ── Selection action bar ──────────────────────────────────────────────── */}
      {selecting && (
        <div className="mb-4 flex items-center gap-3 bg-white border border-sage-200
                        rounded-xl px-4 py-3 shadow-sm shadow-sage-900/5">
          {/* Count / status */}
          <div className="flex-1 min-w-0">
            {downloadState === "idle" && (
              <span className="font-sans text-sm text-stone-500">
                {selectedCount > 0
                  ? `Vybrané: ${selectedCount} ${pluralFiles(selectedCount)}`
                  : "Kliknutím vyber súbory"}
              </span>
            )}
            {downloadState === "preparing" && (
              <span className="font-sans text-sm text-stone-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-500 flex-shrink-0" />
                Pripravujem sťahovanie…
              </span>
            )}
            {downloadState === "downloading" && (
              <span className="font-sans text-sm text-stone-700 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-500 flex-shrink-0" />
                Sťahujem {downloadProgress.current}&nbsp;/&nbsp;{downloadProgress.total} súborov…
              </span>
            )}
            {downloadState === "done" && (
              <span className="font-sans text-sm text-sage-700 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                Sťahovanie dokončené.
              </span>
            )}
          </div>

          {/* Action button */}
          {downloadState === "idle" && selectedCount > 0 && (
            <button
              onClick={downloadSelected}
              className="flex items-center gap-1.5 px-4 py-2 bg-sage-800 text-white
                         rounded-lg font-sans font-medium text-sm tracking-[0.02em]
                         hover:bg-sage-900 transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
              Stiahnuť vybrané
            </button>
          )}

          {isDownloading && (
            <span className="font-sans text-xs text-stone-400 flex-shrink-0">
              Prosím čakaj…
            </span>
          )}

          {downloadState === "done" && (
            <button
              onClick={() => { setDownloadState("idle"); setShowFallback(false); }}
              className="font-sans text-xs font-medium text-stone-400 hover:text-stone-600
                         transition-colors flex-shrink-0"
            >
              Nové sťahovanie
            </button>
          )}
        </div>
      )}

      {/* ── Fallback links panel ──────────────────────────────────────────────── */}
      {showFallback && fallbackFiles.length > 0 && (
        <div className="mb-6 bg-sage-50 border border-sage-200 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              {fallbackFiles.length === selectedCount ? (
                <>
                  <p className="font-sans text-sm font-semibold text-stone-800">
                    Priame odkazy na stiahnutie
                  </p>
                  <p className="font-sans text-xs text-stone-500 mt-0.5 leading-relaxed">
                    Ak prehliadač zablokoval niektoré súbory, stiahni ich cez tieto odkazy.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-sans text-sm font-semibold text-amber-800">
                    Niektoré súbory sa nepodarilo stiahnuť
                  </p>
                  <p className="font-sans text-xs text-stone-500 mt-0.5 leading-relaxed">
                    Stiahni ich manuálne cez tieto priame odkazy.
                  </p>
                </>
              )}
            </div>
            <button
              onClick={() => { setShowFallback(false); }}
              className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg
                         hover:bg-stone-100 transition-colors flex-shrink-0 ml-3"
              aria-label="Zavrieť"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            {fallbackFiles.map((f) => (
              <a
                key={f.id}
                href={f.downloadUrl}
                download={f.original_file_name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-sage-100
                           rounded-xl font-sans text-sm text-stone-700 hover:border-sage-300
                           hover:text-sage-800 transition-colors group"
              >
                <Download className="w-3.5 h-3.5 text-stone-300 group-hover:text-sage-600
                                     flex-shrink-0" strokeWidth={1.5} />
                <span className="truncate">{f.original_file_name}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {files.map((file, index) => (
          <GalleryTile
            key={file.id}
            file={file}
            selecting={selecting}
            selected={selectedIds.has(file.id)}
            onToggle={() => toggleSelect(file.id)}
            onClick={() => openLightbox(index)}
            onDownload={() => downloadSingleFile(file.downloadUrl, file.original_file_name)}
          />
        ))}
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────────────── */}
      {currentFile && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 z-10 text-white/70 hover:text-white
                       bg-black/30 rounded-full p-2 transition-colors"
            onClick={closeLightbox}
            aria-label="Zavrieť"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              className="absolute left-3 z-10 text-white/70 hover:text-white
                         bg-black/30 rounded-full p-2 transition-colors"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              aria-label="Predchádzajúca"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next */}
          {lightboxIndex < files.length - 1 && (
            <button
              className="absolute right-3 z-10 text-white/70 hover:text-white
                         bg-black/30 rounded-full p-2 transition-colors"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              aria-label="Nasledujúca"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Media */}
          <div
            className="max-w-5xl w-full mx-4 md:mx-16"
            onClick={(e) => e.stopPropagation()}
          >
            {currentFile.file_type === "video" ? (
              <video
                key={currentFile.id}
                src={currentFile.url}
                controls
                autoPlay
                playsInline
                className="max-h-[80vh] max-w-full mx-auto rounded-xl"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentFile.id}
                src={currentFile.url}
                alt={currentFile.original_file_name}
                className="max-h-[80vh] max-w-full mx-auto rounded-xl object-contain"
              />
            )}

            {/* Caption + download */}
            <div className="flex items-center justify-between mt-3 px-1 gap-3">
              <span className="text-white/60 flex items-center gap-1.5 min-w-0 text-sm">
                {currentFile.guest_name && (
                  <>
                    <User className="w-3.5 h-3.5 text-white/40 flex-shrink-0" strokeWidth={1.5} />
                    <span className="font-sans text-white/80 truncate">
                      {currentFile.guest_name}
                    </span>
                    <span className="text-white/30 flex-shrink-0 mx-0.5">·</span>
                  </>
                )}
                <span className="font-sans text-xs flex-shrink-0">
                  {new Date(currentFile.created_at).toLocaleDateString("sk-SK")}
                </span>
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadSingleFile(currentFile.downloadUrl, currentFile.original_file_name);
                }}
                className="flex items-center gap-1.5 font-sans text-sm text-white/80
                           hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5
                           rounded-lg transition-colors flex-shrink-0"
              >
                <Download className="w-4 h-4" strokeWidth={1.5} />
                Stiahnuť
              </button>
            </div>
          </div>

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2
                          font-sans text-white/40 text-xs">
            {lightboxIndex + 1} / {files.length}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Gallery tile ─────────────────────────────────────────────────────────────

function GalleryTile({
  file,
  selecting,
  selected,
  onToggle,
  onClick,
  onDownload,
}: {
  file: UploadWithUrl;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
  onDownload: () => void;
}) {
  return (
    <div
      className={`relative aspect-square bg-stone-100 rounded-xl overflow-hidden
                  cursor-pointer group transition-all duration-150
                  ${selected ? "ring-2 ring-sage-700 ring-offset-2" : ""}`}
      onClick={selecting ? onToggle : onClick}
    >
      {file.file_type === "video" ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-stone-800 gap-2">
          <Play className="w-8 h-8 text-white/70" strokeWidth={1.5} />
          <span className="font-sans text-xs text-white/40">Video</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.url}
          alt={file.original_file_name}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
      )}

      {/* Selection overlay */}
      {selecting && (
        <div
          className={`absolute inset-0 transition-colors
                      ${selected
                        ? "bg-sage-900/25"
                        : "bg-transparent group-hover:bg-black/10"}`}
        >
          <div
            className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center
                        justify-center transition-all
                        ${selected
                          ? "bg-sage-700 border-sage-700"
                          : "bg-white/80 border-white/90 group-hover:bg-white"}`}
          >
            {selected && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 10" fill="none">
                <path
                  d="M1 5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Hover overlay — non-select mode */}
      {!selecting && (
        <div
          className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors
                     flex items-end justify-between p-2
                     opacity-0 group-hover:opacity-100"
        >
          {file.guest_name && (
            <span className="font-sans text-white text-xs bg-black/50 px-1.5 py-0.5
                             rounded-lg truncate max-w-[70%]">
              {file.guest_name}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            className="bg-white/90 hover:bg-white rounded-full p-1.5 transition-colors ml-auto"
            aria-label="Stiahnuť"
          >
            <Download className="w-3.5 h-3.5 text-stone-700" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
