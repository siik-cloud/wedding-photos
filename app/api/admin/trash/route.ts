import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServer, BUCKET_NAME } from "@/lib/supabase/server-client";
import type { Upload, UploadWithUrl } from "@/types";

const SIGNED_URL_EXPIRY = 4 * 60 * 60; // 4 hours

export const dynamic = "force-dynamic";

// GET /api/admin/trash
// Returns files where deleted_at IS NOT NULL with signed URLs and days-remaining info.
export async function GET() {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("uploads")
      .select(
        "id, file_name, original_file_name, file_type, mime_type, file_size, storage_path, guest_name, created_at, deleted_at"
      )
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      console.error("[admin/trash] DB error:", error);
      return NextResponse.json({ error: "Chyba databázy" }, { status: 500 });
    }

    const uploads = (data ?? []) as Upload[];

    if (uploads.length === 0) {
      return NextResponse.json({ files: [] });
    }

    // Batch generate signed URLs
    const paths = uploads.map((u) => u.storage_path);
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(paths, SIGNED_URL_EXPIRY);

    if (signedError || !signedData) {
      console.error("[admin/trash] Signed URL error:", signedError);
      return NextResponse.json(
        { error: "Chyba pri generovaní odkazov" },
        { status: 500 }
      );
    }

    const urlMap = new Map<string, string>();
    for (const item of signedData) {
      if (item.signedUrl && item.path) urlMap.set(item.path, item.signedUrl);
    }

    const now = Date.now();
    const PURGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

    const filesWithUrls = uploads.map((upload) => {
      const deletedMs  = new Date(upload.deleted_at!).getTime();
      const purgeAt    = deletedMs + PURGE_AFTER_MS;
      const daysLeft   = Math.max(0, Math.ceil((purgeAt - now) / (24 * 60 * 60 * 1000)));
      return {
        ...upload,
        url:         urlMap.get(upload.storage_path) ?? "",
        downloadUrl: urlMap.get(upload.storage_path) ?? "",
        daysLeft,
      } as UploadWithUrl & { daysLeft: number };
    });

    return NextResponse.json({ files: filesWithUrls });
  } catch (err) {
    console.error("[admin/trash] Error:", err);
    return NextResponse.json({ error: "Interná chyba servera" }, { status: 500 });
  }
}
