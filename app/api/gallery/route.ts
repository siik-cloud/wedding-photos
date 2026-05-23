import { NextResponse } from "next/server";
import {
  getSupabaseServer,
  BUCKET_NAME,
  isGalleryEnabled,
} from "@/lib/supabase-server";
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

    // Fetch all non-deleted uploads
    const { data, error } = await supabase
      .from("uploads")
      .select(
        "id, file_name, original_file_name, file_type, mime_type, file_size, storage_path, guest_name, created_at"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[gallery] DB error:", error);
      return NextResponse.json(
        { error: "Chyba pri načítaní galérie" },
        { status: 500 }
      );
    }

    const uploads = (data ?? []) as Upload[];

    if (uploads.length === 0) {
      return NextResponse.json({ files: [] });
    }

    // Use batch signed URL generation — one API call for all files
    const paths = uploads.map((u) => u.storage_path);
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(paths, SIGNED_URL_EXPIRY);

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

    // Merge uploads with their signed URLs
    const filesWithUrls: UploadWithUrl[] = uploads
      .map((upload) => {
        const url = urlMap.get(upload.storage_path);
        if (!url) return null;
        return {
          ...upload,
          url,
          downloadUrl: url, // same URL works for both viewing and downloading
        };
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
