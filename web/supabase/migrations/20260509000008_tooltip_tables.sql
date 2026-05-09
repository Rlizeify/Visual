-- Tooltip configuration tables
-- Site-wide defaults and per-user overrides for score box tooltips

-- Default tooltip text per score type (site-wide)
CREATE TABLE IF NOT EXISTS public.tooltip_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_type text NOT NULL UNIQUE CHECK (score_type IN ('position', 'velocity', 'acceleration', 'jerk', 'snap')),
  text text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Seed default tooltip text
INSERT INTO public.tooltip_defaults (score_type, text) VALUES
  ('position', 'Your total listening minutes this week.'),
  ('velocity', 'How many minutes you listened today.'),
  ('acceleration', 'Change in listening from yesterday to today.'),
  ('jerk', 'How your acceleration is changing day over day.'),
  ('snap', 'The rate at which your jerk is changing.')
ON CONFLICT (score_type) DO NOTHING;

ALTER TABLE public.tooltip_defaults ENABLE ROW LEVEL SECURITY;

-- Anyone can read defaults
CREATE POLICY "Anyone can read tooltip defaults"
  ON public.tooltip_defaults
  FOR SELECT
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage tooltip defaults"
  ON public.tooltip_defaults
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Per-user tooltip overrides
CREATE TABLE IF NOT EXISTS public.tooltip_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_type text NOT NULL CHECK (score_type IN ('position', 'velocity', 'acceleration', 'jerk', 'snap')),
  text text NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, score_type)
);

CREATE INDEX idx_tooltip_overrides_user ON public.tooltip_overrides(user_id);

ALTER TABLE public.tooltip_overrides ENABLE ROW LEVEL SECURITY;

-- Users can read their own overrides
CREATE POLICY "Users can read own tooltip overrides"
  ON public.tooltip_overrides
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can manage all overrides
CREATE POLICY "Admins can read all tooltip overrides"
  ON public.tooltip_overrides
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage tooltip overrides"
  ON public.tooltip_overrides
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
