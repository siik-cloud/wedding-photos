/**
 * Browser (client-side) Supabase client
 *
 * Uses the PUBLISHABLE key — safe to expose in the browser.
 * Subject to RLS policies. Never has privileged access.
 *
 * Use for:
 *   - Public gallery reads (if ever done client-side)
 *   - Any other non-privileged browser operations
 *
 * DO NOT import this from any API route or server component.
 * For server-side access use @/lib/supabase/server-client.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url) {
  throw new Error(
    "[supabase/browser-client] Missing NEXT_PUBLIC_SUPABASE_URL. " +
    "Set it in .env.local and in your Vercel environment variables."
  );
}
if (!key) {
  throw new Error(
    "[supabase/browser-client] Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
    "Get it from Supabase dashboard → Settings → API → Publishable API key. " +
    "Set it in .env.local and in your Vercel environment variables."
  );
}

// Module-level singleton — one client per browser tab, reused across components.
export const supabaseBrowser = createClient(url, key);
