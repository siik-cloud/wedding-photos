"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
} from "lucide-react";
import type { UploadWithUrl } from "@/types";

export default function GalleryView() {
  const [files, setFiles] = useState<UploadWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const res = await fetch("/api/gallery");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || "Chyba pri načítaní galérie"
        );
      }
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala chyba");
    } finally {
      setLoading(false);
    }
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) =>
      i !== null ? Math.max(0, i - 1) : null
    );
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex((i) =>
      i !== null ? Math.min(files.length - 1, i + 1) : null
    );
  }, [files.length]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, goPrev, goNext]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-sage-400 animate-spin" />
        <p className="text-gray-500">Načítava sa galéria...</p>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-lg">{error}</p>
        <button
          onClick={fetchGallery}
          className="mt-4 px-4 py-2 bg-sage-100 text-sage-700 rounded-lg hover:bg-sage-200 transition-colors"
        >
          Skúsiť znova
        </button>
      </div>
    );
  }

  // ── Empty ──
  if (files.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">📭</div>
        <p className="text-gray-500 text-lg">Galéria je zatiaľ prázdna.</p>
      </div>
    );
  }

  const currentFile = lightboxIndex !== null ? files[lightboxIndex] : null;

  return (
    <>
      {/* Stats */}
      <p className="text-sm text-gray-400 mb-4 text-center">
        {files.length} {files.length === 1 ? "súbor" : files.length < 5 ? "súbory" : "súborov"}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {files.map((file, index) => (
          <GalleryTile
            key={file.id}
            file={file}
            onClick={() => openLightbox(index)}
          />
        ))}
      </div>

      {/* Lightbox */}
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
            <X className="w-6 h-6" />
          </button>

          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              className="absolute left-3 z-10 text-white/70 hover:text-white
                         bg-black/30 rounded-full p-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Predchádzajúca"
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
          )}

          {/* Next */}
          {lightboxIndex < files.length - 1 && (
            <button
              className="absolute right-3 z-10 text-white/70 hover:text-white
                         bg-black/30 rounded-full p-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Nasledujúca"
            >
              <ChevronRight className="w-7 h-7" />
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
                className="max-h-[80vh] max-w-full mx-auto rounded-lg"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentFile.id}
                src={currentFile.url}
                alt={currentFile.original_file_name}
                className="max-h-[80vh] max-w-full mx-auto rounded-lg object-contain"
              />
            )}

            {/* Caption + download */}
            <div className="flex items-center justify-between mt-3 px-1 text-sm">
              <span className="text-white/60">
                {currentFile.guest_name && (
                  <span className="text-white/80 font-medium">
                    📸 {currentFile.guest_name} ·{" "}
                  </span>
                )}
                {new Date(currentFile.created_at).toLocaleDateString("sk-SK")}
              </span>
              <a
                href={currentFile.downloadUrl}
                download={currentFile.original_file_name}
                className="flex items-center gap-1.5 text-white/80 hover:text-white
                           bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4" />
                Stiahnuť
              </a>
            </div>
          </div>

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-sm">
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
  onClick,
}: {
  file: UploadWithUrl;
  onClick: () => void;
}) {
  return (
    <div
      className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {file.file_type === "video" ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 gap-2">
          <Play className="w-9 h-9 text-white/80" />
          <span className="text-xs text-white/60">Video</span>
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

      {/* Hover overlay */}
      <div
        className="absolute inset-0 bg-black/0 group-hover:bg-black/25
                      transition-colors flex items-end justify-between p-2
                      opacity-0 group-hover:opacity-100"
      >
        {file.guest_name && (
          <span className="text-white text-xs bg-black/50 px-1.5 py-0.5 rounded truncate max-w-[70%]">
            {file.guest_name}
          </span>
        )}
        <a
          href={file.downloadUrl}
          download={file.original_file_name}
          onClick={(e) => e.stopPropagation()}
          className="bg-white/90 hover:bg-white rounded-full p-1.5 transition-colors ml-auto"
          aria-label="Stiahnuť"
        >
          <Download className="w-3.5 h-3.5 text-gray-700" />
        </a>
      </div>
    </div>
  );
}
