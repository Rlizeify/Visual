-- Add the missing FK from user_scores.user_id to profiles.id.
--
-- Context. Migration 20260509000004_add_profile_fks.sql added FKs for
-- oauth_connections, life_score_derivatives, life_score_samples, and
-- leaderboard_config — but missed user_scores. As a result, PostgREST
-- could not infer the relationship and `select(..., profiles(...))`
-- on user_scores returned:
--   PGRST200: Could not find a relationship between 'user_scores' and
--             'profiles' in the schema cache.
--
-- The handler (web/api/scores.ts:handleLeaderboard) has been rewritten
-- to fetch profiles separately in JS so it works even without this FK,
-- but adding the FK keeps the schema honest and lets future code use
-- the nested-join syntax safely.
--
-- The user_id values already equal profiles.id (both reference
-- auth.users.id), so adding the FK is non-destructive.

ALTER TABLE public.user_scores
  ADD CONSTRAINT user_scores_user_id_profiles_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
