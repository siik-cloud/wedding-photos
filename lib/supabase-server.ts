/**
 * @deprecated
 * This file is a compatibility shim. All imports should be updated to:
 *   import { ... } from "@/lib/supabase/server-client"
 *
 * This shim will be removed in a future cleanup.
 */
export {
  getSupabaseServer,
  BUCKET_NAME,
  getSignedUrl,
  getSetting,
  isGalleryEnabled,
} from "@/lib/supabase/server-client";
