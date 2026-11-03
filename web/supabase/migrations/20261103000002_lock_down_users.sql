-- Lock down public.users (spotify_id, display_name, email).
--
-- STATUS: NOT APPLIED (committed with the Phase 1C batch). Safe to apply on
-- its own once commit 82f2784 is live — it is.
--
-- Problem: 20260509000003_create_users.sql granted anon-key policies of
-- using(true) / with check(true) for SELECT, INSERT and UPDATE. Anyone with
-- the public anon key (shipped in the web bundle) can read every user's
-- email and insert or overwrite any row. Verified 2026-11-03: an anon
-- SELECT returns real rows. The SELECT policy existed "for leaderboard
-- display"; the leaderboard is gone.
--
-- Fix: the only writer, /api/auth (Spotify sign-in), now uses the service
-- role (commit 82f2784), which bypasses RLS. Nothing reads the table from
-- the client. So: keep RLS enabled and remove every policy. Only the
-- service role can touch the table afterwards.

BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read users" ON public.users;
DROP POLICY IF EXISTS "Allow insert for Spotify login" ON public.users;
DROP POLICY IF EXISTS "Allow update for Spotify login" ON public.users;

COMMIT;

-- Verify (expect 0 rows): SELECT policyname FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'users';
-- And with the anon key: GET /rest/v1/users?select=*  →  [] (no rows visible).
