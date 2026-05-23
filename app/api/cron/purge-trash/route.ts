import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer, BUCKET_NAME } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// GET /api/cron/purge-trash
// Called by Vercel Cron (see vercel.json). Permanently deletes files that have
// been in the trash for more than 7 days: removes them from storage, then hard-
// deletes the DB rows.
//
// Protected by a CRON_SECRET bearer token so it cannot be triggered by
// anonymous requests.
export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[purge-trash] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Find stale trash ─────────────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = getSupabaseServer();

    const { data, error: fetchError } = await supabase
      .from("uploads")
      .select("id, storage_path")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    if (fetchError) {
      console.error("[purge-trash] DB fetch error:", fetchError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }

    if (!data || (data as unknown[]).length === 0) {
      console.log("[purge-trash] Nothing to purge");
      return NextResponse.json({ purged: 0 });
    }

    const rows  = data as unknown as { id: string; storage_path: string }[];
    const ids   = rows.map((r) => r.id);
    const paths = rows.map((r) => r.storage_path);

    // ── Delete from storage ──────────────────────────────────────────────────
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(paths);

    if (storageError) {
      // Log but continue — DB cleanup is more important than orphaned storage
      console.error("[purge-trash] Storage remove error:", storageError);
    }

    // ── Hard-delete DB rows ─────────────────────────────────────────────────
    const { error: dbError } = await supabase
      .from("uploads")
      .delete()
      .in("id", ids);

    if (dbError) {
      console.error("[purge-trash] DB delete error:", dbError);
      return NextResponse.json({ error: "DB delete failed" }, { status: 500 });
    }

    console.log(`[purge-trash] Purged ${ids.length} files`);
    return NextResponse.json({ purged: ids.length });
  } catch (err) {
    console.error("[purge-trash] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
