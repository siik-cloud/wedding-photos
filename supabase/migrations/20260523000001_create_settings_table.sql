-- Migration: 20260523000001_create_settings_table
-- Creates the settings key-value table and seeds the gallery visibility flag.

CREATE TABLE IF NOT EXISTS public.settings (
    key   TEXT  PRIMARY KEY,
    value JSONB NOT NULL
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Seed: gallery starts private; admin enables it after the wedding.
-- ON CONFLICT DO NOTHING makes this safe to re-run.
INSERT INTO public.settings (key, value)
VALUES ('public_gallery_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
