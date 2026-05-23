import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client — uses service role key
// NEVER import this in client components!
// This bypasses RLS and has full access to the database and storage.

let _supabaseServer: ReturnType<typeof createClient> | null = null;

export function getSupabaseServer() {
  if (_supabaseServer) return _supabaseServer;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  _supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseServer;
}

export const BUCKET_NAME = "wedding-uploads";

// Generate a signed URL for viewing/downloading a file
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

// Get settings from the database
export async function getSetting<T>(key: string): Promise<T | null> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return null;
  return data.value as T;
}

// Check if public gallery is enabled
export async function isGalleryEnabled(): Promise<boolean> {
  const value = await getSetting<boolean>("public_gallery_enabled");
  return value === true;
}
