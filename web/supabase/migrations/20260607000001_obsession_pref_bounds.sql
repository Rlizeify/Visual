-- Defense-in-depth CHECK constraints on obsession_preferences.
--
-- The client clamps + step-snaps these values and savePreferences()
-- re-validates in the service layer, but obsession preferences write
-- directly to Supabase via RLS — no serverless function in front. A
-- tampered client could otherwise persist out-of-range or non-step
-- values. These constraints reject those writes at the database boundary.
--
-- Values that match the Settings.tsx inputs:
--   meditation_duration_seconds: [60, 1800] in steps of 30
--   meditation_daily_limit:      integer in [1, 10]
--
-- Use NOT VALID + VALIDATE pattern so an existing bad row (e.g.
-- pre-migration test data) doesn't block the migration; we log and
-- continue. New writes get the gate regardless.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'obsession_preferences_duration_bounds'
  ) THEN
    ALTER TABLE public.obsession_preferences
      ADD CONSTRAINT obsession_preferences_duration_bounds
      CHECK (
        meditation_duration_seconds >= 60
        AND meditation_duration_seconds <= 1800
        AND meditation_duration_seconds % 30 = 0
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'obsession_preferences_daily_limit_bounds'
  ) THEN
    ALTER TABLE public.obsession_preferences
      ADD CONSTRAINT obsession_preferences_daily_limit_bounds
      CHECK (
        meditation_daily_limit >= 1
        AND meditation_daily_limit <= 10
      ) NOT VALID;
  END IF;
END $$;

-- Validate now so the constraint is enforced on existing rows too.
-- If validation fails (a pre-existing bad row), we leave the constraint
-- NOT VALID — it still applies to all new INSERT/UPDATEs.
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.obsession_preferences
      VALIDATE CONSTRAINT obsession_preferences_duration_bounds;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'obsession_preferences_duration_bounds left NOT VALID — existing rows violate it';
  END;
  BEGIN
    ALTER TABLE public.obsession_preferences
      VALIDATE CONSTRAINT obsession_preferences_daily_limit_bounds;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'obsession_preferences_daily_limit_bounds left NOT VALID — existing rows violate it';
  END;
END $$;
