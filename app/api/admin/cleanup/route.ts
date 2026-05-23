/**
 * Admin cleanup API — safely deletes only test/pre-wedding uploads.
 *
 * Deletes files where:
 *   is_test = true
 *   OR created_at < WEDDING_START_TIMESTAMP   (if env var is set)
 *
 * Never blindly deletes all files.
 *
 * GET  → preview (count + list), no deletion
 * DELETE → execute the cleanup
 */

import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSupabaseServer, BUCKET_NAME } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// ─── Helper ──────────────────────────────────────────────────────────────────

function getWeddingStart(): Date | null {
  const ts = process.env.WEDDING_START_TIMESTAMP;
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

/** Build a Supabase query that targets only test/pre-wedding uploads. */
function buildCleanupQuery(
  supabase: ReturnType<typeof getSupabaseServer>,
  weddingStart: Date | null
) {
  const base = supabase
    .from("uploads")
    .select("id, original_file_name, file_size, created_at, is_test, storage_path")
    .is("deleted_at", null);

  if (weddingStart) {
    // Delete is_test files OR anything uploaded before the wedding started
    return base.or(
      `is_test.eq.true,created_at.lt.${weddingStart.toISOString()}`
    );
  }
  // No timestamp configured — only delete explicitly-flagged test files
  return base.eq("is_test", true);
}

// ─── GET: preview ─────────────────────────────────────────────────────────────

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServer();
    const weddingStart = getWeddingStart();

    const { data, error } = await buildCleanupQuery(supabase, weddingStart);
    if (error) throw error;

    const files = (data ?? []).map((f) => ({
      id: f.id,
      name: f.original_file_name,
      size: f.file_size,
      created_at: f.created_at,
      is_test: f.is_test,
    }));

    return NextResponse.json({
      count: files.length,
      files,
      weddingStartTimestamp: weddingStart?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[admin/cleanup] GET error:", err);
    return NextResponse.json({ error: "Chyba servera" }, { status: 500 });
  }
}

// ─── DELETE: execute ──────────────────────────────────────────────────────────

export async function DELETE() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseServer();
    const weddingStart = getWeddingStart();

    // 1. Find target files
    const { data: targets, error: fetchErr } = await buildCleanupQuery(
      supabase,
      weddingStart
    );
    if (fetchErr) throw fetchErr;

    if (!targets || targets.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    // 2. Remove from storage (best-effort — don't abort if some files are missing)
    const paths = targets.map((f) => f.storage_path);
    const { error: storageErr } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(paths);

    if (storageErr) {
      console.warn("[admin/cleanup] Storage remove had errors:", storageErr);
      // Continue with DB soft-delete regardless
    }

    // 3. Soft-delete in database
    const ids = targets.map((f) => f.id);
    const { error: dbErr } = await supabase
      .from("uploads")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", ids);

    if (dbErr) throw dbErr;

    console.log(`[admin/cleanup] Deleted ${ids.length} test uploads`);
    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    console.error("[admin/cleanup] DELETE error:", err);
    return NextResponse.json({ error: "Chyba pri mazaní" }, { status: 500 });
  }
}
