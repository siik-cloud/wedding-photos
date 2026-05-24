"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  Download,
  ImageIcon,
  Video,
  ToggleLeft,
  ToggleRight,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckSquare,
  Square,
  RotateCcw,
  Search,
  HardDrive,
  User,
  AlertCircle,
  X,
  CheckCircle,
} from "lucide-react";
import type { UploadWithUrl, AdminStats } from "@/types";
import {
  isMobileDevice,
  downloadFileAsBlob,
  downloadAsZip,
  ZIP_FILENAME,
  DESKTOP_ZIP_WARN_BYTES,
  MOBILE_ZIP_MAX_BYTES,
  MOBILE_ZIP_MAX_FILES,
  type ZipPhase,
  type DownloadState,
  type DownloadProgress,
} from "@/lib/downloadUtils";
import MobileSaveModal from "@/components/MobileSaveModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminView   = "active" | "trash";
type SortBy      = "newest" | "oldest" | "largest";
type TypeFilter  = "all" | "image" | "video";

interface AdminFile extends UploadWithUrl {
  url: string;
  downloadUrl: string;
  daysLeft?: number;
}

interface CleanupPreview {
  count: number;
  weddingStartTimestamp: string | null;
  files: { id: string; name: string; created_at: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("sk-SK", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function pluralDays(n: number): string {
  if (n === 1) return "deň";
  if (n < 5)   return "dni";
  return "dní";
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={!isLoading ? onCancel : undefined}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-stone-900 mb-2">{title}</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">{body}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-stone-600 border border-stone-200
                       rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            Zrušiť
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600
                       rounded-xl transition-colors disabled:opacity-50
                       flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── StorageHealth ────────────────────────────────────────────────────────────

const QUOTA_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB free tier
const WARN_PCT    = 75;

function StorageHealth({ usedBytes }: { usedBytes: number }) {
  const pct  = Math.min(100, (usedBytes / QUOTA_BYTES) * 100);
  const warn = pct >= WARN_PCT;
  const crit = pct >= 90;

  const barColor  = crit ? "bg-red-500" : warn ? "bg-amber-400" : "bg-sage-400";
  const textColor = crit ? "text-red-700" : warn ? "text-amber-700" : "text-stone-700";
  const cardClass = crit
    ? "bg-red-50 border-red-200"
    : warn
    ? "bg-amber-50 border-amber-200"
    : "bg-white border-stone-200";

  return (
    <div className={`rounded-xl border p-4 ${cardClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HardDrive className={`w-4 h-4 ${textColor}`} strokeWidth={1.5} />
          <span className={`text-sm font-semibold ${textColor}`}>Úložisko</span>
        </div>
        <span className={`text-xs font-bold tabular-nums ${textColor}`}>
          {fmtSize(usedBytes)} / {fmtSize(QUOTA_BYTES)}
        </span>
      </div>

      <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {warn && (
        <div className={`flex items-start gap-1.5 mt-2 ${textColor}`}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="text-xs leading-relaxed">
            {crit
              ? "Úložisko je takmer plné. Vymaž nepotrebné súbory."
              : "Úložisko je z 75 % plné. Zvažuj vymazanie testovacích súborov."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-stone-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}

// ─── BulkActionBar ────────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  onDelete,
  onDownload,
  onClear,
  isDeleting,
  downloadState,
  downloadProgress,
  downloadFailed,
  zipPhase,
  limitMsg,
}: {
  count: number;
  onDelete: () => void;
  onDownload: () => void;
  onClear: () => void;
  isDeleting: boolean;
  downloadState: DownloadState;
  downloadProgress: DownloadProgress;
  downloadFailed: number;
  zipPhase?: ZipPhase | null;
  limitMsg?: string;
}) {
  if (count === 0) return null;

  const isDownloading = downloadState === "preparing" || downloadState === "downloading";

  return (
    <div className="sticky top-0 z-10 bg-white border border-stone-200 rounded-xl
                    px-4 py-3 flex items-center gap-2.5 shadow-sm flex-wrap">
      {/* Status / count */}
      <div className="flex-1 min-w-0">
        {downloadState === "idle" && (
          <span className="font-sans text-sm font-medium text-stone-700">
            Vybrané: {count}
          </span>
        )}
        {downloadState === "preparing" && (
          <span className="font-sans text-sm text-stone-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-500 flex-shrink-0" />
            Pripravujem ZIP…
          </span>
        )}
        {downloadState === "downloading" && (
          <span className="font-sans text-sm text-stone-700 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-500 flex-shrink-0" />
            {zipPhase === "generating"
              ? "Sťahujem ZIP…"
              : `Pridávam súbor ${downloadProgress.current} z ${downloadProgress.total}…`}
          </span>
        )}
        {downloadState === "done" && (
          <span className={`font-sans text-sm flex items-center gap-2
                            ${limitMsg || downloadFailed > 0 ? "text-amber-700" : "text-sage-700"}`}>
            {limitMsg
              ? <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
              : <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />}
            {limitMsg
              ?? (downloadFailed > 0
                  ? `Dokončené · ${downloadFailed} nepodarilo sa`
                  : "Sťahovanie dokončené.")}
          </span>
        )}
      </div>

      {/* Download */}
      {!isDownloading && downloadState !== "done" && (
        <button
          onClick={onDownload}
          disabled={isDeleting}
          className="flex items-center gap-1.5 px-3 py-2 border border-sage-700/40
                     text-sage-800 rounded-lg font-sans text-sm font-medium tracking-[0.02em]
                     hover:bg-sage-50 hover:border-sage-700/60 transition-colors
                     disabled:opacity-50 flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          Stiahnuť
        </button>
      )}

      {/* Delete */}
      {downloadState !== "done" && (
        <button
          onClick={onDelete}
          disabled={isDeleting || isDownloading}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg
                     font-sans text-sm font-medium tracking-[0.02em] hover:bg-red-600
                     transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {isDeleting
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
          Vymazať ({count})
        </button>
      )}

      {/* Clear */}
      <button
        onClick={onClear}
        disabled={isDeleting || isDownloading}
        className="px-3 py-2 border border-stone-200 text-stone-500 rounded-lg
                   font-sans text-sm hover:bg-stone-50 transition-colors
                   disabled:opacity-50 flex-shrink-0"
      >
        Zrušiť
      </button>
    </div>
  );
}

// ─── Active file row ──────────────────────────────────────────────────────────

function AdminFileRow({
  file,
  selected,
  onToggleSelect,
  onDelete,
  onDownload,
  isDeleting,
}: {
  file: AdminFile;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onDownload: () => void;
  isDeleting: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 flex items-center gap-3 transition-colors
                  ${selected ? "border-sage-300 bg-sage-50" : "border-stone-100"}`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        aria-label={selected ? "Odznačiť" : "Vybrať"}
        className="flex-shrink-0 text-stone-300 hover:text-sage-500 transition-colors"
      >
        {selected
          ? <CheckSquare className="w-5 h-5 text-sage-500" />
          : <Square       className="w-5 h-5" />}
      </button>

      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-100 flex-shrink-0
                      overflow-hidden flex items-center justify-center">
        {file.file_type === "image" && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : file.file_type === "video" && file.thumbnailUrl ? (
          // Pre-generated JPEG thumbnail — reliable on all browsers incl. iOS
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : file.file_type === "video" ? (
          <Video className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
        ) : (
          <ImageIcon className="w-5 h-5 text-stone-400" strokeWidth={1.5} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate flex items-center gap-1"
           title={file.original_file_name}>
          {file.file_type === "image"
            ? <ImageIcon className="inline w-3.5 h-3.5 flex-shrink-0 text-sage-400" strokeWidth={1.5} />
            : <Video     className="inline w-3.5 h-3.5 flex-shrink-0 text-blue-400" strokeWidth={1.5} />}
          <span className="truncate">{file.original_file_name}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-stone-400">
          {file.guest_name && (
            <span className="flex items-center gap-1 text-stone-600 font-medium">
              <User className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
              {file.guest_name}
            </span>
          )}
          <span>{fmtSize(file.file_size)}</span>
          <span>{fmtDate(file.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onDownload}
          className="p-2 text-stone-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg
                     transition-colors"
          title="Stiahnuť"
          aria-label="Stiahnuť"
        >
          <Download className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg
                     transition-colors disabled:opacity-50"
          title="Presunúť do koša"
          aria-label="Presunúť do koša"
        >
          {isDeleting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Trash2  className="w-4 h-4" strokeWidth={1.5} />}
        </button>
      </div>
    </div>
  );
}

// ─── Trash file row ───────────────────────────────────────────────────────────

function TrashFileRow({
  file,
  onRestore,
  isRestoring,
}: {
  file: AdminFile;
  onRestore: () => void;
  isRestoring: boolean;
}) {
  return (
    <div className="bg-white border border-stone-100 rounded-xl p-4 flex items-center gap-3 opacity-75">
      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-lg bg-stone-50 border border-stone-100 flex-shrink-0
                      overflow-hidden flex items-center justify-center">
        {file.file_type === "image" && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" className="w-full h-full object-cover grayscale" loading="lazy" />
        ) : file.file_type === "video" && file.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.thumbnailUrl} alt="" className="w-full h-full object-cover grayscale" loading="lazy" />
        ) : file.file_type === "video" ? (
          <Video className="w-5 h-5 text-stone-300" strokeWidth={1.5} />
        ) : (
          <ImageIcon className="w-5 h-5 text-stone-300" strokeWidth={1.5} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-500 truncate">{file.original_file_name}</p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-stone-400">
          {file.guest_name && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
              {file.guest_name}
            </span>
          )}
          <span>{fmtSize(file.file_size)}</span>
          {file.daysLeft !== undefined && (
            <span className={file.daysLeft <= 1 ? "text-red-400 font-semibold" : "text-stone-400"}>
              Vymaže sa o {file.daysLeft} {pluralDays(file.daysLeft)}
            </span>
          )}
        </div>
      </div>

      {/* Restore */}
      <button
        onClick={onRestore}
        disabled={isRestoring}
        className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 text-stone-500
                   rounded-lg text-xs font-semibold hover:bg-sage-50 hover:border-sage-300
                   hover:text-sage-700 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {isRestoring
          ? <Loader2   className="w-3.5 h-3.5 animate-spin" />
          : <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />}
        Obnoviť
      </button>
    </div>
  );
}

// ─── Cleanup section ──────────────────────────────────────────────────────────

function CleanupSection({ onCleaned }: { onCleaned: () => void }) {
  const [preview, setPreview]       = useState<CleanupPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [cleaning, setCleaning]     = useState(false);
  const [result, setResult]         = useState<string | null>(null);
  const [error, setError]           = useState("");

  const loadPreview = async () => {
    setPreviewing(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/cleanup");
      if (!res.ok) throw new Error("Chyba servera");
      setPreview(await res.json());
    } catch {
      setError("Nepodarilo sa načítať náhľad.");
    } finally {
      setPreviewing(false);
    }
  };

  const executeCleanup = async () => {
    if (!preview || preview.count === 0) return;
    const confirmed = window.confirm(
      `Naozaj vymazať ${preview.count} testovacích súborov?\n\nTáto akcia je nevratná.`
    );
    if (!confirmed) return;

    setCleaning(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cleanup", { method: "DELETE" });
      if (!res.ok) throw new Error("Chyba servera");
      const data = await res.json() as { deleted: number };
      setResult(`Vymazaných ${data.deleted} súborov.`);
      setPreview(null);
      onCleaned();
    } catch {
      setError("Chyba pri mazaní — skús znova.");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <h3 className="font-semibold text-amber-800 mb-1">Vymazať testovacie uploady</h3>
      <p className="text-sm text-amber-700 leading-relaxed mb-4">
        Vymaže súbory označené ako testové
        {preview?.weddingStartTimestamp && (
          <> alebo nahrané pred{" "}
            <strong>
              {new Date(preview.weddingStartTimestamp).toLocaleDateString("sk-SK")}
            </strong>
          </>
        )}.
        {" "}Skutočné svadobné fotky sú v bezpečí.
      </p>

      {result && (
        <p className="text-sm text-sage-700 bg-white border border-sage-200 rounded-xl
                      px-3 py-2 mb-3">
          {result}
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!preview ? (
        <button
          onClick={loadPreview}
          disabled={previewing}
          className="px-5 py-2.5 border border-amber-300 text-amber-700 rounded-xl
                     hover:bg-amber-100 text-sm font-semibold transition-colors
                     disabled:opacity-50 flex items-center gap-2"
        >
          {previewing && <Loader2 className="w-4 h-4 animate-spin" />}
          {previewing ? "Počítam…" : "Zobraziť, čo sa vymaže"}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-amber-800">
            {preview.count === 0
              ? "Žiadne testovacie súbory na vymazanie."
              : `Bude vymazaných ${preview.count} súborov:`}
          </p>

          {preview.count > 0 && (
            <ul className="text-xs text-amber-700 space-y-0.5 bg-white border border-amber-200
                           rounded-xl p-3 max-h-32 overflow-y-auto">
              {preview.files.slice(0, 20).map((f) => (
                <li key={f.id} className="truncate">
                  · {f.name}{" "}
                  <span className="text-amber-400">
                    ({new Date(f.created_at).toLocaleDateString("sk-SK")})
                  </span>
                </li>
              ))}
              {preview.count > 20 && (
                <li className="text-amber-400">… a ďalších {preview.count - 20}</li>
              )}
            </ul>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {preview.count > 0 && (
              <button
                onClick={executeCleanup}
                disabled={cleaning}
                className="px-5 py-2.5 bg-amber-500 text-white rounded-xl
                           hover:bg-amber-600 text-sm font-bold transition-colors
                           disabled:opacity-50 flex items-center gap-2"
              >
                {cleaning && <Loader2 className="w-4 h-4 animate-spin" />}
                {cleaning ? "Mažem…" : "Vymazať testovacie uploady"}
              </button>
            )}
            <button
              onClick={() => { setPreview(null); setResult(null); setError(""); }}
              className="text-sm text-amber-600 hover:text-amber-800 transition-colors"
            >
              Zavrieť
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main AdminPanel ──────────────────────────────────────────────────────────

export default function AdminPanel() {
  // File list (paginated — appended on "load more")
  const [files, setFiles]             = useState<AdminFile[]>([]);
  const [stats, setStats]             = useState<AdminStats | null>(null);
  const [galleryEnabled, setGalleryEnabled] = useState(false);
  const [trashFiles, setTrashFiles]   = useState<AdminFile[]>([]);

  // Loading / error
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");

  // Pagination
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal]     = useState(0); // total matching current filter

  // Misc
  const [toggling, setToggling]       = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // View & filter state (type/sort sent to server; search is debounced before sending)
  const [view, setView]             = useState<AdminView>("active");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy]         = useState<SortBy>("newest");
  const [search, setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk delete modal + result
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ deleted: number; failed: number } | null>(null);

  // Bulk download
  const [dlState, setDlState]       = useState<DownloadState>("idle");
  const [dlProgress, setDlProgress] = useState<DownloadProgress>({ current: 0, total: 0 });
  const [dlFailed, setDlFailed]     = useState<AdminFile[]>([]);
  const [dlZipPhase, setDlZipPhase] = useState<ZipPhase | null>(null);
  const [dlLimitMsg, setDlLimitMsg] = useState<string>("");

  // Mobile save modal
  const [isMobile, setIsMobile]     = useState(false);
  const [mobileFile, setMobileFile] = useState<AdminFile | null>(null);

  // ── Debounce search input ────────────────────────────────────────────────
  // Only fire a server request 400 ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Single-file download ─────────────────────────────────────────────────
  const handleSingleDownload = useCallback((file: AdminFile) => {
    if (isMobile) {
      setMobileFile(file);
    } else {
      // Desktop: pure blob download — never opens the raw Supabase URL.
      downloadFileAsBlob(file.downloadUrl, file.original_file_name);
    }
  }, [isMobile]);

  // ── Paginated fetch ──────────────────────────────────────────────────────
  // Page 0 resets the list, fetches settings + trash, and returns global stats.
  // Page N (>0) appends to the existing list; settings and trash are not re-fetched.

  const fetchData = useCallback(async (pageNum: number) => {
    if (pageNum === 0) {
      setLoading(true);
      setError("");
      setLoadMoreError("");
      setFiles([]);
      setSelectedIds(new Set());
    } else {
      setLoadingMore(true);
      setLoadMoreError("");
    }

    const params = new URLSearchParams({
      page: String(pageNum),
      type: typeFilter,
      sort: sortBy,
      q:    debouncedSearch,
    });

    try {
      if (pageNum === 0) {
        const [filesRes, settingsRes, trashRes] = await Promise.all([
          fetch(`/api/admin/files?${params}`),
          fetch("/api/admin/settings"),
          fetch("/api/admin/trash"),
        ]);
        if (!filesRes.ok || !settingsRes.ok) throw new Error("Chyba pri načítaní dát");

        const filesData    = await filesRes.json();
        const settingsData = await settingsRes.json();
        const trashData    = trashRes.ok ? await trashRes.json() : { files: [] };

        setFiles(filesData.files ?? []);
        setStats(filesData.stats ?? null);
        setGalleryEnabled(settingsData.public_gallery_enabled ?? false);
        setTrashFiles(trashData.files ?? []);
        setHasMore(filesData.hasMore ?? false);
        setTotal(filesData.total ?? 0);
        setPage(0);
      } else {
        const filesRes = await fetch(`/api/admin/files?${params}`);
        if (!filesRes.ok) throw new Error("Chyba pri načítaní dát");
        const filesData = await filesRes.json();
        setFiles((prev) => [...prev, ...(filesData.files ?? [])]);
        setHasMore(filesData.hasMore ?? false);
        setTotal(filesData.total ?? 0);
        setPage(pageNum);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Nastala chyba";
      if (pageNum === 0) setError(msg);
      else setLoadMoreError(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [typeFilter, sortBy, debouncedSearch]);

  // Re-fetch from page 0 whenever filters change or on mount
  useEffect(() => { fetchData(0); }, [fetchData]);
  useEffect(() => { setIsMobile(isMobileDevice()); }, []);

  // ── Gallery toggle ────────────────────────────────────────────────────────

  const toggleGallery = async () => {
    if (toggling) return;
    const next = !galleryEnabled;
    setToggling(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_gallery_enabled: next }),
      });
      if (!res.ok) throw new Error("Chyba pri zmene nastavení");
      setGalleryEnabled(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba");
    } finally {
      setToggling(false);
    }
  };

  // ── Single delete (soft) ──────────────────────────────────────────────────

  const deleteFile = async (id: string, name: string) => {
    if (!confirm(`Presunúť „${name}" do koša?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/files/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Chyba pri mazaní");
      }
      const deleted = files.find((f) => f.id === id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      setTotal((t) => Math.max(0, t - 1));
      // Update stats inline so the stat cards stay accurate without a full refetch
      if (deleted && stats) {
        setStats({
          totalFiles:     stats.totalFiles - 1,
          totalImages:    stats.totalImages  - (deleted.file_type === "image" ? 1 : 0),
          totalVideos:    stats.totalVideos  - (deleted.file_type === "video" ? 1 : 0),
          totalSizeBytes: stats.totalSizeBytes - (deleted.file_size ?? 0),
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba pri mazaní");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Bulk download via ZIP ─────────────────────────────────────────────────
  //
  // Sequential programmatic anchor clicks are blocked by every major browser
  // after the first one (popup-blocker heuristic). Packing files into a single
  // ZIP and triggering one download is the only reliable cross-browser solution.

  const bulkDownload = async () => {
    const toDownload = files.filter((f) => selectedIds.has(f.id));
    if (toDownload.length === 0) return;

    setDlState("preparing");
    setDlFailed([]);
    setDlLimitMsg("");
    setDlZipPhase(null);

    // ── Size / count limits ────────────────────────────────────────────────────
    const totalBytes = toDownload.reduce((sum, f) => sum + (f.file_size ?? 0), 0);

    if (isMobile && toDownload.length > MOBILE_ZIP_MAX_FILES) {
      setDlLimitMsg("Hromadné sťahovanie na mobile môže byť obmedzené. Vyber menej súborov, stiahni ich jednotlivo, alebo použi počítač.");
      setDlState("done");
      return;
    }
    if (isMobile && totalBytes > MOBILE_ZIP_MAX_BYTES) {
      setDlLimitMsg("Hromadné sťahovanie na mobile môže byť obmedzené. Vyber menej súborov, stiahni ich jednotlivo, alebo použi počítač.");
      setDlState("done");
      return;
    }
    if (totalBytes > DESKTOP_ZIP_WARN_BYTES) {
      setDlLimitMsg("Výber je príliš veľký na ZIP. Stiahni súbory po menších častiach.");
      setDlState("done");
      return;
    }

    // ── ZIP download ───────────────────────────────────────────────────────────
    setDlState("downloading");
    setDlProgress({ current: 0, total: toDownload.length });

    const { failedFiles } = await downloadAsZip(
      toDownload,
      ZIP_FILENAME,
      (p) => {
        setDlZipPhase(p.phase);
        setDlProgress({ current: p.current, total: p.total });
      }
    );

    setDlFailed(failedFiles);
    setDlState("done");
  };

  // ── Bulk delete — show modal ──────────────────────────────────────────────

  const bulkDelete = () => {
    if (selectedIds.size === 0) return;
    setBulkResult(null);
    setShowBulkConfirm(true);
  };

  const confirmBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/files/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Chyba pri mazaní");
      }
      const responseData = await res.json() as { deleted?: number };
      const deletedCount = responseData.deleted ?? idsToDelete.length;
      const failedCount  = idsToDelete.length - deletedCount;
      setBulkResult({ deleted: deletedCount, failed: failedCount });
      setShowBulkConfirm(false);
      await fetchData(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba pri hromadnom mazaní");
      setShowBulkConfirm(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Restore ───────────────────────────────────────────────────────────────

  const restoreFile = async (id: string) => {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/admin/files/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Chyba pri obnovovaní");
      }
      setTrashFiles((prev) => prev.filter((f) => f.id !== id));
      await fetchData(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba pri obnovovaní");
    } finally {
      setRestoringId(null);
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────────────
  // Filtering and sorting are now server-side; `files` is already filtered/sorted.
  // Selection operates only on the currently loaded files.

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const selectAll      = () => setSelectedIds(new Set(files.map((f) => f.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const allSelected    = files.length > 0 && files.every((f) => selectedIds.has(f.id));

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-stone-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Načítava sa…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-sm mb-4">{error}</p>
        <button
          onClick={() => fetchData(0)}
          className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm
                     hover:bg-stone-200 transition-colors font-medium"
        >
          Skúsiť znova
        </button>
      </div>
    );
  }

  // stats is null only during the very first load (covered by the `loading` check above)
  if (!stats) return null;

  return (
    <>
      {/* Bulk confirm modal */}
      {showBulkConfirm && (
        <ConfirmModal
          title="Naozaj chceš vymazať vybrané súbory?"
          body="Táto akcia sa nedá vrátiť späť. Súbory budú presunuté do koša a po 7 dňoch natrvalo vymazané."
          confirmLabel="Vymazať"
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowBulkConfirm(false)}
          isLoading={bulkDeleting}
        />
      )}

      <div className="space-y-5">

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Spolu"   value={stats.totalFiles} />
          <StatCard label="Fotky"   value={stats.totalImages} />
          <StatCard label="Videá"   value={stats.totalVideos} />
          <StatCard label="Veľkosť" value={fmtSize(stats.totalSizeBytes)} />
        </div>

        {/* ── Storage health ──────────────────────────────────────────────── */}
        <StorageHealth usedBytes={stats.totalSizeBytes} />

        {/* ── Gallery toggle ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-stone-800">Verejná galéria</h3>
              <p className="text-sm text-stone-500 mt-0.5">
                {galleryEnabled
                  ? "Galéria je verejne dostupná na /gallery"
                  : "Galéria je skrytá — len admin ju vidí"}
              </p>
            </div>
            <button
              onClick={toggleGallery}
              disabled={toggling}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200
                         hover:bg-stone-50 transition-colors font-medium text-sm text-stone-700
                         disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {toggling ? (
                <Loader2 className="w-5 h-5 animate-spin text-sage-500" />
              ) : galleryEnabled ? (
                <ToggleRight className="w-6 h-6 text-sage-500" />
              ) : (
                <ToggleLeft className="w-6 h-6 text-stone-400" />
              )}
              {galleryEnabled ? "Vypnúť" : "Zapnúť"}
            </button>
          </div>

          {galleryEnabled && (
            <a
              href="/gallery"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-sage-600
                         hover:text-sage-700 mt-3 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
              Otvoriť galériu
            </a>
          )}
        </div>

        {/* ── Download hint ────────────────────────────────────────────────── */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-sm">
          <p className="font-semibold text-stone-800 mb-1.5">
            Stiahnuť všetky súbory naraz
          </p>
          <p className="text-stone-500 leading-relaxed">
            Odporúčame použiť <strong className="text-stone-700">Supabase Storage dashboard</strong>{" "}
            → Storage → wedding-uploads. Prípadne Supabase CLI:{" "}
            <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs font-mono text-stone-700">
              supabase storage cp --recursive ss:///wedding-uploads ./svadobne-fotky
            </code>
          </p>
        </div>

        {/* ── Cleanup section ──────────────────────────────────────────────── */}
        <CleanupSection onCleaned={() => fetchData(0)} />

        {/* ── View tabs ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 bg-stone-100 rounded-xl p-1 w-fit">
          {(["active", "trash"] as AdminView[]).map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); setSelectedIds(new Set()); setBulkResult(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                          ${view === v
                            ? "bg-white text-stone-800 shadow-sm"
                            : "text-stone-500 hover:text-stone-700"}`}
            >
              {v === "active"
                ? `Aktívne (${stats.totalFiles})`
                : `Kôš (${trashFiles.length})`}
            </button>
          ))}
        </div>

        {/* ── Bulk result summary ──────────────────────────────────────────── */}
        {bulkResult && (
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm
                          ${bulkResult.failed > 0
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-sage-50 border-sage-200 text-sage-800"}`}>
            <span>
              Vymazané: {bulkResult.deleted}
              {bulkResult.failed > 0 && ` · Nepodarilo sa: ${bulkResult.failed}`}
            </span>
            <button
              onClick={() => setBulkResult(null)}
              className="ml-3 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Zavrieť"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Active files view ─────────────────────────────────────────────── */}
        {view === "active" && (
          <>
            {/* Filter bar */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                                   text-stone-300 pointer-events-none" strokeWidth={1.5} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Meno / súbor…"
                  className="w-full pl-9 pr-3 py-2.5 border border-stone-200 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-sage-200 bg-white
                             text-stone-700 placeholder:text-stone-300"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-sage-200 text-stone-700"
              >
                <option value="all">Všetko</option>
                <option value="image">Fotky</option>
                <option value="video">Videá</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-sage-200 text-stone-700"
              >
                <option value="newest">Najnovšie</option>
                <option value="oldest">Najstaršie</option>
                <option value="largest">Najväčšie</option>
              </select>

              <button
                onClick={() => fetchData(0)}
                className="p-2.5 border border-stone-200 rounded-xl text-stone-400
                           hover:text-stone-600 hover:bg-stone-50 transition-colors"
                title="Obnoviť"
                aria-label="Obnoviť"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Select-all row — operates on loaded files only */}
            {files.length > 0 && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={allSelected ? clearSelection : selectAll}
                  className="flex items-center gap-1.5 text-sm text-stone-500
                             hover:text-stone-700 transition-colors"
                >
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-sage-500" />
                    : <Square       className="w-4 h-4" />}
                  {allSelected
                    ? "Odznačiť všetky"
                    : `Vybrať všetky zobrazené (${files.length})`}
                </button>
                {total > files.length && (
                  <span className="text-xs text-stone-400">
                    Zobrazené: {files.length} z {total}
                  </span>
                )}
              </div>
            )}

            {/* Bulk action bar */}
            <BulkActionBar
              count={selectedIds.size}
              onDelete={bulkDelete}
              onDownload={bulkDownload}
              onClear={() => {
                clearSelection();
                setDlState("idle");
                setDlFailed([]);
                setDlZipPhase(null);
                setDlLimitMsg("");
              }}
              isDeleting={bulkDeleting}
              downloadState={dlState}
              downloadProgress={dlProgress}
              downloadFailed={dlFailed.length}
              zipPhase={dlZipPhase}
              limitMsg={dlLimitMsg}
            />

            {/* Download fallback panel — shown when some files couldn't be added to the ZIP */}
            {dlFailed.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm font-semibold text-amber-800">
                      {dlFailed.length} súborov sa nepodarilo pridať do ZIP.
                    </p>
                    <p className="font-sans text-xs text-amber-700 mt-0.5">
                      Stiahni ich jednotlivo cez tieto tlačidlá:
                    </p>
                  </div>
                  <button
                    onClick={() => setDlFailed([])}
                    className="p-1.5 text-amber-400 hover:text-amber-700 rounded-lg
                               hover:bg-amber-100 transition-colors flex-shrink-0 ml-3"
                    aria-label="Zavrieť"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {dlFailed.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => downloadFileAsBlob(f.downloadUrl, f.original_file_name)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-white
                                 border border-amber-100 rounded-xl font-sans text-sm text-stone-700
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

            {/* File list */}
            {files.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">
                {search || typeFilter !== "all"
                  ? "Žiadne súbory zodpovedajú filtru"
                  : "Žiadne nahrané súbory"}
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <AdminFileRow
                    key={file.id}
                    file={file}
                    selected={selectedIds.has(file.id)}
                    onToggleSelect={() => toggleSelect(file.id)}
                    onDelete={() => deleteFile(file.id, file.original_file_name)}
                    onDownload={() => handleSingleDownload(file)}
                    isDeleting={deletingId === file.id}
                  />
                ))}
              </div>
            )}

            {/* ── Load more ──────────────────────────────────────────────── */}
            {(hasMore || loadMoreError) && (
              <div className="flex flex-col items-center gap-2 pt-2">
                {loadMoreError && (
                  <p className="text-xs text-red-500">{loadMoreError}</p>
                )}
                <button
                  onClick={() => fetchData(page + 1)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 border border-stone-200
                             rounded-xl text-sm font-medium text-stone-600
                             hover:bg-stone-50 hover:border-stone-300 transition-colors
                             disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loadingMore ? "Načítava sa…" : "Načítať ďalšie"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Trash view ────────────────────────────────────────────────────── */}
        {view === "trash" && (
          <>
            <p className="text-sm text-stone-500">
              Súbory v koši sa automaticky natrvalo vymažú po 7 dňoch.
            </p>

            {trashFiles.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">
                Kôš je prázdny
              </div>
            ) : (
              <div className="space-y-2">
                {trashFiles.map((file) => (
                  <TrashFileRow
                    key={file.id}
                    file={file}
                    onRestore={() => restoreFile(file.id)}
                    isRestoring={restoringId === file.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </div>

      {/* Mobile save modal */}
      {mobileFile && (
        <MobileSaveModal
          file={mobileFile}
          onClose={() => setMobileFile(null)}
        />
      )}
    </>
  );
}
