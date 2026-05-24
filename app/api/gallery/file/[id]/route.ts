import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServer,
  BUCKET_NAME,
  isGalleryEnabled,
} from "@/lib/supabase/server-client";

// Matches the gallery page's signed URL lifetime (2 hours).
const SIGNED_URL_EXPIRY = 2 * 60 * 60;

export const dynamic = "force-dynamic";

/**
 * GET /api/gallery/file/[id]
 *
 * Returns a fresh signed URL for the *original* file.
 * Used by the lightbox when the gallery API intentionally omits the original URL
 * for images that already have a thumbnail (to save bandwidth on the grid view).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const enabled = await isGalleryEnabled();
    if (!enabled) {
      return NextResponse.json(
        { error: "Galéria nie je zatiaľ dostupná" },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Chýba ID súboru" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data: uploadRaw, error: dbError } = await supabase
      .from("uploads")
      .select("id, storage_path")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (dbError || !uploadRaw) {
      return NextResponse.json({ error: "Súbor nebol nájdený" }, { status: 404 });
    }

    const upload = uploadRaw as { id: string; storage_path: string };

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(upload.storage_path, SIGNED_URL_EXPIRY);

    if (signedError || !signedData?.signedUrl) {
      console.error("[gallery/file] Signed URL error:", signedError);
      return NextResponse.json(
        { error: "Chyba pri generovaní odkazu" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signedData.signedUrl });
  } catch (err) {
    console.error("[gallery/file] Error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
