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
  downloadSingleFile,
  downloadFilesSequentially,
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

interface AdminData {
  files: AdminFile[];
  stats: AdminStats;
  galleryEnabled: boolean;
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
  isMobile,
}: {
  count: number;
  onDelete: () => void;
  onDownload: () => void;
  onClear: () => void;
  isDeleting: boolean;
  downloadState: DownloadState;
  downloadProgress: DownloadProgress;
  isMobile: boolean;
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
            Sťahovanie dokončené.
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

      {/* Mobile bulk-download warning */}
      {isMobile && count > 1 && downloadState === "idle" && (
        <div className="basis-full flex items-start gap-2 pt-0.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-sage-500"
                       strokeWidth={1.5} />
          <p className="font-sans text-xs text-stone-500 leading-relaxed">
            Hromadné sťahovanie môže telefón uložiť do Súborov. Pre uloženie priamo
            do galérie odporúčame ukladať fotky jednotlivo.
          </p>
        </div>
      )}
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
  const [data, setData]               = useState<AdminData | null>(null);
  const [trashFiles, setTrashFiles]   = useState<AdminFile[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [toggling, setToggling]       = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // View & filter state
  const [view, setView]           = useState<AdminView>("active");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy]       = useState<SortBy>("newest");
  const [search, setSearch]       = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk delete modal + result
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ deleted: number; failed: number } | null>(null);

  // Bulk download
  const [dlState, setDlState]       = useState<DownloadState>("idle");
  const [dlProgress, setDlProgress] = useState<DownloadProgress>({ current: 0, total: 0 });

  // Mobile save modal
  const [isMobile, setIsMobile]     = useState(false);
  const [mobileFile, setMobileFile] = useState<AdminFile | null>(null);

  // ── Single-file download ─────────────────────────────────────────────────
  // On mobile: open the MobileSaveModal (share sheet + long-press instruction).
  // On desktop: direct blob download.

  const handleSingleDownload = useCallback((file: AdminFile) => {
    if (isMobile) {
      setMobileFile(file);
    } else {
      downloadSingleFile(file.downloadUrl, file.original_file_name);
    }
  }, [isMobile]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelectedIds(new Set());
    try {
      const [filesRes, settingsRes, trashRes] = await Promise.all([
        fetch("/api/admin/files"),
        fetch("/api/admin/settings"),
        fetch("/api/admin/trash"),
      ]);
      if (!filesRes.ok || !settingsRes.ok) throw new Error("Chyba pri načítaní dát");

      const filesData    = await filesRes.json();
      const settingsData = await settingsRes.json();
      const trashData    = trashRes.ok ? await trashRes.json() : { files: [] };

      setData({
        files:          filesData.files,
        stats:          filesData.stats,
        galleryEnabled: settingsData.public_gallery_enabled ?? false,
      });
      setTrashFiles(trashData.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nastala chyba");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setIsMobile(isMobileDevice()); }, []);

  // ── Gallery toggle ────────────────────────────────────────────────────────

  const toggleGallery = async () => {
    if (!data || toggling) return;
    const next = !data.galleryEnabled;
    setToggling(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_gallery_enabled: next }),
      });
      if (!res.ok) throw new Error("Chyba pri zmene nastavení");
      setData((d) => d ? { ...d, galleryEnabled: next } : d);
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
      setData((d) => {
        if (!d) return d;
        const newFiles  = d.files.filter((f) => f.id !== id);
        const deleted   = d.files.find((f) => f.id === id);
        return {
          ...d,
          files: newFiles,
          stats: {
            totalFiles:     newFiles.length,
            totalImages:    newFiles.filter((f) => f.file_type === "image").length,
            totalVideos:    newFiles.filter((f) => f.file_type === "video").length,
            totalSizeBytes: d.stats.totalSizeBytes - (deleted?.file_size ?? 0),
          },
        };
      });
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba pri mazaní");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Bulk download ─────────────────────────────────────────────────────────

  const bulkDownload = async () => {
    const toDownload = (data?.files ?? []).filter((f) => selectedIds.has(f.id));
    if (toDownload.length === 0) return;

    setDlState("preparing");
    await new Promise<void>((r) => setTimeout(r, 400));

    setDlState("downloading");
    setDlProgress({ current: 0, total: toDownload.length });

    await downloadFilesSequentially(
      toDownload,
      600,
      (current, total) => setDlProgress({ current, total })
    );

    setDlState("done");
    // Reset after a few seconds so the bar doesn't stay in "done" forever
    setTimeout(() => setDlState("idle"), 4000);
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
      await fetchData();
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
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba pri obnovovaní");
    } finally {
      setRestoringId(null);
    }
  };

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filteredFiles = (data?.files ?? [])
    .filter((f) => {
      if (typeFilter !== "all" && f.file_type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          f.original_file_name.toLowerCase().includes(q) ||
          (f.guest_name?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return b.file_size - a.file_size;
    });

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect  = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const selectAll      = () => setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const allSelected    = filteredFiles.length > 0 && filteredFiles.every((f) => selectedIds.has(f.id));

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
          onClick={fetchData}
          className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm
                     hover:bg-stone-200 transition-colors font-medium"
        >
          Skúsiť znova
        </button>
      </div>
    );
  }

  if (!data) return null;
  const { stats, galleryEnabled } = data;

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
        <CleanupSection onCleaned={fetchData} />

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
                ? `Aktívne (${data.files.length})`
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
                onClick={fetchData}
                className="p-2.5 border border-stone-200 rounded-xl text-stone-400
                           hover:text-stone-600 hover:bg-stone-50 transition-colors"
                title="Obnoviť"
                aria-label="Obnoviť"
              >
                <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Select-all row */}
            {filteredFiles.length > 0 && (
              <div className="flex items-center gap-3">
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
                    : `Vybrať všetky (${filteredFiles.length})`}
                </button>
              </div>
            )}

            {/* Bulk action bar */}
            <BulkActionBar
              count={selectedIds.size}
              onDelete={bulkDelete}
              onDownload={bulkDownload}
              onClear={() => { clearSelection(); setDlState("idle"); }}
              isDeleting={bulkDeleting}
              downloadState={dlState}
              downloadProgress={dlProgress}
              isMobile={isMobile}
            />

            {/* File list */}
            {filteredFiles.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">
                {search || typeFilter !== "all"
                  ? "Žiadne súbory zodpovedajú filtru"
                  : "Žiadne nahrané súbory"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFiles.map((file) => (
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
