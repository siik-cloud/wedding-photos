import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase-server";

const MAX_BULK = 100;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /api/admin/files/bulk  { ids: string[] }
// Soft-deletes (sets deleted_at) up to MAX_BULK active files.
export async function DELETE(req: NextRequest) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ids: unknown;
  try {
    const body = await req.json();
    ids = body?.ids;
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Chýba zoznam ID" }, { status: 400 });
  }

  if (ids.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Môžeš vymazať najviac ${MAX_BULK} súborov naraz` },
      { status: 400 }
    );
  }

  // Validate every id is a UUID string
  for (const id of ids) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "Neplatné ID v zozname" }, { status: 400 });
    }
  }

  try {
    const supabase = getSupabaseServer();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase.from("uploads") as any)
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids as string[])
      .is("deleted_at", null); // only touch active files

    if (error) {
      console.error("[admin/files/bulk] DB error:", error);
      return NextResponse.json({ error: "Chyba databázy" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: count ?? ids.length });
  } catch (err) {
    console.error("[admin/files/bulk] Error:", err);
    return NextResponse.json({ error: "Interná chyba servera" }, { status: 500 });
  }
}
