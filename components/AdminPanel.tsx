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
} from "lucide-react";
import type { UploadWithUrl, AdminStats } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminView = "active" | "trash";
type SortBy    = "newest" | "oldest" | "largest";
type TypeFilter = "all" | "image" | "video";

interface AdminFile extends UploadWithUrl {
  url: string;
  downloadUrl: string;
  daysLeft?: number; // trash only
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
  if (bytes < 1024 ** 3)    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("sk-SK", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── StorageHealth ────────────────────────────────────────────────────────────

const QUOTA_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB free tier
const WARN_PCT    = 75;

function StorageHealth({ usedBytes }: { usedBytes: number }) {
  const pct  = Math.min(100, (usedBytes / QUOTA_BYTES) * 100);
  const warn = pct >= WARN_PCT;
  const crit = pct >= 90;

  const barColor = crit   ? "bg-red-500"
                 : warn   ? "bg-amber-400"
                 : "bg-sage-400";

  const textColor = crit  ? "text-red-700"
                  : warn  ? "text-amber-700"
                  : "text-gray-700";

  return (
    <div className={`rounded-xl border p-4 ${crit ? "bg-red-50 border-red-200" : warn ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HardDrive className={`w-4 h-4 ${textColor}`} />
          <span className={`text-sm font-semibold ${textColor}`}>Úložisko</span>
        </div>
        <span className={`text-xs font-bold ${textColor}`}>
          {fmtSize(usedBytes)} / {fmtSize(QUOTA_BYTES)}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {warn && (
        <p className={`text-xs mt-2 ${textColor}`}>
          {crit
            ? "⛔ Úložisko je takmer plné! Vymaž nepotrebné súbory."
            : "⚠️ Úložisko je z 75 % plné. Zvažuj vymazanie testovacích súborov."}
        </p>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, emoji }: { label: string; value: string | number; emoji?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
        {emoji && <span className="mr-1">{emoji}</span>}
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
    </div>
  );
}

// ─── BulkActionBar ────────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  onDelete,
  onClear,
  isDeleting,
}: {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-xl
                    px-4 py-3 flex items-center gap-3 shadow-sm">
      <span className="text-sm font-semibold text-gray-700 flex-1">
        Vybrané: {count}
      </span>
      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg
                   text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
      >
        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Vymazať ({count})
      </button>
      <button
        onClick={onClear}
        className="px-3 py-2 border border-gray-200 text-gray-500 rounded-lg text-sm
                   hover:bg-gray-50 transition-colors"
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
  isDeleting,
}: {
  file: AdminFile;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 flex items-center gap-3 transition-colors
                  ${selected ? "border-sage-300 bg-sage-50" : "border-gray-100"}`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        aria-label={selected ? "Odznačiť" : "Vybrať"}
        className="flex-shrink-0 text-gray-300 hover:text-sage-500 transition-colors"
      >
        {selected
          ? <CheckSquare className="w-5 h-5 text-sage-500" />
          : <Square       className="w-5 h-5" />}
      </button>

      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {file.file_type === "image" && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : file.file_type === "video" ? (
          <Video className="w-5 h-5 text-blue-400" />
        ) : (
          <ImageIcon className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate" title={file.original_file_name}>
          {file.file_type === "image" ? (
            <ImageIcon className="inline w-3.5 h-3.5 mr-1 text-sage-400" />
          ) : (
            <Video className="inline w-3.5 h-3.5 mr-1 text-blue-400" />
          )}
          {file.original_file_name}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-400">
          {file.guest_name && (
            <span className="text-gray-600 font-medium">👤 {file.guest_name}</span>
          )}
          <span>{fmtSize(file.file_size)}</span>
          <span>{fmtDate(file.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={file.downloadUrl}
          download={file.original_file_name}
          className="p-2 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
          title="Stiahnuť"
          aria-label="Stiahnuť"
        >
          <Download className="w-4 h-4" />
        </a>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          title="Presunúť do koša"
          aria-label="Presunúť do koša"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 opacity-80">
      {/* Thumbnail */}
      <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {file.file_type === "image" && file.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" className="w-full h-full object-cover grayscale" loading="lazy" />
        ) : file.file_type === "video" ? (
          <Video className="w-5 h-5 text-gray-300" />
        ) : (
          <ImageIcon className="w-5 h-5 text-gray-300" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-500 truncate">{file.original_file_name}</p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-gray-400">
          {file.guest_name && <span>👤 {file.guest_name}</span>}
          <span>{fmtSize(file.file_size)}</span>
          {file.daysLeft !== undefined && (
            <span className={file.daysLeft <= 1 ? "text-red-400 font-semibold" : "text-gray-400"}>
              🗑 Vymaže sa o {file.daysLeft} {file.daysLeft === 1 ? "deň" : file.daysLeft < 5 ? "dni" : "dní"}
            </span>
          )}
        </div>
      </div>

      {/* Restore */}
      <button
        onClick={onRestore}
        disabled={isRestoring}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-500
                   rounded-lg text-xs font-semibold hover:bg-green-50 hover:border-green-300
                   hover:text-green-700 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
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
      setResult(`✅ Vymazaných ${data.deleted} súborov.`);
      setPreview(null);
      onCleaned();
    } catch {
      setError("Chyba pri mazaní — skús znova.");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
      <h3 className="font-bold text-orange-800 mb-1">🧹 Vymazať test uploady</h3>
      <p className="text-sm text-orange-700 leading-relaxed mb-4">
        Vymaže súbory označené ako testové
        {preview?.weddingStartTimestamp && (
          <> alebo nahrané pred{" "}
            <strong>
              {new Date(preview.weddingStartTimestamp).toLocaleDateString("sk-SK")}
            </strong>
          </>
        )}.
        Skutočné svadobné fotky sú v bezpečí.
      </p>

      {result && (
        <p className="text-sm text-green-700 bg-white border border-green-200 rounded-xl px-3 py-2 mb-3">
          {result}
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!preview ? (
        <button
          onClick={loadPreview}
          disabled={previewing}
          className="px-5 py-2.5 border border-orange-300 text-orange-700 rounded-xl
                     hover:bg-orange-100 text-sm font-semibold transition-colors
                     disabled:opacity-50 flex items-center gap-2"
        >
          {previewing && <Loader2 className="w-4 h-4 animate-spin" />}
          {previewing ? "Počítam..." : "Zobraziť, čo sa vymaže"}
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-orange-800">
            {preview.count === 0
              ? "✅ Žiadne testovacie súbory na vymazanie."
              : `Bude vymazaných ${preview.count} súborov:`}
          </p>

          {preview.count > 0 && (
            <ul className="text-xs text-orange-700 space-y-0.5 bg-white border border-orange-200 rounded-xl p-3 max-h-32 overflow-y-auto">
              {preview.files.slice(0, 20).map((f) => (
                <li key={f.id} className="truncate">
                  • {f.name}{" "}
                  <span className="text-orange-400">
                    ({new Date(f.created_at).toLocaleDateString("sk-SK")})
                  </span>
                </li>
              ))}
              {preview.count > 20 && (
                <li className="text-orange-400">… a ďalších {preview.count - 20}</li>
              )}
            </ul>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {preview.count > 0 && (
              <button
                onClick={executeCleanup}
                disabled={cleaning}
                className="px-5 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600
                           text-sm font-bold transition-colors disabled:opacity-50
                           flex items-center gap-2"
              >
                {cleaning && <Loader2 className="w-4 h-4 animate-spin" />}
                {cleaning ? "Mažem..." : "Vymazať test uploady"}
              </button>
            )}
            <button
              onClick={() => { setPreview(null); setResult(null); setError(""); }}
              className="text-sm text-orange-500 hover:text-orange-700 transition-colors"
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
  const [data, setData]                 = useState<AdminData | null>(null);
  const [trashFiles, setTrashFiles]     = useState<AdminFile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [toggling, setToggling]         = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [restoringId, setRestoringId]   = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // View & filter state
  const [view, setView]         = useState<AdminView>("active");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortBy, setSortBy]     = useState<SortBy>("newest");
  const [search, setSearch]     = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    if (!confirm(`Presunúť "${name}" do koša?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/files/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Chyba pri mazaní");
      }
      setData((d) => {
        if (!d) return d;
        const newFiles   = d.files.filter((f) => f.id !== id);
        const deleted    = d.files.find((f) => f.id === id);
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

  // ── Bulk delete ───────────────────────────────────────────────────────────

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Presunúť ${selectedIds.size} súborov do koša?`)) return;
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/admin/files/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Chyba pri mazaní");
      }
      // Refresh everything
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba pri hromadnom mazaní");
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
      // Refresh active list to include the restored file
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Chyba pri obnovovaní");
    } finally {
      setRestoringId(null);
    }
  };

  // ── Filter + sort logic ───────────────────────────────────────────────────

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
      return b.file_size - a.file_size; // largest
    });

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredFiles.map((f) => f.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const allSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedIds.has(f.id));

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
        <Loader2 className="w-6 h-6 text-sage-400 animate-spin" />
        Načítava sa…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-sage-100 text-sage-700 rounded-lg hover:bg-sage-200"
        >
          Skúsiť znova
        </button>
      </div>
    );
  }

  if (!data) return null;
  const { stats, galleryEnabled } = data;

  return (
    <div className="space-y-6">
      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Spolu" value={stats.totalFiles} />
        <StatCard label="Fotky"  value={stats.totalImages} emoji="📷" />
        <StatCard label="Videá"  value={stats.totalVideos} emoji="🎬" />
        <StatCard label="Veľkosť" value={fmtSize(stats.totalSizeBytes)} />
      </div>

      {/* ── Storage health ─────────────────────────────────────────────── */}
      <StorageHealth usedBytes={stats.totalSizeBytes} />

      {/* ── Gallery toggle ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-gray-800">Verejná galéria</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {galleryEnabled
                ? "✅ Galéria je verejne dostupná na /gallery"
                : "🔒 Galéria je skrytá — len admin ju vidí"}
            </p>
          </div>
          <button
            onClick={toggleGallery}
            disabled={toggling}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200
                       hover:bg-gray-50 transition-colors font-semibold text-sm
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {toggling ? (
              <Loader2 className="w-5 h-5 animate-spin text-sage-500" />
            ) : galleryEnabled ? (
              <ToggleRight className="w-6 h-6 text-sage-500" />
            ) : (
              <ToggleLeft className="w-6 h-6 text-gray-400" />
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
            <ExternalLink className="w-3.5 h-3.5" />
            Otvoriť galériu
          </a>
        )}
      </div>

      {/* ── Download all note ──────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        <p className="font-bold mb-1">💡 Stiahnuť všetky súbory naraz</p>
        <p className="text-blue-700 leading-relaxed">
          Odporúčame použiť <strong>Supabase Storage dashboard</strong> → Storage →
          wedding-uploads. Prípadne Supabase CLI:{" "}
          <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">
            supabase storage cp --recursive ss:///wedding-uploads ./svadobne-fotky
          </code>
        </p>
      </div>

      {/* ── Cleanup section ────────────────────────────────────────────── */}
      <CleanupSection onCleaned={fetchData} />

      {/* ── View tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => { setView("active"); setSelectedIds(new Set()); }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                      ${view === "active" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Aktívne ({data.files.length})
        </button>
        <button
          onClick={() => { setView("trash"); setSelectedIds(new Set()); }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                      ${view === "trash" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          Kôš ({trashFiles.length})
        </button>
      </div>

      {/* ── Active files view ──────────────────────────────────────────── */}
      {view === "active" && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Meno / súbor…"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm
                           focus:outline-none focus:ring-2 focus:ring-sage-300 bg-white"
              />
            </div>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-sage-300 text-gray-700"
            >
              <option value="all">Všetko</option>
              <option value="image">📷 Fotky</option>
              <option value="video">🎬 Videá</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-sage-300 text-gray-700"
            >
              <option value="newest">Najnovšie</option>
              <option value="oldest">Najstaršie</option>
              <option value="largest">Najväčšie</option>
            </select>

            {/* Refresh */}
            <button
              onClick={fetchData}
              className="p-2.5 border border-gray-200 rounded-xl text-gray-400
                         hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="Obnoviť"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Select-all row */}
          {filteredFiles.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={allSelected ? clearSelection : selectAll}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {allSelected
                  ? <CheckSquare className="w-4 h-4 text-sage-500" />
                  : <Square       className="w-4 h-4" />}
                {allSelected ? "Odznačiť všetky" : `Vybrať všetky (${filteredFiles.length})`}
              </button>
            </div>
          )}

          {/* Bulk action bar */}
          <BulkActionBar
            count={selectedIds.size}
            onDelete={bulkDelete}
            onClear={clearSelection}
            isDeleting={bulkDeleting}
          />

          {/* File list */}
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
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
                  isDeleting={deletingId === file.id}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Trash view ─────────────────────────────────────────────────── */}
      {view === "trash" && (
        <>
          <p className="text-sm text-gray-500">
            Súbory v koši sa automaticky natrvalo vymažú po 7 dňoch.
          </p>

          {trashFiles.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
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
  );
}
