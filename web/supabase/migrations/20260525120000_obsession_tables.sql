-- Obsession — per-user, hidden, AC-130-locked self-discipline feature.
--
-- WHY: Stone wants a private deep-work surface gated behind a typed
-- easter-egg ("obsession") that doesn't appear in any nav. Five
-- surfaces (meditations / training / lifts / amor / settings) each
-- with their own data. Everything per-user, RLS-enforced.
--
-- WHAT: 11 tables, all prefixed `obsession_`. 10 are per-user with
-- `auth.uid() = user_id` RLS. 1 (`obsession_quote_pool`) is shared
-- across all users (read-anyone, write only via service role).
--
-- BACKOUT: drop the 11 tables. No FKs into them from outside the
-- obsession namespace.
--   DROP TABLE IF EXISTS public.obsession_lifts_sets;
--   DROP TABLE IF EXISTS public.obsession_lifts_sessions;
--   DROP TABLE IF EXISTS public.obsession_lifts_exercises;
--   DROP TABLE IF EXISTS public.obsession_meditation_drafts;
--   DROP TABLE IF EXISTS public.obsession_meditations;
--   DROP TABLE IF EXISTS public.obsession_training_goals;
--   DROP TABLE IF EXISTS public.obsession_mynetdiary_entries;
--   DROP TABLE IF EXISTS public.obsession_strava_activities;
--   DROP TABLE IF EXISTS public.obsession_strava_tokens;
--   DROP TABLE IF EXISTS public.obsession_preferences;
--   DROP TABLE IF EXISTS public.obsession_quote_pool;
--   DROP FUNCTION IF EXISTS public.obsession_touch_updated_at();

-- ============================================================
-- Shared updated_at trigger function.
-- ============================================================
CREATE OR REPLACE FUNCTION public.obsession_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. obsession_meditations
--    Past daily debrief entries. One per day per user (default;
--    obsession_preferences.meditation_daily_limit can raise it).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_meditations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body                text NOT NULL,
  tags                text[] NOT NULL DEFAULT '{}',
  session_started_at  timestamptz NOT NULL,
  session_ended_at    timestamptz NOT NULL,
  day_of_entry        date NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obsession_meditations_user_day_idx
  ON public.obsession_meditations (user_id, day_of_entry DESC);
CREATE INDEX IF NOT EXISTS obsession_meditations_user_created_idx
  ON public.obsession_meditations (user_id, created_at DESC);

ALTER TABLE public.obsession_meditations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own meditations" ON public.obsession_meditations;
CREATE POLICY "Users can read own meditations"
  ON public.obsession_meditations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own meditations" ON public.obsession_meditations;
CREATE POLICY "Users can insert own meditations"
  ON public.obsession_meditations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own meditations" ON public.obsession_meditations;
CREATE POLICY "Users can update own meditations"
  ON public.obsession_meditations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own meditations" ON public.obsession_meditations;
CREATE POLICY "Users can delete own meditations"
  ON public.obsession_meditations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. obsession_meditation_drafts
--    Auto-saved during the 7-minute write window. One row per user
--    per day (enforced by UNIQUE). Promoted to obsession_meditations
--    on timer-zero, then deleted.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_meditation_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text NOT NULL DEFAULT '',
  started_at      timestamptz NOT NULL,
  day_of_entry    date NOT NULL,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_of_entry)
);

CREATE INDEX IF NOT EXISTS obsession_meditation_drafts_user_idx
  ON public.obsession_meditation_drafts (user_id);

ALTER TABLE public.obsession_meditation_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own drafts" ON public.obsession_meditation_drafts;
CREATE POLICY "Users can read own drafts"
  ON public.obsession_meditation_drafts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own drafts" ON public.obsession_meditation_drafts;
CREATE POLICY "Users can insert own drafts"
  ON public.obsession_meditation_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own drafts" ON public.obsession_meditation_drafts;
CREATE POLICY "Users can update own drafts"
  ON public.obsession_meditation_drafts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own drafts" ON public.obsession_meditation_drafts;
CREATE POLICY "Users can delete own drafts"
  ON public.obsession_meditation_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. obsession_training_goals
--    Race goals: 5k / half / full / ironman / custom.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_training_goals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  target_date  date,
  kind         text NOT NULL CHECK (kind IN ('5k','half','full','ironman','custom')),
  notes        text NOT NULL DEFAULT '',
  achieved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obsession_training_goals_user_idx
  ON public.obsession_training_goals (user_id, target_date NULLS LAST);

ALTER TABLE public.obsession_training_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own goals" ON public.obsession_training_goals;
CREATE POLICY "Users can read own goals"
  ON public.obsession_training_goals FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON public.obsession_training_goals;
CREATE POLICY "Users can insert own goals"
  ON public.obsession_training_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON public.obsession_training_goals;
CREATE POLICY "Users can update own goals"
  ON public.obsession_training_goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goals" ON public.obsession_training_goals;
CREATE POLICY "Users can delete own goals"
  ON public.obsession_training_goals FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 4. obsession_lifts_sessions
--    A workout session. Sets belong to a session via FK.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_lifts_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obsession_lifts_sessions_user_date_idx
  ON public.obsession_lifts_sessions (user_id, session_date DESC);

ALTER TABLE public.obsession_lifts_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sessions" ON public.obsession_lifts_sessions;
CREATE POLICY "Users can read own sessions"
  ON public.obsession_lifts_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.obsession_lifts_sessions;
CREATE POLICY "Users can insert own sessions"
  ON public.obsession_lifts_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.obsession_lifts_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.obsession_lifts_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.obsession_lifts_sessions;
CREATE POLICY "Users can delete own sessions"
  ON public.obsession_lifts_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. obsession_lifts_exercises
--    Per-user exercise dictionary. Used by sets via exercise_name.
--    UNIQUE (user_id, name) means each user has their own exercises.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_lifts_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,
  up_arrow_flag   boolean NOT NULL DEFAULT false,
  last_session_id uuid,  -- FK added after lifts_sessions so order doesn't matter
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS obsession_lifts_exercises_user_idx
  ON public.obsession_lifts_exercises (user_id);

ALTER TABLE public.obsession_lifts_exercises
  ADD CONSTRAINT obsession_lifts_exercises_last_session_fkey
  FOREIGN KEY (last_session_id) REFERENCES public.obsession_lifts_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.obsession_lifts_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own exercises" ON public.obsession_lifts_exercises;
CREATE POLICY "Users can read own exercises"
  ON public.obsession_lifts_exercises FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own exercises" ON public.obsession_lifts_exercises;
CREATE POLICY "Users can insert own exercises"
  ON public.obsession_lifts_exercises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own exercises" ON public.obsession_lifts_exercises;
CREATE POLICY "Users can update own exercises"
  ON public.obsession_lifts_exercises FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own exercises" ON public.obsession_lifts_exercises;
CREATE POLICY "Users can delete own exercises"
  ON public.obsession_lifts_exercises FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 6. obsession_lifts_sets
--    Individual sets within a session. Stop reason + intensity +
--    optional pain location capture Stone's shorthand notebook.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_lifts_sets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id      uuid NOT NULL REFERENCES public.obsession_lifts_sessions(id) ON DELETE CASCADE,
  exercise_name   text NOT NULL,
  weight          numeric NOT NULL,
  reps            integer NOT NULL,
  stop_reason     text NOT NULL CHECK (stop_reason IN ('W','P','V','F')),
  intensity       integer NOT NULL DEFAULT 0 CHECK (intensity IN (0,1,2)),
  pain_location   text,
  set_order       integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obsession_lifts_sets_session_order_idx
  ON public.obsession_lifts_sets (session_id, set_order);
CREATE INDEX IF NOT EXISTS obsession_lifts_sets_user_idx
  ON public.obsession_lifts_sets (user_id, created_at DESC);

ALTER TABLE public.obsession_lifts_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sets" ON public.obsession_lifts_sets;
CREATE POLICY "Users can read own sets"
  ON public.obsession_lifts_sets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sets" ON public.obsession_lifts_sets;
CREATE POLICY "Users can insert own sets"
  ON public.obsession_lifts_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sets" ON public.obsession_lifts_sets;
CREATE POLICY "Users can update own sets"
  ON public.obsession_lifts_sets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sets" ON public.obsession_lifts_sets;
CREATE POLICY "Users can delete own sets"
  ON public.obsession_lifts_sets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 7. obsession_strava_tokens
--    Per-user Strava OAuth tokens. Same shape as spotify_tokens.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_strava_tokens (
  user_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  expires_at    timestamptz NOT NULL,
  scope         text,
  athlete_id    bigint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS obsession_strava_tokens_touch ON public.obsession_strava_tokens;
CREATE TRIGGER obsession_strava_tokens_touch
  BEFORE UPDATE ON public.obsession_strava_tokens
  FOR EACH ROW EXECUTE FUNCTION public.obsession_touch_updated_at();

ALTER TABLE public.obsession_strava_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own strava tokens" ON public.obsession_strava_tokens;
CREATE POLICY "Users can read own strava tokens"
  ON public.obsession_strava_tokens FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own strava tokens" ON public.obsession_strava_tokens;
CREATE POLICY "Users can insert own strava tokens"
  ON public.obsession_strava_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own strava tokens" ON public.obsession_strava_tokens;
CREATE POLICY "Users can update own strava tokens"
  ON public.obsession_strava_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own strava tokens" ON public.obsession_strava_tokens;
CREATE POLICY "Users can delete own strava tokens"
  ON public.obsession_strava_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 8. obsession_strava_activities
--    Cached Strava activity rows. UNIQUE on strava_id prevents
--    duplicate ingestion across syncs.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_strava_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strava_id     bigint NOT NULL UNIQUE,
  type          text NOT NULL,
  distance      numeric,
  moving_time   integer,
  elapsed_time  integer,
  started_at    timestamptz NOT NULL,
  raw_payload   jsonb,
  ingested_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS obsession_strava_activities_user_started_idx
  ON public.obsession_strava_activities (user_id, started_at DESC);

ALTER TABLE public.obsession_strava_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own strava activities" ON public.obsession_strava_activities;
CREATE POLICY "Users can read own strava activities"
  ON public.obsession_strava_activities FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own strava activities" ON public.obsession_strava_activities;
CREATE POLICY "Users can insert own strava activities"
  ON public.obsession_strava_activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own strava activities" ON public.obsession_strava_activities;
CREATE POLICY "Users can update own strava activities"
  ON public.obsession_strava_activities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own strava activities" ON public.obsession_strava_activities;
CREATE POLICY "Users can delete own strava activities"
  ON public.obsession_strava_activities FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 9. obsession_mynetdiary_entries
--    Rows from MyNetDiary CSV uploads.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_mynetdiary_entries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_date   date NOT NULL,
  food_name    text NOT NULL,
  calories     numeric,
  protein      numeric,
  carbs        numeric,
  fat          numeric,
  raw_csv_row  jsonb,
  ingested_at  timestamptz NOT NULL DEFAULT now(),
  upload_batch uuid  -- groups rows from a single upload for delete-batch
);

CREATE INDEX IF NOT EXISTS obsession_mynetdiary_user_date_idx
  ON public.obsession_mynetdiary_entries (user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS obsession_mynetdiary_user_batch_idx
  ON public.obsession_mynetdiary_entries (user_id, upload_batch);
-- Soft dedupe key — application checks for (user_id, entry_date, food_name).
CREATE INDEX IF NOT EXISTS obsession_mynetdiary_dedupe_idx
  ON public.obsession_mynetdiary_entries (user_id, entry_date, food_name);

ALTER TABLE public.obsession_mynetdiary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own mnd entries" ON public.obsession_mynetdiary_entries;
CREATE POLICY "Users can read own mnd entries"
  ON public.obsession_mynetdiary_entries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own mnd entries" ON public.obsession_mynetdiary_entries;
CREATE POLICY "Users can insert own mnd entries"
  ON public.obsession_mynetdiary_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own mnd entries" ON public.obsession_mynetdiary_entries;
CREATE POLICY "Users can update own mnd entries"
  ON public.obsession_mynetdiary_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own mnd entries" ON public.obsession_mynetdiary_entries;
CREATE POLICY "Users can delete own mnd entries"
  ON public.obsession_mynetdiary_entries FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 10. obsession_preferences
--     Per-user feature preferences. One row per user, lazily created.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_preferences (
  user_id                       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  meditation_duration_seconds   integer NOT NULL DEFAULT 420
    CHECK (meditation_duration_seconds BETWEEN 60 AND 1800),
  meditation_daily_limit        integer NOT NULL DEFAULT 1
    CHECK (meditation_daily_limit BETWEEN 1 AND 10),
  source_preference_conflicts   text NOT NULL DEFAULT 'ask'
    CHECK (source_preference_conflicts IN ('strava','mynetdiary','ask')),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS obsession_preferences_touch ON public.obsession_preferences;
CREATE TRIGGER obsession_preferences_touch
  BEFORE UPDATE ON public.obsession_preferences
  FOR EACH ROW EXECUTE FUNCTION public.obsession_touch_updated_at();

ALTER TABLE public.obsession_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own preferences" ON public.obsession_preferences;
CREATE POLICY "Users can read own preferences"
  ON public.obsession_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.obsession_preferences;
CREATE POLICY "Users can insert own preferences"
  ON public.obsession_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.obsession_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.obsession_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own preferences" ON public.obsession_preferences;
CREATE POLICY "Users can delete own preferences"
  ON public.obsession_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 11. obsession_quote_pool
--     Shared across all users. Stone seeds it later via the
--     Supabase dashboard or a separate seed script. Read by
--     anyone signed in; write only via service-role (no policy
--     for INSERT/UPDATE/DELETE means RLS blocks them).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.obsession_quote_pool (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_text  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.obsession_quote_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read quotes" ON public.obsession_quote_pool;
CREATE POLICY "Authenticated users can read quotes"
  ON public.obsession_quote_pool FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Seed: one placeholder row so the landing has something to
-- display before Stone curates the pool. Safe to re-run because
-- of ON CONFLICT DO NOTHING.
-- ============================================================
INSERT INTO public.obsession_quote_pool (id, quote_text)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Amor Cantus Avium — love of the birds'' song. Live the act of living it.')
ON CONFLICT (id) DO NOTHING;
