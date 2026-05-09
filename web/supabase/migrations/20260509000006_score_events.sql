-- Score events table for social feed
-- Stores every score change with the action that caused it (private) and the visible delta

CREATE TABLE IF NOT EXISTS public.score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_type text NOT NULL CHECK (score_type IN ('position', 'velocity', 'acceleration', 'jerk', 'snap')),
  delta numeric NOT NULL,
  -- source_action is PRIVATE - reveals what actually caused the change
  -- e.g. "spotify_listening_120m", "spotify_track_count_15"
  source_action text,
  -- visibility_override: if set, overrides the user's default visibility setting
  visibility_override boolean,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_score_events_user_id ON public.score_events(user_id);
CREATE INDEX idx_score_events_created_at ON public.score_events(created_at DESC);
CREATE INDEX idx_score_events_type_created ON public.score_events(score_type, created_at DESC);

ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read the public portion of events (for social feed)
CREATE POLICY "Anyone can read score events"
  ON public.score_events
  FOR SELECT
  USING (true);

-- Service role (via API) handles inserts
CREATE POLICY "Service can insert score events"
  ON public.score_events
  FOR INSERT
  WITH CHECK (true);
