import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase-server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/files/[id]/restore
// Restores a soft-deleted file by setting deleted_at = NULL.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();

    // Confirm the file exists in trash
    const { data: upload, error: fetchError } = await supabase
      .from("uploads")
      .select("id")
      .eq("id", id)
      .not("deleted_at", "is", null)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json(
        { error: "Súbor nebol nájdený v koši" },
        { status: 404 }
      );
    }

    // Restore: clear deleted_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("uploads") as any)
      .update({ deleted_at: null })
      .eq("id", id);

    if (updateError) {
      console.error("[admin/restore] DB error:", updateError);
      return NextResponse.json(
        { error: "Chyba pri obnovovaní súboru" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/restore] Error:", err);
    return NextResponse.json({ error: "Interná chyba servera" }, { status: 500 });
  }
}
