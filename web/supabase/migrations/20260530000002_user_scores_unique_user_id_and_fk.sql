-- Make the scoring pipeline's user_scores upsert actually work.
--
-- Background (2026-05-30 diagnosis):
-- * Migration 20260523000001 was meant to add an FK from user_scores.user_id
--   to profiles.id. The migration was recorded in supabase_migrations.schema_migrations
--   but the constraint was never created on the live DB (phantom-applied —
--   likely the migration row was inserted manually before the file existed,
--   or a failed earlier push left the marker without the DDL).
-- * The scoring engine's writeScoreEventsIfChanged() upserts user_scores with
--   onConflict: 'user_id', but no UNIQUE constraint on user_id existed. The
--   upsert silently no-ops. Only the legacy handleUpsertScore() (keyed on the
--   already-UNIQUE spotify_user_id) ever wrote rows — and it wrote with
--   user_id = NULL.
-- * Result: 80 score_events written, 114 position_history rows written, but
--   only 1 user_scores row (NULL user_id, legacy). Leaderboard reads
--   user_scores → empty → position 0 / derivatives "—" for every real user.
--
-- This migration:
-- 1. Drops the legacy NULL-user_id row (it has no useful data; created by the
--    deprecated handleUpsertScore path which is no longer the primary write
--    path).
-- 2. Makes spotify_user_id nullable — the scoring engine has no Spotify user
--    handle and was using auth UUID as a kludge value to satisfy NOT NULL.
-- 3. Adds UNIQUE constraint on user_id so the upsert's ON CONFLICT can fire.
-- 4. Adds the missing FK to profiles.id (idempotent — skip if it somehow
--    exists already).
-- 5. NOTIFY pgrst so the schema cache picks up the new relationship for the
--    admin LifeScores nested-join query.

-- 1. Drop legacy row.
DELETE FROM public.user_scores WHERE user_id IS NULL;

-- 2. Allow NULL spotify_user_id (legacy column; new path doesn't populate it).
ALTER TABLE public.user_scores ALTER COLUMN spotify_user_id DROP NOT NULL;

-- 3. UNIQUE on user_id so onConflict:'user_id' actually upserts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_scores'::regclass
      AND conname  = 'user_scores_user_id_key'
  ) THEN
    ALTER TABLE public.user_scores
      ADD CONSTRAINT user_scores_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 4. FK to profiles (the one 20260523000001 was supposed to install).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_scores'::regclass
      AND conname  = 'user_scores_user_id_profiles_fk'
  ) THEN
    ALTER TABLE public.user_scores
      ADD CONSTRAINT user_scores_user_id_profiles_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Reload PostgREST schema cache so the new relationship + UNIQUE are picked
--    up immediately (otherwise admin LifeScores nested join keeps 500ing).
NOTIFY pgrst, 'reload schema';
