-- Migration: 20260523000000_create_uploads_table
-- Creates the uploads table with indexes and RLS.
-- uuid-ossp is required for uuid_generate_v4().

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.uploads (
    id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name          TEXT        NOT NULL,
    original_file_name TEXT        NOT NULL,
    file_type          TEXT        NOT NULL
                         CHECK (file_type IN ('image', 'video', 'other')),
    mime_type          TEXT        NOT NULL,
    file_size          BIGINT      NOT NULL DEFAULT 0,
    storage_path       TEXT        NOT NULL UNIQUE,
    guest_name         TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ
);

-- Indexes for the most common query patterns
CREATE INDEX IF NOT EXISTS idx_uploads_deleted_at ON public.uploads (deleted_at);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON public.uploads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploads_file_type  ON public.uploads (file_type);

-- Enable RLS.
-- No policies are created here: all access goes through the server-side
-- service role key, which bypasses RLS. RLS acts as a safety net against
-- accidental direct client access with the anon key.
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
