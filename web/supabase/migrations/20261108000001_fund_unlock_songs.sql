-- Fund tab song unlock.
--
-- STATUS: APPLIED 2026-11-08 (owner, SQL Editor; verified: 5 songs, RLS on,
-- anon no access, authenticated read-only behind has_feature(fund)).
--
-- The Fund nav tab (feature key 'fund', granted per account in Admin →
-- Users) only appears while the signed-in user's Spotify is playing one of
-- these songs. Matching is fuzzy on title + artist (src/app/songUnlock.ts).
-- The list lives here, not in the JS bundle, so only accounts that already
-- hold the 'fund' grant can read it. Clients cannot write it.
--
-- This is the first step of the Fund sign-in, checked in the browser; it
-- opens the door, it does not lock it. Fund data, when it exists, must sit
-- behind has_feature('fund') RLS plus the later server-checked steps.

BEGIN;

CREATE TABLE IF NOT EXISTS public.fund_unlock_songs (
  id     serial PRIMARY KEY,
  title  text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  artist text NOT NULL CHECK (length(artist) BETWEEN 1 AND 200),
  UNIQUE (title, artist)
);
ALTER TABLE public.fund_unlock_songs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fund_unlock_songs FROM anon, authenticated;
GRANT SELECT ON public.fund_unlock_songs TO authenticated;

DROP POLICY IF EXISTS "Fund users read unlock songs" ON public.fund_unlock_songs;
CREATE POLICY "Fund users read unlock songs" ON public.fund_unlock_songs
  FOR SELECT TO authenticated USING ((SELECT public.has_feature('fund')));

INSERT INTO public.fund_unlock_songs (title, artist) VALUES
  ('On The Floor', 'iceJJFish'),
  ('Magnolia', 'Playboi Carti'),
  ('Hopeless Romantic', 'Wiz Khalifa'),
  ('Coolest Monkey In The Jungle', 'Ski Mask The Slump God'),
  ('Handsome And Wealthy', 'Migos')
ON CONFLICT DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
