import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServer, BUCKET_NAME } from "@/lib/supabase/server-client";
import type { Upload, UploadWithUrl, AdminStats } from "@/types";

const SIGNED_URL_EXPIRY = 4 * 60 * 60; // 4 hours for admin

export const dynamic = "force-dynamic";

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
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/files] DB error:", error);
      return NextResponse.json({ error: "Chyba databázy" }, { status: 500 });
    }

    const uploads = (data ?? []) as Upload[];

    // Build stats
    const stats: AdminStats = {
      totalFiles: uploads.length,
      totalImages: uploads.filter((u) => u.file_type === "image").length,
      totalVideos: uploads.filter((u) => u.file_type === "video").length,
      totalSizeBytes: uploads.reduce((sum, u) => sum + (u.file_size ?? 0), 0),
    };

    if (uploads.length === 0) {
      return NextResponse.json({ files: [], stats });
    }

    // Batch generate signed URLs — one API call for all files
    const paths = uploads.map((u) => u.storage_path);
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(paths, SIGNED_URL_EXPIRY);

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

    const filesWithUrls: UploadWithUrl[] = uploads.map((upload) => ({
      ...upload,
      url: urlMap.get(upload.storage_path) ?? "",
      downloadUrl: urlMap.get(upload.storage_path) ?? "",
    }));

    return NextResponse.json({ files: filesWithUrls, stats });
  } catch (err) {
    console.error("[admin/files] Error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
