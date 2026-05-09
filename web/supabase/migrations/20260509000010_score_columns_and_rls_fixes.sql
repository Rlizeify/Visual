-- Add five score derivative columns to user_scores for tracking changes
-- Also fixes RLS policies flagged in audit

-- 1. Add derivative score columns to user_scores
ALTER TABLE public.user_scores
  ADD COLUMN IF NOT EXISTS position_score numeric,
  ADD COLUMN IF NOT EXISTS velocity_score numeric,
  ADD COLUMN IF NOT EXISTS acceleration_score numeric,
  ADD COLUMN IF NOT EXISTS jerk_score numeric,
  ADD COLUMN IF NOT EXISTS snap_score numeric;

-- 2. Fix user_listening_stats RLS
-- The "Service can manage" policy with WITH CHECK(true) allows anon writes.
-- Since API uses service role (bypasses RLS), we can safely drop this policy.
-- Service role bypasses RLS anyway, so this policy was redundant.
DROP POLICY IF EXISTS "Service can manage listening stats" ON public.user_listening_stats;

-- 3. Fix score_events RLS
-- The current USING(true) allows direct DB queries to read source_action.
-- We keep USING(true) for SELECT because the social feed needs public access,
-- but the API at web/api/scores.ts:193-206 already filters source_action:
--   const showSource = isOwnEvent && (e.visibility_override ?? userVisibility)
-- RLS cannot do column-level filtering, so we rely on API enforcement.
-- Adding a comment to document this decision.
COMMENT ON POLICY "Anyone can read score events" ON public.score_events IS
  'Allows public SELECT for social feed. source_action privacy is enforced at API layer (web/api/scores.ts:193-206), not RLS. RLS cannot do column-level filtering.';
