-- Migration: 20260524000000_add_thumbnail_path_to_uploads
-- Adds thumbnail_path column for pre-generated video thumbnail JPEGs.
--
-- The app generates a JPEG thumbnail client-side from the local video file
-- before upload, stores it under thumbnails/YYYY/MM/<uuid>.jpg in the same
-- bucket, and records the path here. Gallery and admin use it so video tiles
-- show a real image frame on iOS Safari instead of a blank placeholder.
--
-- The column is nullable TEXT:
--   - NULL  → video has no pre-generated thumbnail (uses <video preload="metadata"> fallback)
--   - non-NULL → signed URL generated alongside the main file URL

ALTER TABLE public.uploads
ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;
