import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client — uses the public anon key
// Safe to use in the browser, limited by RLS policies
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
