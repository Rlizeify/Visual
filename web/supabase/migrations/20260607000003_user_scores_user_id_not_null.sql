-- INV1 (Session 6) — lock down user_scores.user_id at the schema layer.
--
-- Background:
-- * Migration 20260530000002 deleted the existing NULL-user_id rows and
--   added UNIQUE(user_id) + the missing FK to profiles. It did NOT add
--   NOT NULL on user_id, and the legacy RLS policies (from the original
--   20260509000002 create migration) still permitted NULL writes via
--   `auth.uid() = user_id OR user_id IS NULL`.
-- * Two server write paths re-introduced NULL rows after 30000002:
--   - web/api/_handlers/auth.ts::handleSpotifyAuth (live; called on every
--     Spotify login via services/spotify/session.ts:postSessionAuth)
--   - web/api/_handlers/scores.ts::handleUpsertScore (no client caller,
--     but the route still answered)
-- * Phase 1A audit on 2026-06-07 found 2 NULL rows (both functional
--   duplicates of users with valid modern rows).
--
-- This migration was first applied manually to the remote DB (NOT NULL
-- only). Re-running via `supabase db push --linked` is idempotent — the
-- NOT NULL check is gated by a DO block; the policy DROPs are
-- straightforward and replace the legacy `OR user_id IS NULL` clauses.

-- 1. Guard: refuse to apply if any NULL rows remain (defense against
--    re-running on a dirty DB).
DO $$
DECLARE
  null_count integer;
BEGIN
  SELECT COUNT(*) INTO null_count FROM public.user_scores WHERE user_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'user_scores has % rows with NULL user_id; resolve before locking schema', null_count;
  END IF;
END $$;

-- 2. NOT NULL on user_id (idempotent — Postgres no-ops if already NOT NULL).
ALTER TABLE public.user_scores ALTER COLUMN user_id SET NOT NULL;

-- 3. Replace legacy permissive policies. The `OR user_id IS NULL` arm is
--    no longer reachable now that NOT NULL is enforced — drop it for
--    clarity so future readers don't think NULL is a valid path.
DROP POLICY IF EXISTS "Users can insert own score" ON public.user_scores;
CREATE POLICY "Users can insert own score"
  ON public.user_scores
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own score" ON public.user_scores;
CREATE POLICY "Users can update own score"
  ON public.user_scores
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Reload PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
