-- User listening stats table for caching Spotify-derived score data
-- Stores daily listening minutes for score calculation

CREATE TABLE IF NOT EXISTS public.user_listening_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  listening_minutes integer NOT NULL DEFAULT 0,
  track_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, date)
);

CREATE INDEX idx_user_listening_stats_user_date ON public.user_listening_stats(user_id, date DESC);

ALTER TABLE public.user_listening_stats ENABLE ROW LEVEL SECURITY;

-- Users can read their own stats
CREATE POLICY "Users can read own listening stats"
  ON public.user_listening_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role handles inserts/updates via API
CREATE POLICY "Service can manage listening stats"
  ON public.user_listening_stats
  FOR ALL
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER user_listening_stats_updated_at
  BEFORE UPDATE ON public.user_listening_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
