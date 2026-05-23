import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase-server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authed = await isAdminAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Chýba ID súboru" }, { status: 400 });
  }

  // Validate it's a UUID
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServer();

    // Get the file record first
    const { data: upload, error: fetchError } = await supabase
      .from("uploads")
      .select("id, storage_path")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json(
        { error: "Súbor nebol nájdený" },
        { status: 404 }
      );
    }

    // Soft delete only — move to trash.
    // Storage file is kept so the file can be restored.
    // The purge-trash cron deletes storage after 7 days.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await (supabase.from("uploads") as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (dbError) {
      console.error("[admin/delete] DB error:", dbError);
      return NextResponse.json(
        { error: "Chyba pri mazaní záznamu" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/delete] Error:", err);
    return NextResponse.json(
      { error: "Interná chyba servera" },
      { status: 500 }
    );
  }
}
