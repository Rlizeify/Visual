-- Accent toggle: profiles.accent_color hex → 'red' | 'teal' | 'purple';
-- drop the old theme + palette machinery.
--
-- STATUS: NOT APPLIED. Written 2026-11-03 in the full refactor while the
-- Supabase MCP was not authenticated. Apply with apply_migration after the
-- backup below. The shipped client already handles BOTH shapes
-- (app/accent.ts normalizeAccent), so applying this is safe at any time.
--
-- Mapping: '#a855f7' → purple; everything else → red. Teal (#00dcc8) was
-- the old column default, so users who never chose an accent get the new
-- default instead of keeping a color they didn't pick.
--
-- Before applying (via execute_sql, save to backups/db-<date>/):
--   SELECT id, accent_color, theme_id FROM public.profiles;   -- profiles_accent.json
--   SELECT * FROM public.accent_color_palette;                -- accent_color_palette.json
--   SELECT * FROM public.app_settings;                        -- app_settings.json
-- and check nothing else reads app_settings (code: zero references as of
-- this commit — the only key was allow_custom_hex):
--   SELECT key FROM public.app_settings;
-- If another key exists the table is kept (see the DO block).

BEGIN;

UPDATE public.profiles
SET accent_color = CASE WHEN lower(trim(accent_color)) = '#a855f7' THEN 'purple' ELSE 'red' END
WHERE accent_color IS NULL OR accent_color NOT IN ('red', 'teal', 'purple');

ALTER TABLE public.profiles ALTER COLUMN accent_color SET DEFAULT 'red';
ALTER TABLE public.profiles ALTER COLUMN accent_color SET NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_accent_color_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_accent_color_check CHECK (accent_color IN ('red', 'teal', 'purple'));
COMMENT ON COLUMN public.profiles.accent_color IS 'UI accent: red (default) | teal | purple';

-- Multi-theme system removed from the client.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_theme_id_check;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS theme_id;

-- Fixed in-code accent list replaces the admin palette.
DROP TABLE IF EXISTS public.accent_color_palette;

-- allow_custom_hex was the only key; no code reads app_settings now.
-- The table is dropped only if that leaves it empty.
DO $$
BEGIN
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    DELETE FROM public.app_settings WHERE key = 'allow_custom_hex';
    IF NOT EXISTS (SELECT 1 FROM public.app_settings) THEN
      DROP TABLE public.app_settings;
    END IF;
  END IF;
END $$;

COMMIT;

-- Verify:
--   SELECT accent_color, count(*) FROM public.profiles GROUP BY 1;          -- only red/teal/purple
--   SELECT conname FROM pg_constraint WHERE conname = 'profiles_accent_color_check';
--   SELECT column_name FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='profiles' AND column_name='theme_id';   -- 0 rows
--   SELECT to_regclass('public.accent_color_palette'), to_regclass('public.app_settings'); -- both null
