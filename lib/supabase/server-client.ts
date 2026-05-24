/**
 * Server-side Supabase client
 *
 * Uses the SECRET key — bypasses RLS, full database and storage access.
 * NEVER import this in client components or expose it to the browser.
 *
 * Use for:
 *   - All admin operations (delete, restore, bulk delete, cleanup)
 *   - Signed URL generation
 *   - Storage management
 *   - Database writes from API routes
 *   - Gallery and upload confirmation (server-side)
 *
 * Import path: @/lib/supabase/server-client
 */

import { createClient } from "@supabase/supabase-js";

// ─── Env validation (fail fast) ───────────────────────────────────────────────

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[supabase/server-client] Missing environment variable: ${name}. ` +
      "Set it in .env.local (development) and in Vercel environment variables (production)."
    );
  }
  return value;
}

// ─── Singleton client ─────────────────────────────────────────────────────────

let _client: ReturnType<typeof createClient> | null = null;

/**
 * Returns the server-side Supabase client (lazy singleton).
 * Throws immediately if SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_URL is missing.
 */
export function getSupabaseServer() {
  if (_client) return _client;

  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = getEnv("SUPABASE_SECRET_KEY");

  _client = createClient(url, key, {
    auth: {
      // Server-side: no session management needed
      autoRefreshToken: false,
      persistSession:   false,
    },
  });

  return _client;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const BUCKET_NAME = "wedding-uploads";

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Generate a single signed URL for viewing/downloading a file.
 * Prefer createSignedUrls() for batches.
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data) return null;
  return data.signedUrl;
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

/**
 * Read a single value from the settings table.
 * Returns null if the key does not exist or on error.
 */
export async function getSetting<T>(key: string): Promise<T | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any).value as T;
}

/**
 * Returns true if the public gallery is enabled in the settings table.
 */
export async function isGalleryEnabled(): Promise<boolean> {
  const value = await getSetting<boolean>("public_gallery_enabled");
  return value === true;
}
