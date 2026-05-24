"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Download,
  Share2,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
  Inbox,
  User,
  ImageIcon,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { UploadWithUrl } from "@/types";
import {
  isMobileDevice,
  shareFileFromUrl,
  downloadSingleFile,
  downloadFilesSequentially,
  type DownloadState,
  type DownloadProgress,
} from "@/lib/downloadUtils";
// MobileSaveModal intentionally not used in the gallery:
// the save button triggers a direct share/download action with no intermediate modal.

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

  // Pagination
  const [page, setPage]           = useState(0);
  const [hasMore, setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");

  // Selection state
  const [selecting, setSelecting]       = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  // Download state
  const [downloadState, setDownloadState]       = useState<DownloadState>("idle");
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({ current: 0, total: 0 });
  const [showFallback, setShowFallback]         = useState(false);
  const [fallbackFiles, setFallbackFiles]       = useState<UploadWithUrl[]>([]);
  const [downloadResult, setDownloadResult]     = useState<{ success: number; failed: number } | null>(null);

  // Mobile detection (used for button labels and bulk-download warning)
  const [isMobile, setIsMobile] = useState(false);

  // ID of the file currently being fetched for share/download (drives loading indicator)
  const [savingId, setSavingId] = useState<string | null>(null);

  // Lightbox: track whether the current image/video failed to load
  const [lightboxMediaError, setLightboxMediaError] = useState(false);

  // Swipe detection refs
  const swipeTouchStartX = useRef<number | null>(null);
  const swipeTouchStartY = useRef<number | null>(null);

  // Lazy-fetched original signed URLs for images whose url="" (thumbnail-only in gallery API).
  // Using a ref so handleSave / downloadSelected can read the latest value without a
  // dependency on a stateful Map (which would cause handleSave to be recreated on every
  // fetch, triggering unnecessary re-renders across all tiles).
  const fetchedUrlsRef = useRef<Map<string, string>>(new Map());
  // URL used by the lightbox — set immediately when url≠"", or lazily after a fetch.
  const [lightboxOriginalUrl, setLightboxOriginalUrl] = useState<string>("");
  const [fetchingOriginalUrl, setFetchingOriginalUrl] = useState(false);

  const fetchGallery = useCallback(async (pageNum: number) => {
    if (pageNum === 0) {
      setLoading(true);
      setError("");
      setLoadMoreError("");
    } else {
      setLoadingMore(true);
      setLoadMoreError("");
    }
    try {
      const res = await fetch(`/api/gallery?page=${pageNum}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Chyba pri načítaní galérie");
      }
      const data = await res.json();
      const incoming: UploadWithUrl[] = data.files ?? [];
      if (pageNum === 0) {
        setFiles(incoming);
      } else {
        setFiles((prev) => [...prev, ...incoming]);
      }
      setHasMore(data.hasMore ?? false);
      setPage(pageNum);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nastala chyba";
      if (pageNum === 0) setError(msg);
      else setLoadMoreError(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchGallery(0); }, [fetchGallery]);
  useEffect(() => { setIsMobile(isMobileDevice()); }, []);

  // ── Lightbox ────────────────────────────────────────────────────────────────

  const openLightbox = (index: number) => {
    if (selecting) return;
    setLightboxIndex(index);
  };
  const closeLightbox = () => setLightboxIndex(null);

  // Loop-around navigation — last → first and first → last
  const goPrev = useCallback(() => {
    setLightboxIndex((i) => i !== null ? (i - 1 + files.length) % files.length : null);
  }, [files.length]);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => i !== null ? (i + 1) % files.length : null);
  }, [files.length]);

  // Clear the "media failed to load" flag whenever the shown file changes.
  useEffect(() => {
    setLightboxMediaError(false);
  }, [lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null) return;

    // Keyboard navigation
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")     closeLightbox();
      if (e.key === "ArrowLeft")  goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);

    // Prevent background scroll while lightbox is open.
    // `overflow:hidden` alone does NOT work on iOS Safari — the page scrolls anyway.
    // The reliable fix: freeze the body at the current scroll position using
    // `position:fixed` + a negative `top` offset, then restore on cleanup.
    const scrollY = window.scrollY;
    document.body.style.position   = "fixed";
    document.body.style.top        = `-${scrollY}px`;
    document.body.style.width      = "100%";
    document.body.style.overflowY  = "scroll"; // keeps scrollbar width so layout doesn't jump
    // Signal to MobileNav (and any other nav) that the lightbox is open so they can hide.
    document.body.setAttribute("data-lightbox-open", "");

    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.position  = "";
      document.body.style.top       = "";
      document.body.style.width     = "";
      document.body.style.overflowY = "";
      document.body.removeAttribute("data-lightbox-open");
      window.scrollTo(0, scrollY);  // restore exact scroll position
    };
  }, [lightboxIndex, goPrev, goNext]);

  // Fetch the original signed URL when the lightbox opens for an image-with-thumbnail
  // (those have url="" in the gallery API response — original is not pre-signed at page load).
  // The result is cached in fetchedUrlsRef so subsequent opens of the same file are instant.
  useEffect(() => {
    if (lightboxIndex === null) {
      // Lightbox closed — clear the stale URL so the next open doesn't flash old content.
      setLightboxOriginalUrl("");
      setFetchingOriginalUrl(false);
      return;
    }

    const file = files[lightboxIndex];
    if (!file) return;
    let cancelled = false;

    if (file.url !== "") {
      // Original URL already available (videos, images without thumbnails).
      setLightboxOriginalUrl(file.url);
      return;
    }

    // Check the in-memory cache first.
    const cached = fetchedUrlsRef.current.get(file.id);
    if (cached) {
      setLightboxOriginalUrl(cached);
      return;
    }

    // Need to fetch from the server.
    setLightboxOriginalUrl("");
    setFetchingOriginalUrl(true);

    fetch(`/api/gallery/file/${file.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { url?: string } | null) => {
        if (cancelled) return;
        const url = data?.url;
        if (url) {
          fetchedUrlsRef.current.set(file.id, url);
          setLightboxOriginalUrl(url);
        }
      })
      .catch(() => { /* fail silently — lightboxMediaError will show the placeholder */ })
      .finally(() => { if (!cancelled) setFetchingOriginalUrl(false); });

    return () => { cancelled = true; };
  }, [lightboxIndex, files]);

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

  // ── Unified save handler ──────────────────────────────────────────────────
  // Used by both the grid-tile download button and the lightbox action button.
  // No intermediate modal — triggers Web Share API immediately on supported
  // devices (iOS 15+, Android Chrome), falls back to blob download otherwise.

  const handleSave = useCallback(async (file: UploadWithUrl) => {
    setSavingId(file.id);
    try {
      // downloadUrl may be "" for images that have a thumbnail (original is lazy-loaded).
      // Resolve it from the cache, or fetch it now.
      let downloadUrl: string = file.downloadUrl || fetchedUrlsRef.current.get(file.id) || "";
      if (!downloadUrl) {
        const res = await fetch(`/api/gallery/file/${file.id}`);
        if (res.ok) {
          const data = await res.json() as { url?: string };
          downloadUrl = data.url ?? "";
          if (downloadUrl) fetchedUrlsRef.current.set(file.id, downloadUrl);
        }
      }
      if (!downloadUrl) return; // couldn't get a URL — fail silently

      // Desktop always downloads directly — Web Share API opens a share sheet that
      // doesn't make sense on desktop and may do nothing useful.
      // Mobile uses Web Share API when available; falls back to blob download.
      const hasShare =
        isMobile &&
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";

      if (hasShare) {
        const res = await shareFileFromUrl(
          downloadUrl,
          file.original_file_name,
          file.mime_type
        );
        // "cancelled" — user dismissed the sheet, nothing more to do.
        // "not-supported" / "error" — fall through to blob download.
        if (res === "not-supported" || res === "error") {
          downloadSingleFile(downloadUrl, file.original_file_name);
        }
      } else {
        downloadSingleFile(downloadUrl, file.original_file_name);
      }
    } finally {
      setSavingId(null);
    }
  }, [isMobile]);

  // ── Swipe handlers ───────────────────────────────────────────────────────
  // Place onTouchStart / onTouchEnd on the lightbox overlay.
  // Distinguishes a horizontal swipe (|dx| > |dy| and |dx| > 48px) from a tap.
  // e.preventDefault() on touchend suppresses the resulting click so the
  // lightbox is not accidentally closed after a swipe.

  const handleLightboxTouchStart = useCallback((e: React.TouchEvent) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  }, []);

  const handleLightboxTouchEnd = useCallback((e: React.TouchEvent) => {
    if (swipeTouchStartX.current === null || swipeTouchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
    const dy = e.changedTouches[0].clientY - swipeTouchStartY.current;
    swipeTouchStartX.current = null;
    swipeTouchStartY.current = null;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
      e.preventDefault(); // stop the following click from closing the lightbox
      if (dx < 0) goNext();
      else goPrev();
    }
  }, [goNext, goPrev]);

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
    setFallbackFiles([]);
    setDownloadResult(null);

    // Pre-fetch original signed URLs for selected items whose downloadUrl="" (thumbnail-only).
    // We write directly into fetchedUrlsRef so we can read the results synchronously below.
    const missingUrl = toDownload.filter(
      (f) => !f.downloadUrl && !fetchedUrlsRef.current.has(f.id)
    );
    if (missingUrl.length > 0) {
      await Promise.all(
        missingUrl.map(async (f) => {
          try {
            const res = await fetch(`/api/gallery/file/${f.id}`);
            if (res.ok) {
              const data = await res.json() as { url?: string };
              if (data.url) fetchedUrlsRef.current.set(f.id, data.url);
            }
          } catch { /* ignore — these files will appear in the failed list */ }
        })
      );
    }

    // Build resolved list: substitute fetched URLs where downloadUrl was empty.
    const resolved = toDownload
      .map((f) => ({
        ...f,
        url:         f.url         || fetchedUrlsRef.current.get(f.id) || "",
        downloadUrl: f.downloadUrl || fetchedUrlsRef.current.get(f.id) || "",
      }))
      .filter((f) => !!f.downloadUrl); // skip files whose URL we couldn't obtain

    if (resolved.length === 0) {
      setDownloadState("idle");
      return;
    }

    await new Promise<void>((r) => setTimeout(r, 400));

    setDownloadState("downloading");
    setDownloadProgress({ current: 0, total: resolved.length });

    const failed = await downloadFilesSequentially(
      resolved,
      600,
      (current, total) => setDownloadProgress({ current, total })
    );

    const successCount = resolved.length - failed.length;
    setDownloadResult({ success: successCount, failed: failed.length });
    setDownloadState("done");

    // Only show the fallback panel when files actually failed
    if (failed.length > 0) {
      setFallbackFiles(failed);
      setShowFallback(true);
    }
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
          onClick={() => fetchGallery(0)}
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
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-white border border-sage-200
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
                Sťahujem súbor&nbsp;{downloadProgress.current}&nbsp;z&nbsp;{downloadProgress.total}…
              </span>
            )}
            {downloadState === "done" && (
              <span className="font-sans text-sm text-sage-700 flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                {downloadResult
                  ? `Stiahnuté: ${downloadResult.success}${downloadResult.failed > 0 ? ` · Nepodarilo sa: ${downloadResult.failed}` : ""}`
                  : "Sťahovanie dokončené."}
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
              onClick={() => {
                setDownloadState("idle");
                setShowFallback(false);
                setDownloadResult(null);
              }}
              className="font-sans text-xs font-medium text-stone-400 hover:text-stone-600
                         transition-colors flex-shrink-0"
            >
              Nové sťahovanie
            </button>
          )}

          {/* Mobile bulk-download warning */}
          {isMobile && selectedCount > 1 && downloadState === "idle" && (
            <div className="basis-full flex items-start gap-2 pt-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-sage-500"
                           strokeWidth={1.5} />
              <p className="font-sans text-xs text-stone-500 leading-relaxed">
                Hromadné sťahovanie môže telefón uložiť do Súborov. Pre uloženie priamo
                do galérie odporúčame ukladať fotky jednotlivo.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Fallback links panel ──────────────────────────────────────────────── */}
      {showFallback && fallbackFiles.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              {downloadResult?.success === 0 ? (
                <>
                  <p className="font-sans text-sm font-semibold text-red-800">
                    Prehliadač zablokoval hromadné sťahovanie.
                  </p>
                  <p className="font-sans text-xs text-stone-600 mt-0.5 leading-relaxed">
                    Stiahni všetky súbory cez tieto odkazy:
                  </p>
                </>
              ) : (
                <>
                  <p className="font-sans text-sm font-semibold text-amber-800">
                    Niektoré súbory sa nepodarilo stiahnuť.
                  </p>
                  <p className="font-sans text-xs text-stone-600 mt-0.5 leading-relaxed">
                    Stiahni ich manuálne cez tieto priame odkazy:
                  </p>
                </>
              )}
            </div>
            <button
              onClick={() => setShowFallback(false)}
              className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg
                         hover:bg-stone-100 transition-colors flex-shrink-0 ml-3"
              aria-label="Zavrieť"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            {fallbackFiles.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => downloadSingleFile(f.downloadUrl, f.original_file_name)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white
                           border border-red-100 rounded-xl font-sans text-sm text-stone-700
                           hover:border-sage-300 hover:text-sage-800 transition-colors
                           group text-left"
              >
                <Download className="w-3.5 h-3.5 text-stone-300 group-hover:text-sage-600
                                     flex-shrink-0" strokeWidth={1.5} />
                <span className="truncate">{f.original_file_name}</span>
              </button>
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
            onDownload={() => handleSave(file)}
            isSaving={savingId === file.id}
          />
        ))}
      </div>

      {/* ── Load more ─────────────────────────────────────────────────────────── */}
      {(hasMore || loadMoreError) && (
        <div className="flex flex-col items-center gap-2 mt-6">
          {loadMoreError && (
            <p className="font-sans text-xs text-red-500">{loadMoreError}</p>
          )}
          <button
            onClick={() => fetchGallery(page + 1)}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 border border-stone-200
                       rounded-xl font-sans text-sm font-medium text-stone-600
                       hover:bg-stone-50 hover:border-stone-300 transition-colors
                       disabled:opacity-50"
          >
            {loadingMore && (
              <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
            )}
            {loadingMore ? "Načítava sa…" : "Načítať ďalšie"}
          </button>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────────── */}
      {currentFile && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95"
          onTouchStart={handleLightboxTouchStart}
          onTouchEnd={handleLightboxTouchEnd}
          onClick={closeLightbox}
        >
          {/* ── Top bar: counter + close ──────────────────────────────────────────
              Absolutely positioned so a tall portrait image can never push it off
              screen. z-20 keeps it above the media layer. The gradient prevents the
              bar from blending into bright images. */}
          <div
            className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between
                       px-4 py-3 bg-gradient-to-b from-black/60 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="font-sans text-white/40 text-xs tabular-nums">
              {lightboxIndex + 1} / {files.length}
            </span>
            <button
              className="text-white/70 hover:text-white bg-black/30 rounded-full p-2.5
                         transition-colors"
              onClick={closeLightbox}
              aria-label="Zavrieť"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Media area ────────────────────────────────────────────────────────
              pt-14 keeps the image below the top bar.
              pb-28 (112px) keeps it above the bottom action bar + iPhone safe area.
              Arrows and media content live inside this layer. */}
          <div className="absolute inset-0 flex items-center justify-center pt-14 pb-28">
            {/* Prev — loops around */}
            {files.length > 1 && (
              <button
                className="absolute left-2 sm:left-3 z-10 text-white/70 hover:text-white
                           bg-black/30 rounded-full p-3 sm:p-2.5 transition-colors"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                aria-label="Predchádzajúca"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Next — loops around */}
            {files.length > 1 && (
              <button
                className="absolute right-2 sm:right-3 z-10 text-white/70 hover:text-white
                           bg-black/30 rounded-full p-3 sm:p-2.5 transition-colors"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                aria-label="Nasledujúca"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Media — constrained by the padded container */}
            <div
              className="h-full w-full flex items-center justify-center px-14 md:px-20"
              onClick={(e) => e.stopPropagation()}
            >
              {lightboxMediaError ? (
                /* Broken / missing file — show a neutral placeholder */
                <div className="flex flex-col items-center gap-3 text-white/30 py-12">
                  <ImageIcon className="w-14 h-14" strokeWidth={1} />
                  <p className="font-sans text-sm">Súbor nie je dostupný</p>
                </div>
              ) : currentFile.file_type === "video" ? (
                <video
                  key={currentFile.id}
                  src={currentFile.url}
                  controls
                  playsInline
                  className="max-h-full max-w-full rounded-xl"
                  onError={() => setLightboxMediaError(true)}
                />
              ) : fetchingOriginalUrl ? (
                /* Fetching original URL for this image (thumbnail-only grid entry) */
                <div className="flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white/40 animate-spin" strokeWidth={1.5} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={currentFile.id}
                  src={lightboxOriginalUrl || currentFile.url}
                  alt={currentFile.original_file_name}
                  className="max-h-full max-w-full rounded-xl object-contain"
                  onError={() => setLightboxMediaError(true)}
                />
              )}
            </div>
          </div>

          {/* ── Bottom bar: uploader + save ───────────────────────────────────────
              fixed bottom-0 z-[9999]: above MobileNav (z-50), above all page overlays.
              This is the key guarantee — no portrait image, flex-col bug, or nav layer
              can push this off screen. Safe-area padding clears iPhone home indicator. */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[9999] flex items-center
                       justify-between px-4 pt-3 gap-3 bg-gradient-to-t from-black/75
                       to-transparent"
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              {currentFile.guest_name && (
                <>
                  <User className="w-3.5 h-3.5 text-white/40 flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-sans text-sm text-white/80 truncate">
                    {currentFile.guest_name}
                  </span>
                  <span className="text-white/30 flex-shrink-0 mx-0.5">·</span>
                </>
              )}
              <span className="font-sans text-xs text-white/40 flex-shrink-0">
                {new Date(currentFile.created_at).toLocaleDateString("sk-SK")}
              </span>
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSave(currentFile);
              }}
              disabled={savingId === currentFile.id}
              className="flex items-center gap-1.5 font-sans text-sm text-white/80
                         hover:text-white bg-white/10 hover:bg-white/20 px-3 py-2
                         rounded-xl transition-colors flex-shrink-0 disabled:opacity-60"
            >
              {savingId === currentFile.id ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              ) : isMobile ? (
                <Share2 className="w-4 h-4" strokeWidth={1.5} />
              ) : (
                <Download className="w-4 h-4" strokeWidth={1.5} />
              )}
              {savingId === currentFile.id
                ? "Pripravujem…"
                : isMobile ? "Zdieľať / uložiť" : "Stiahnuť"}
            </button>
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
  isSaving,
}: {
  file: UploadWithUrl;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onClick: () => void;
  onDownload: () => void;
  isSaving: boolean;
}) {
  // Per-tile load error states for graceful fallback rendering
  const [imgError,   setImgError]   = useState(false); // main photo <img> failed
  const [thumbError, setThumbError] = useState(false); // pre-generated video thumbnail <img> failed
  const [videoError, setVideoError] = useState(false); // <video> element fallback failed

  return (
    <div
      className={`relative aspect-square bg-stone-100 rounded-xl overflow-hidden
                  cursor-pointer group transition-all duration-150
                  ${selected ? "ring-2 ring-sage-700 ring-offset-2" : ""}`}
      onClick={selecting ? onToggle : onClick}
    >
      {file.file_type === "video" ? (
        /* Three-tier video thumbnail strategy:
           1. Pre-generated JPEG (thumbnailUrl) — stored in Supabase, works on all
              browsers including iOS Safari which can't render <video> poster frames
              without user interaction.
           2. <video preload="metadata" #t=0.001> — hint browser to seek to first
              frame; works on most desktop browsers as a fallback for videos without
              a stored thumbnail.
           3. Dark bg + play icon only — silent ultimate fallback when both fail. */
        <div className="w-full h-full relative bg-stone-900 overflow-hidden">
          {file.thumbnailUrl && !thumbError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setThumbError(true)}
            />
          ) : !videoError ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={`${file.url}#t=0.001`}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover"
              onError={() => setVideoError(true)}
            />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 rounded-full p-2.5">
              <Play className="w-5 h-5 text-white" strokeWidth={1.5} fill="white" />
            </div>
          </div>
        </div>
      ) : imgError ? (
        /* Broken / missing image — neutral placeholder keeps the grid tidy */
        <div className="w-full h-full flex items-center justify-center bg-stone-100">
          <ImageIcon className="w-7 h-7 text-stone-300" strokeWidth={1.5} />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.thumbnailUrl ?? file.url}
          alt={file.original_file_name}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
          onError={() => setImgError(true)}
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
            disabled={isSaving}
            className="bg-white/90 hover:bg-white rounded-full p-1.5 transition-colors
                       ml-auto disabled:opacity-60"
            aria-label={isSaving ? "Pripravujem…" : "Stiahnuť"}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 text-stone-700 animate-spin" strokeWidth={1.5} />
            ) : (
              <Download className="w-3.5 h-3.5 text-stone-700" strokeWidth={1.5} />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
