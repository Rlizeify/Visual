-- Theme system foundation
-- 1. Add profiles.theme_id so the active theme persists per-user across
--    sign-out / sign-in and across devices.
-- 2. Allow users to update their own user_score_visibility.reveal_action
--    so the profile dropdown can toggle source-line visibility without
--    needing the admin role. The previous policy set restricted ALL
--    writes to is_admin(auth.uid()); this migration adds self-scoped
--    insert + update policies in addition (does not remove the admin
--    policies — admins still manage other users via /admin).

-- ----- 1. profiles.theme_id -----------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_id text NOT NULL DEFAULT 'frutiger-aero';

-- Constrain to known theme ids. New themes added to the registry must
-- be added here as well (or this CHECK relaxed).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_theme_id_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_id_check
  CHECK (theme_id IN ('frutiger-aero', 'asian-vibrant', 'ac130-thermal'));

-- ----- 2. user_score_visibility self-update -------------------------

-- Users can insert their own visibility rows.
DROP POLICY IF EXISTS "Users can insert own visibility" ON public.user_score_visibility;
CREATE POLICY "Users can insert own visibility"
  ON public.user_score_visibility
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own visibility rows.
DROP POLICY IF EXISTS "Users can update own visibility" ON public.user_score_visibility;
CREATE POLICY "Users can update own visibility"
  ON public.user_score_visibility
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
