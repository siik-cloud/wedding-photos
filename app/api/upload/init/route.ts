import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer, BUCKET_NAME } from "@/lib/supabase/server-client";
import { createId } from "@/lib/utils";
import type { InitUploadRequest } from "@/types";

// Maximum file sizes
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;   // 25 MB
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;  // 250 MB
const MAX_FILES_PER_BATCH = 30;

// Allowed MIME types (server-side validation)
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",      // .mov
  "video/x-msvideo",     // .avi
  "video/x-matroska",    // .mkv
  "video/webm",
  "video/mpeg",
]);

// Detect kind from both MIME and extension
function detectKind(
  mimeType: string,
  fileName: string
): "image" | "video" | null {
  if (ALLOWED_IMAGE_TYPES.has(mimeType)) return "image";
  if (ALLOWED_VIDEO_TYPES.has(mimeType)) return "video";

  // Fall back to extension check (helps with HEIC on iOS)
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].includes(ext))
    return "image";
  if (["mp4", "mov", "avi", "mkv", "webm", "mpeg"].includes(ext))
    return "video";

  return null;
}

function sanitizeFileName(name: string): string {
  // Remove path separators and dangerous characters, keep extension
  return name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 200);
}

// Simple in-request rate limiting header check
function extractIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as InitUploadRequest;
    const { fileName, fileSize, mimeType, guestName } = body;

    // ── Validate inputs ──────────────────────────────────────────────────────
    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        { error: "Chýba názov súboru" },
        { status: 400 }
      );
    }

    if (!fileSize || typeof fileSize !== "number" || fileSize <= 0) {
      return NextResponse.json(
        { error: "Neplatná veľkosť súboru" },
        { status: 400 }
      );
    }

    if (guestName && typeof guestName === "string" && guestName.length > 100) {
      return NextResponse.json({ error: "Meno je príliš dlhé" }, { status: 400 });
    }

    const safeMime = typeof mimeType === "string" ? mimeType : "";
    const kind = detectKind(safeMime, fileName);

    if (!kind) {
      return NextResponse.json(
        {
          error:
            "Nepodporovaný formát súboru. Akceptujeme fotky (JPEG, PNG, HEIC, WebP) a videá (MP4, MOV, AVI).",
        },
        { status: 400 }
      );
    }

    const maxSize = kind === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (fileSize > maxSize) {
      return NextResponse.json(
        {
          error: `Súbor je príliš veľký. Maximum pre ${kind === "video" ? "video je 250 MB" : "fotku je 25 MB"}.`,
        },
        { status: 400 }
      );
    }

    // ── Duplicate detection ──────────────────────────────────────────────────
    // If the same filename was uploaded within the last 30 minutes, skip.
    const supabase = getSupabaseServer();
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("uploads")
      .select("id")
      .eq("original_file_name", fileName)
      .is("deleted_at", null)
      .gte("created_at", thirtyMinsAgo)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ isDuplicate: true }, { status: 409 });
    }

    // ── Build safe storage path ──────────────────────────────────────────────
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const uniqueId = createId();
    const safeFileName = sanitizeFileName(fileName);
    const storagePath = `${year}/${month}/${uniqueId}_${safeFileName}`;

    // ── Create signed upload URL (server uses service role) ──────────────────
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error("[upload/init] Supabase storage error:", error);
      const msg = (error?.message ?? "").toLowerCase();
      if (msg.includes("not found") || msg.includes("no such bucket") || msg.includes("bucket")) {
        return NextResponse.json(
          { error: "Úložisko nie je nastavené. Kontaktuj administrátora." },
          { status: 503 }
        );
      }
      if (msg.includes("quota") || msg.includes("limit") || msg.includes("capacity") || msg.includes("full")) {
        return NextResponse.json(
          { error: "Úložisko je plné. Kontaktuj organizátora svadby." },
          { status: 507 }
        );
      }
      return NextResponse.json(
        { error: "Nepodarilo sa pripraviť nahrávanie. Skús znova." },
        { status: 500 }
      );
    }

    // Log for abuse monitoring (IP + file metadata, no content)
    const ip = extractIp(req);
    console.log(
      `[upload/init] ip=${ip} kind=${kind} size=${fileSize} file=${fileName}`
    );

    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
    });
  } catch (err) {
    console.error("[upload/init] Error:", err);
    // Missing env vars — getSupabaseServer() throws with a descriptive message
    if (err instanceof Error && err.message.includes("Missing environment variable")) {
      return NextResponse.json(
        { error: "Aplikácia nie je správne nakonfigurovaná. Kontaktuj administrátora." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
