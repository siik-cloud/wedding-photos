import { NextResponse } from "next/server";
import {
  getSupabaseServer,
  BUCKET_NAME,
  isGalleryEnabled,
} from "@/lib/supabase/server-client";
import type { Upload, UploadWithUrl } from "@/types";

// Gallery signed URLs expire after 2 hours
const SIGNED_URL_EXPIRY = 2 * 60 * 60;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check gallery is enabled
    const enabled = await isGalleryEnabled();
    if (!enabled) {
      return NextResponse.json(
        { error: "Galéria nie je zatiaľ dostupná" },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServer();

    // Fetch all non-deleted uploads.
    // Try to include thumbnail_path (requires DB migration); fall back without it
    // so existing installs keep working before the migration is applied.
    let uploads: Upload[] = [];
    {
      const withThumb = await supabase
        .from("uploads")
        .select(
          "id, file_name, original_file_name, file_type, mime_type, file_size, storage_path, guest_name, created_at, thumbnail_path"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (withThumb.error?.code === "42703") {
        // thumbnail_path column does not exist yet — run the migration:
        // ALTER TABLE public.uploads ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
        console.warn("[gallery] thumbnail_path column missing — fetching without it");
        const noThumb = await supabase
          .from("uploads")
          .select(
            "id, file_name, original_file_name, file_type, mime_type, file_size, storage_path, guest_name, created_at"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (noThumb.error) {
          console.error("[gallery] DB error:", noThumb.error);
          return NextResponse.json({ error: "Chyba pri načítaní galérie" }, { status: 500 });
        }
        // Cast: thumbnail_path will be undefined — treat as null downstream
        uploads = (noThumb.data ?? []) as Upload[];
      } else if (withThumb.error) {
        console.error("[gallery] DB error:", withThumb.error);
        return NextResponse.json({ error: "Chyba pri načítaní galérie" }, { status: 500 });
      } else {
        uploads = (withThumb.data ?? []) as Upload[];
      }
    }

    if (uploads.length === 0) {
      return NextResponse.json({ files: [] });
    }

    // Collect all storage paths that need signing:
    //   - the main upload file (always)
    //   - the thumbnail JPEG (only for videos with a pre-generated thumbnail)
    const thumbPaths = uploads
      .filter((u) => u.thumbnail_path)
      .map((u) => u.thumbnail_path as string);

    const allPaths = [...uploads.map((u) => u.storage_path), ...thumbPaths];

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
    // Build each entry as UploadWithUrl directly so TypeScript sees the correct
    // optional type for thumbnailUrl (?: string) instead of (: string | undefined).
    const filesWithUrls: UploadWithUrl[] = uploads
      .map((upload) => {
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

    return NextResponse.json({ files: filesWithUrls });
  } catch (err) {
    console.error("[gallery] Error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
