import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer, BUCKET_NAME } from "@/lib/supabase/server-client";
import type { ConfirmUploadRequest } from "@/types";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/gif",
  "image/webp", "image/heic", "image/heif",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4", "video/quicktime", "video/x-msvideo",
  "video/x-matroska", "video/webm", "video/mpeg",
];

function getFileType(mimeType: string, fileName: string): "image" | "video" | "other" {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return "video";
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  return "other";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ConfirmUploadRequest;
    const { storagePath, originalFileName, fileSize, mimeType, guestName } = body;

    // Basic validation
    if (!storagePath || typeof storagePath !== "string") {
      return NextResponse.json({ error: "Chýba cesta súboru" }, { status: 400 });
    }
    if (!originalFileName || typeof originalFileName !== "string") {
      return NextResponse.json({ error: "Chýba názov súboru" }, { status: 400 });
    }

    // Sanitise storage path — must match our expected pattern.
    // The ID segment uses UUID (hex+hyphens) in secure contexts, or a base-36
    // fallback (alphanumeric+hyphen) when crypto.randomUUID() is unavailable.
    // Both formats are covered by [A-Za-z0-9_-]+.
    const pathPattern = /^\d{4}\/\d{2}\/[A-Za-z0-9_-]+_.+$/;
    if (!pathPattern.test(storagePath)) {
      return NextResponse.json({ error: "Neplatná cesta súboru" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Check that the file actually exists in storage (prevents phantom records)
    const { data: listData } = await supabase.storage
      .from(BUCKET_NAME)
      .list(storagePath.substring(0, storagePath.lastIndexOf("/")), {
        search: storagePath.substring(storagePath.lastIndexOf("/") + 1),
      });

    if (!listData || listData.length === 0) {
      return NextResponse.json(
        { error: "Súbor nebol nájdený v úložisku. Skús nahrať znova." },
        { status: 400 }
      );
    }

    const safeMime = typeof mimeType === "string" ? mimeType : "application/octet-stream";
    const fileType = getFileType(safeMime, originalFileName);
    const safeGuestName =
      typeof guestName === "string" && guestName.trim()
        ? guestName.trim().slice(0, 100)
        : null;

    // Extract the sanitised file_name from storage path
    const fileName = storagePath.split("/").pop() ?? storagePath;

    // Insert record into uploads table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: record, error: dbError } = await (supabase.from("uploads") as any)
      .insert({
        file_name: fileName,
        original_file_name: originalFileName.slice(0, 500),
        file_type: fileType,
        mime_type: safeMime,
        file_size: typeof fileSize === "number" ? fileSize : 0,
        storage_path: storagePath,
        guest_name: safeGuestName,
      })
      .select("id")
      .single();

    if (dbError) {
      // Unique constraint — the file was already confirmed (double-submit race)
      if (dbError.code === "23505") {
        return NextResponse.json({ success: true, duplicate: true });
      }
      // Missing table — database schema not applied
      if (dbError.code === "42P01") {
        console.error("[upload/confirm] Table 'uploads' does not exist:", dbError);
        return NextResponse.json(
          { error: "Databáza nie je nastavená. Kontaktuj administrátora." },
          { status: 503 }
        );
      }
      // Missing column — schema mismatch / migration not run
      if (dbError.code === "42703") {
        console.error("[upload/confirm] Unknown column in 'uploads':", dbError);
        return NextResponse.json(
          { error: "Chyba schémy databázy. Kontaktuj administrátora." },
          { status: 503 }
        );
      }
      console.error("[upload/confirm] DB error:", dbError);
      return NextResponse.json(
        { error: "Chyba pri ukladaní záznamu" },
        { status: 500 }
      );
    }

    const inserted = record as { id: string } | null;
    return NextResponse.json({ success: true, id: inserted?.id });
  } catch (err) {
    console.error("[upload/confirm] Error:", err);
    return NextResponse.json({ error: "Interná chyba servera" }, { status: 500 });
  }
}
