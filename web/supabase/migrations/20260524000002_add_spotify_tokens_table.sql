-- Spotify OAuth tokens — per-user persistence.
--
-- WHY: tokens previously lived only in browser localStorage. Signing
-- in on a new browser (or after clearing site data) forced a full
-- Spotify re-link. Storing tokens against the Supabase user_id makes
-- the link follow the account, not the browser.
--
-- WHAT: one row per user_id holds the current Spotify access_token,
-- refresh_token, expires_at, and scope. Self-only RLS — users only
-- ever see / modify their own row. Service role bypasses RLS (so the
-- daily cron / admin path can read if/when we need it; currently
-- unused).
--
-- BACKOUT: drop the table and the trigger. Client code degrades to
-- "Spotify not linked" for every user; users can re-link manually.
--   DROP TRIGGER IF EXISTS spotify_tokens_set_updated_at ON public.spotify_tokens;
--   DROP FUNCTION IF EXISTS public.spotify_tokens_touch_updated_at();
--   DROP TABLE IF EXISTS public.spotify_tokens;

CREATE TABLE IF NOT EXISTS public.spotify_tokens (
  user_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  expires_at    timestamptz NOT NULL,
  scope         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Touch updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.spotify_tokens_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spotify_tokens_set_updated_at ON public.spotify_tokens;
CREATE TRIGGER spotify_tokens_set_updated_at
  BEFORE UPDATE ON public.spotify_tokens
  FOR EACH ROW EXECUTE FUNCTION public.spotify_tokens_touch_updated_at();

-- RLS — users own their row, no other access.
ALTER TABLE public.spotify_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own spotify tokens" ON public.spotify_tokens;
CREATE POLICY "Users can read own spotify tokens"
  ON public.spotify_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own spotify tokens" ON public.spotify_tokens;
CREATE POLICY "Users can insert own spotify tokens"
  ON public.spotify_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own spotify tokens" ON public.spotify_tokens;
CREATE POLICY "Users can update own spotify tokens"
  ON public.spotify_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own spotify tokens" ON public.spotify_tokens;
CREATE POLICY "Users can delete own spotify tokens"
  ON public.spotify_tokens
  FOR DELETE
  USING (auth.uid() = user_id);
