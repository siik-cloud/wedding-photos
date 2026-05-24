/**
 * POST /api/upload/thumbnail
 *
 * Creates a signed PUT URL for uploading a video thumbnail JPEG.
 * Called by the client after a video has been uploaded, before confirm.
 *
 * Thumbnails land in: thumbnails/YYYY/MM/<uuid>.jpg
 * Same bucket as uploads (wedding-uploads), separate prefix.
 *
 * DB migration required:
 *   alter table public.uploads
 *   add column if not exists thumbnail_path text;
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer, BUCKET_NAME } from "@/lib/supabase/server-client";
import { createId } from "@/lib/utils";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB cap — thumbnails should be < 100 KB in practice

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { fileSize?: number };

    if (
      !body.fileSize ||
      typeof body.fileSize !== "number" ||
      body.fileSize <= 0 ||
      body.fileSize > MAX_SIZE
    ) {
      return NextResponse.json(
        { error: "Neplatná veľkosť miniatúry" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServer();
    const now      = new Date();
    const year     = now.getFullYear();
    const month    = String(now.getMonth() + 1).padStart(2, "0");
    const thumbPath = `thumbnails/${year}/${month}/${createId()}.jpg`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(thumbPath);

    if (error || !data) {
      console.error("[upload/thumbnail] Supabase error:", error);
      return NextResponse.json(
        { error: "Nepodarilo sa vytvoriť URL pre miniatúru" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl:     data.signedUrl,
      thumbnailPath: thumbPath,
    });
  } catch (err) {
    console.error("[upload/thumbnail] Error:", err);
    return NextResponse.json({ error: "Interná chyba servera" }, { status: 500 });
  }
}
