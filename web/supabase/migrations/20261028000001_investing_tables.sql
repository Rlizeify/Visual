-- Investing — SPX option candidate comparison tool (/investing).
--
-- WHY: Stone enters SPX option candidates (typed premiums from
-- Robinhood) and compares projected P&L across his own scenario
-- dates and SPX levels. Candidates + scenarios are per-user; the
-- market snapshot (SPX close + Treasury curve) is shared and written
-- only by the server (cron / on-demand refresh via service role).
--
-- WHAT: 3 tables.
--   option_candidates    per-user, auth.uid() = user_id RLS (CRUD)
--   investing_scenarios  per-user settings row, auth.uid() = user_id RLS
--   market_snapshot      shared; SELECT for signed-in users, no write
--                        policies (service role bypasses RLS)
--
-- BACKOUT:
--   DROP TABLE IF EXISTS public.option_candidates;
--   DROP TABLE IF EXISTS public.investing_scenarios;
--   DROP TABLE IF EXISTS public.market_snapshot;

-- ============================================================
-- 1. option_candidates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.option_candidates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label          text,
  type           text NOT NULL DEFAULT 'call' CHECK (type IN ('call', 'put')),
  strike         numeric NOT NULL CHECK (strike > 0),
  expiry         date NOT NULL,
  premium        numeric NOT NULL CHECK (premium > 0),
  contracts      integer NOT NULL DEFAULT 1 CHECK (contracts > 0),
  iv_override    numeric CHECK (iv_override IS NULL OR (iv_override > 0 AND iv_override <= 3)),
  spot_at_entry  numeric NOT NULL CHECK (spot_at_entry > 0),
  entered_at     timestamptz NOT NULL DEFAULT now(),
  archived       boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS option_candidates_user_idx
  ON public.option_candidates (user_id, archived, entered_at DESC);

ALTER TABLE public.option_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own option candidates" ON public.option_candidates;
CREATE POLICY "Users can read own option candidates"
  ON public.option_candidates FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own option candidates" ON public.option_candidates;
CREATE POLICY "Users can insert own option candidates"
  ON public.option_candidates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own option candidates" ON public.option_candidates;
CREATE POLICY "Users can update own option candidates"
  ON public.option_candidates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own option candidates" ON public.option_candidates;
CREATE POLICY "Users can delete own option candidates"
  ON public.option_candidates FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. investing_scenarios — one row per user
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investing_scenarios (
  user_id          uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  scenario_dates   date[] NOT NULL DEFAULT '{}',
  scenario_levels  numeric[] NOT NULL DEFAULT '{}',
  iv_shift         numeric NOT NULL DEFAULT 0,
  div_yield        numeric NOT NULL DEFAULT 0.013,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.investing_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own investing scenarios" ON public.investing_scenarios;
CREATE POLICY "Users can read own investing scenarios"
  ON public.investing_scenarios FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own investing scenarios" ON public.investing_scenarios;
CREATE POLICY "Users can insert own investing scenarios"
  ON public.investing_scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investing scenarios" ON public.investing_scenarios;
CREATE POLICY "Users can update own investing scenarios"
  ON public.investing_scenarios FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own investing scenarios" ON public.investing_scenarios;
CREATE POLICY "Users can delete own investing scenarios"
  ON public.investing_scenarios FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. market_snapshot — shared, server-written
--    as_of       market timestamp of the SPX close (or fetch time if
--                no SPX source answered). UNIQUE so repeat refreshes
--                for the same close upsert instead of piling up.
--    spx_close   nullable: if every SPX source fails the UI falls
--                back to manual spot entry.
--    treasury_curve  tenor label → par yield percent, as published
--                    ({"1 Mo": 4.10, ..., "30 Yr": 5.30})
--    curve_date  date of the Treasury curve row (may lag as_of)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.market_snapshot (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of           timestamptz NOT NULL UNIQUE,
  spx_close       numeric,
  treasury_curve  jsonb,
  curve_date      date,
  source          text NOT NULL,
  fetched_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS market_snapshot_fetched_idx
  ON public.market_snapshot (fetched_at DESC);

ALTER TABLE public.market_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read market snapshot" ON public.market_snapshot;
CREATE POLICY "Authenticated users can read market snapshot"
  ON public.market_snapshot FOR SELECT
  USING (auth.uid() IS NOT NULL);

NOTIFY pgrst, 'reload schema';
