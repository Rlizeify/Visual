-- Add foreign key relationships from user_id columns to profiles table
-- This enables PostgREST nested join syntax like select('*, profiles(*)')
--
-- Decision: Add FK constraints rather than rewriting queries to do separate
-- fetches. FKs are cleaner and enable the Supabase client's nested join syntax.
-- The user_id values already equal profiles.id (both reference auth.users.id),
-- so this just makes the relationship explicit.

-- oauth_connections → profiles
ALTER TABLE public.oauth_connections
  ADD CONSTRAINT oauth_connections_user_id_profiles_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- life_score_derivatives → profiles
ALTER TABLE public.life_score_derivatives
  ADD CONSTRAINT life_score_derivatives_user_id_profiles_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- life_score_samples → profiles
ALTER TABLE public.life_score_samples
  ADD CONSTRAINT life_score_samples_user_id_profiles_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- leaderboard_config → profiles
ALTER TABLE public.leaderboard_config
  ADD CONSTRAINT leaderboard_config_user_id_profiles_fk
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
