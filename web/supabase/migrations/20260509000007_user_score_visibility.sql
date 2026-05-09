-- User score visibility settings
-- Controls whether users see the source_action for their own score changes
-- Admin-managed on a per-user, per-score-type basis

CREATE TABLE IF NOT EXISTS public.user_score_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_type text NOT NULL CHECK (score_type IN ('position', 'velocity', 'acceleration', 'jerk', 'snap')),
  reveal_action boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, score_type)
);

CREATE INDEX idx_user_score_visibility_user ON public.user_score_visibility(user_id);

ALTER TABLE public.user_score_visibility ENABLE ROW LEVEL SECURITY;

-- Users can read their own visibility settings
CREATE POLICY "Users can read own visibility"
  ON public.user_score_visibility
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "Admins can read all visibility"
  ON public.user_score_visibility
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admins can manage
CREATE POLICY "Admins can insert visibility"
  ON public.user_score_visibility
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update visibility"
  ON public.user_score_visibility
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete visibility"
  ON public.user_score_visibility
  FOR DELETE
  USING (public.is_admin(auth.uid()));
