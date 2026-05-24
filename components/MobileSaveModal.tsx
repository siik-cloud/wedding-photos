"use client";

/**
 * MobileSaveModal — bottom-sheet for saving a file to the phone photo gallery.
 *
 * Strategy (in order):
 *  1. "Zdieľať / uložiť" — Web Share API with File object (iOS 15+, Android Chrome)
 *     The share sheet lets the user pick Photos / Drive / iCloud etc.
 *  2. Long-press instruction — always shown for images; the user holds the preview
 *     image and selects "Uložiť do Fotiek" in the context menu.
 *  3. "Stiahnuť do Súborov" — blob-download fallback that saves to Files/Downloads.
 *
 * The direct-save-to-Photos API does not exist on the web; this is the best UX
 * possible within browser security constraints.
 */

import { useState } from "react";
import { X, Share2, Download, AlertCircle, Film } from "lucide-react";
import type { UploadWithUrl } from "@/types";
import {
  shareFileFromUrl,
  downloadSingleFile,
  type ShareResult,
} from "@/lib/downloadUtils";

interface Props {
  file: UploadWithUrl;
  onClose: () => void;
}

export default function MobileSaveModal({ file, onClose }: Props) {
  const [sharing, setSharing]   = useState(false);
  const [result, setResult]     = useState<ShareResult | null>(null);

  const isImage  = file.file_type === "image";
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";

  // ── Share ──────────────────────────────────────────────────────────────────

  const handleShare = async () => {
    setSharing(true);
    setResult(null);
    const r = await shareFileFromUrl(
      file.downloadUrl,
      file.original_file_name,
      file.mime_type
    );
    // "cancelled" is fine — user just closed the sheet without choosing; don't error
    setResult(r === "cancelled" ? null : r);
    setSharing(false);
  };

  // ── Fallback download ──────────────────────────────────────────────────────

  const handleFallback = () => {
    downloadSingleFile(file.downloadUrl, file.original_file_name);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className="relative bg-white rounded-t-3xl w-full max-w-lg px-5 pt-5 pb-10
                   shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-5" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-600
                     rounded-full hover:bg-stone-100 transition-colors"
          aria-label="Zavrieť"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── Preview ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden bg-stone-100 mb-4 max-h-60
                        flex items-center justify-center">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.url}
              alt={file.original_file_name}
              className="max-h-60 max-w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-40 bg-stone-800 flex flex-col items-center
                            justify-center gap-3">
              <Film className="w-10 h-10 text-white/50" strokeWidth={1.5} />
              <span className="font-sans text-white/50 text-sm">Video</span>
            </div>
          )}
        </div>

        {/* Filename */}
        <p className="font-sans text-xs text-stone-400 truncate mb-5 text-center px-4">
          {file.original_file_name}
        </p>

        {/* ── Primary action: share sheet ───────────────────────────────────── */}
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5
                       bg-sage-800 text-white rounded-2xl font-sans font-semibold text-sm
                       tracking-[0.02em] hover:bg-sage-900 active:bg-sage-900
                       transition-colors disabled:opacity-60 mb-3"
          >
            {sharing ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30
                                 border-t-white animate-spin" />
                Pripravujem…
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" strokeWidth={1.5} />
                Zdieľať / uložiť
              </>
            )}
          </button>
        )}

        {/* Share error */}
        {result === "error" && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200
                          rounded-xl px-4 py-3 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600"
                         strokeWidth={1.5} />
            <p className="font-sans text-xs text-amber-800 leading-relaxed">
              Zdieľanie sa nepodarilo. Skús stiahnuť súbor priamo.
            </p>
          </div>
        )}

        {/* ── Instruction panel ─────────────────────────────────────────────── */}
        <div className="bg-sage-50 border border-sage-100 rounded-2xl px-4 py-4 mb-4">
          <p className="font-sans text-sm font-semibold text-stone-800 mb-1.5">
            {isImage ? "Uložiť do galérie" : "Uložiť video do galérie"}
          </p>
          {isImage ? (
            <p className="font-sans text-sm text-stone-600 leading-relaxed">
              Podrž fotku a vyber možnosť{" "}
              <strong className="text-stone-800">Uložiť do Fotiek</strong>.
            </p>
          ) : (
            <p className="font-sans text-sm text-stone-600 leading-relaxed">
              Ak sa video uloží do Súborov, otvor ho a zdieľaním ho môžeš uložiť do galérie.
            </p>
          )}
        </div>

        {/* ── Fallback: direct download ─────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleFallback}
          className="w-full flex items-center justify-center gap-2 px-5 py-3
                     border border-stone-200 text-stone-600 rounded-2xl font-sans text-sm
                     font-medium hover:bg-stone-50 transition-colors"
        >
          <Download className="w-4 h-4" strokeWidth={1.5} />
          Stiahnuť do Súborov
        </button>
      </div>
    </div>
  );
}
