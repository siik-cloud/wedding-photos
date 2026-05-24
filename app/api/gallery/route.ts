import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServer,
  BUCKET_NAME,
  isGalleryEnabled,
} from "@/lib/supabase/server-client";
import type { Upload, UploadWithUrl } from "@/types";

// Gallery signed URLs expire after 2 hours
const SIGNED_URL_EXPIRY = 2 * 60 * 60;
const PAGE_SIZE = 40;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // Check gallery is enabled
    const enabled = await isGalleryEnabled();
    if (!enabled) {
      return NextResponse.json(
        { error: "Galéria nie je zatiaľ dostupná" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const supabase = getSupabaseServer();

    // Fetch one page of uploads.
    // Try to include thumbnail_path; fall back without it on column-missing (42703).
    let uploads: Upload[] = [];
    let totalCount = 0;

    {
      const withThumb = await supabase
        .from("uploads")
        .select(
          "id, file_name, original_file_name, file_type, mime_type, file_size, storage_path, guest_name, created_at, thumbnail_path",
          { count: "exact" }
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (withThumb.error?.code === "42703") {
        // thumbnail_path column does not exist yet — run the migration:
        // ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
        console.warn("[gallery] thumbnail_path column missing — fetching without it");
        const noThumb = await supabase
          .from("uploads")
          .select(
            "id, file_name, original_file_name, file_type, mime_type, file_size, storage_path, guest_name, created_at",
            { count: "exact" }
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (noThumb.error) {
          console.error("[gallery] DB error:", noThumb.error);
          return NextResponse.json({ error: "Chyba pri načítaní galérie" }, { status: 500 });
        }
        uploads    = (noThumb.data ?? []) as Upload[];
        totalCount = noThumb.count ?? 0;
      } else if (withThumb.error) {
        console.error("[gallery] DB error:", withThumb.error);
        return NextResponse.json({ error: "Chyba pri načítaní galérie" }, { status: 500 });
      } else {
        uploads    = (withThumb.data ?? []) as Upload[];
        totalCount = withThumb.count ?? 0;
      }
    }

    // Are there more pages after this one?
    const hasMore = from + uploads.length < totalCount;

    if (uploads.length === 0) {
      return NextResponse.json({ files: [], hasMore: false });
    }

    // Collect paths that need signing.
    // Images WITH a thumbnail: sign only the thumbnail (the original is fetched lazily
    // by the lightbox via GET /api/gallery/file/[id] — no wasted bandwidth on the grid).
    // Everything else (images without thumbnail, videos, other): sign the original.
    const originalPaths = uploads
      .filter((u) => !(u.file_type === "image" && u.thumbnail_path))
      .map((u) => u.storage_path);

    const thumbPaths = uploads
      .filter((u) => u.thumbnail_path)
      .map((u) => u.thumbnail_path as string);

    const allPaths = [...originalPaths, ...thumbPaths];

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(allPaths, SIGNED_URL_EXPIRY);

    if (signedError || !signedData) {
      console.error("[gallery] Signed URL error:", signedError);
      return NextResponse.json(
        { error: "Chyba pri generovaní odkazov" },
        { status: 500 }
      );
    }

    // Build a map: storagePath → signedUrl
    const urlMap = new Map<string, string>();
    for (const item of signedData) {
      if (item.signedUrl && item.path) {
        urlMap.set(item.path, item.signedUrl);
      }
    }

    // Merge uploads with their signed URLs.
    // Images with thumbnail_path: url="" (original fetched lazily), thumbnailUrl=thumb URL.
    // Everything else: url=original signed URL, thumbnailUrl=thumb URL if available.
    const filesWithUrls: UploadWithUrl[] = uploads
      .map((upload) => {
        if (upload.file_type === "image" && upload.thumbnail_path) {
          // Use thumbnail for grid; lightbox fetches original on demand
          const thumbUrl = urlMap.get(upload.thumbnail_path);
          if (!thumbUrl) return null; // no usable URL — skip this item
          const entry: UploadWithUrl = { ...upload, url: "", downloadUrl: "" };
          entry.thumbnailUrl = thumbUrl;
          return entry;
        }
        // Original URL available (images without thumb, videos, other)
        const url = urlMap.get(upload.storage_path);
        if (!url) return null;
        const entry: UploadWithUrl = { ...upload, url, downloadUrl: url };
        const thumbUrl = upload.thumbnail_path
          ? urlMap.get(upload.thumbnail_path)
          : undefined;
        if (thumbUrl) entry.thumbnailUrl = thumbUrl;
        return entry;
      })
      .filter((f): f is UploadWithUrl => f !== null);

    return NextResponse.json({ files: filesWithUrls, hasMore });
  } catch (err) {
    console.error("[gallery] Error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
