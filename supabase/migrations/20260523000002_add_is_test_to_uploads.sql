-- Migration: 20260523000002_add_is_test_to_uploads
-- Adds is_test flag so the admin can identify and bulk-delete test uploads
-- without touching real wedding photos.
-- The cleanup API also deletes uploads created before WEDDING_START_TIMESTAMP,
-- but is_test allows explicit manual flagging regardless of timestamp.

ALTER TABLE public.uploads
ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_uploads_is_test ON public.uploads (is_test);
