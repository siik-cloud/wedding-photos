import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServer, BUCKET_NAME } from "@/lib/supabase/server-client";
import type { Upload, UploadWithUrl, AdminStats } from "@/types";

const SIGNED_URL_EXPIRY = 4 * 60 * 60; // 4 hours for admin
const PAGE_SIZE = 40;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
    const type  = searchParams.get("type") ?? "all";    // all | image | video
    const sort  = searchParams.get("sort") ?? "newest"; // newest | oldest | largest
    const q     = (searchParams.get("q") ?? "").trim(); // text search
    const from  = page * PAGE_SIZE;
    const to    = from + PAGE_SIZE - 1;

    const supabase = getSupabaseServer();

    // ── Global stats (page 0 only) ──────────────────────────────────────────
    // Stats are always unfiltered — show totals across all active files regardless
    // of whatever type/search filter is currently active.
    let stats: AdminStats | undefined;
    if (page === 0) {
      const { data: sd } = await supabase
        .from("uploads")
        .select("file_type, file_size")
        .is("deleted_at", null);

      // Cast: Supabase may not narrow the row shape without generated DB types
      const rows = (sd ?? []) as { file_type: string; file_size: number }[];
      stats = {
        totalFiles:     rows.length,
        totalImages:    rows.filter((r) => r.file_type === "image").length,
        totalVideos:    rows.filter((r) => r.file_type === "video").length,
        totalSizeBytes: rows.reduce((s, r) => s + (r.file_size ?? 0), 0),
      };
    }

    // ── Build paginated, filtered query ─────────────────────────────────────
    // Uses `any` because Supabase's TS generics get unwieldy when the query is
    // built conditionally; the actual shape is well-typed at the call sites below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildQuery = (cols: string): any => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let qb: any = supabase
        .from("uploads")
        .select(cols, { count: "exact" })
        .is("deleted_at", null);

      // Type filter
      if (type !== "all") qb = qb.eq("file_type", type);

      // Full-text search across file name and guest name
      if (q) {
        qb = qb.or(
          `original_file_name.ilike.%${q}%,guest_name.ilike.%${q}%`
        );
      }

      // Sort
      if (sort === "oldest") {
        qb = qb.order("created_at", { ascending: true });
      } else if (sort === "largest") {
        qb = qb.order("file_size", { ascending: false });
      } else {
        qb = qb.order("created_at", { ascending: false }); // newest (default)
      }

      return qb.range(from, to);
    };

    // Fetch uploads — try with thumbnail_path, fall back without if column is missing
    let uploads: Upload[] = [];
    let totalCount = 0;
    {
      const withThumb = await buildQuery(
        "id, file_name, original_file_name, file_type, mime_type, file_size, storage_path, guest_name, created_at, deleted_at, thumbnail_path"
      );

      if (withThumb.error?.code === "42703") {
        console.warn("[admin/files] thumbnail_path column missing — fetching without it");
        const noThumb = await buildQuery(
          "id, file_name, original_file_name, file_type, mime_type, file_size, storage_path, guest_name, created_at, deleted_at"
        );

        if (noThumb.error) {
          console.error("[admin/files] DB error:", noThumb.error);
          return NextResponse.json({ error: "Chyba databázy" }, { status: 500 });
        }
        uploads    = (noThumb.data ?? []) as Upload[];
        totalCount = noThumb.count ?? 0;
      } else if (withThumb.error) {
        console.error("[admin/files] DB error:", withThumb.error);
        return NextResponse.json({ error: "Chyba databázy" }, { status: 500 });
      } else {
        uploads    = (withThumb.data ?? []) as Upload[];
        totalCount = withThumb.count ?? 0;
      }
    }

    const hasMore = from + uploads.length < totalCount;

    if (uploads.length === 0) {
      return NextResponse.json({ files: [], stats, hasMore: false, total: totalCount });
    }

    // ── Signed URLs ─────────────────────────────────────────────────────────
    const thumbPaths = uploads
      .filter((u) => u.thumbnail_path)
      .map((u) => u.thumbnail_path as string);

    const allPaths = [...uploads.map((u) => u.storage_path), ...thumbPaths];

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(allPaths, SIGNED_URL_EXPIRY);

    if (signedError || !signedData) {
      console.error("[admin/files] Signed URL error:", signedError);
      return NextResponse.json(
        { error: "Chyba pri generovaní odkazov" },
        { status: 500 }
      );
    }

    // Build map: storagePath → signedUrl
    const urlMap = new Map<string, string>();
    for (const item of signedData) {
      if (item.signedUrl && item.path) {
        urlMap.set(item.path, item.signedUrl);
      }
    }

    const filesWithUrls: UploadWithUrl[] = uploads.map((upload) => {
      const entry: UploadWithUrl = {
        ...upload,
        url:         urlMap.get(upload.storage_path) ?? "",
        downloadUrl: urlMap.get(upload.storage_path) ?? "",
      };
      const thumbUrl = upload.thumbnail_path
        ? urlMap.get(upload.thumbnail_path)
        : undefined;
      if (thumbUrl) entry.thumbnailUrl = thumbUrl;
      return entry;
    });

    return NextResponse.json({ files: filesWithUrls, stats, hasMore, total: totalCount });
  } catch (err) {
    console.error("[admin/files] Error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
