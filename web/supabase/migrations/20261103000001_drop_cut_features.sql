-- Phase 1C: drop database objects for features cut on 2026-11-03.
--
-- STATUS: APPLIED 2026-11-08 (owner, SQL Editor; verified: no target left in
-- public, backup row counts match the manifest, backup schema RLS on and
-- unreachable by anon/authenticated). First owner run rolled back: prod policy
-- "Public can read leaderboard users' profiles" on profiles depends on
-- leaderboard_config. It let anonymous visitors read the profile of anyone
-- on the leaderboard, so it is dropped below. pg_depend was re-checked
-- 2026-11-08: no other policy, view, FK or function outside this list
-- references these tables.
--
-- Owner decisions (2026-11-03): Life Scores cut entirely; Discord and
-- MyNetDiary API-key connectors cut; admin slimmed to users + presets;
-- /api/settings removed (it never worked). Strava cut entirely (added
-- 2026-11-03 in the full refactor: OAuth handler, Obsession Training connect
-- UI and the source-conflict preference were removed from code). Code using every object below was
-- removed in commits 3433c1e, 67c224b and 65426c2. Surviving code on main
-- has zero references to any of them (re-grepped before writing this).
--
-- Deliberately KEPT (do not add here):
--   profiles, spotify_tokens, visualizer_presets, keepalive, avatars bucket,
--   option_candidates, investing_scenarios, market_snapshot, every non-Strava
--   obsession_* table,
--   audit_log (admin users handler writes it), app_settings and
--   accent_color_palette (ProfileDropdown reads them), users (Spotify sign-in
--   writes it; locked down separately in 20261103000002),
--   public.update_updated_at() (generic trigger fn; prod may use it elsewhere),
--   public.is_admin(), public.handle_new_user(), public.bootstrap_admin(),
--   public.backfill_usernames().
--
-- No surviving table has a foreign key INTO any table below; these tables
-- only reference profiles(id) / auth.users(id). Dropping a table also drops
-- its own policies, triggers, indexes and outbound FKs.
--
-- RESTRICT (the default) is used on purpose, not CASCADE: if prod has an
-- unexpected dependent object, the transaction fails and rolls back instead
-- of silently dropping something we did not review.
--
-- Backup: ~15k rows (mostly spotify_play_history) are copied into schema
-- backup_20261108 in the same transaction, then dropped from public. The
-- schema is not exposed by PostgREST and no client role has any grant on it.
-- Row counts: backups/db-20261108/manifest.json (gitignored). Drop the
-- schema once nobody needs the old data: DROP SCHEMA backup_20261108 CASCADE;

BEGIN;

CREATE SCHEMA IF NOT EXISTS backup_20261108;
REVOKE ALL ON SCHEMA backup_20261108 FROM PUBLIC, anon, authenticated;
CREATE TABLE backup_20261108.user_scores AS TABLE public.user_scores;
CREATE TABLE backup_20261108.score_events AS TABLE public.score_events;
CREATE TABLE backup_20261108.life_score_derivatives AS TABLE public.life_score_derivatives;
CREATE TABLE backup_20261108.life_score_samples AS TABLE public.life_score_samples;
CREATE TABLE backup_20261108.user_position_history AS TABLE public.user_position_history;
CREATE TABLE backup_20261108.user_listening_stats AS TABLE public.user_listening_stats;
CREATE TABLE backup_20261108.scoring_field_weights AS TABLE public.scoring_field_weights;
CREATE TABLE backup_20261108.recompute_locks AS TABLE public.recompute_locks;
CREATE TABLE backup_20261108.spotify_play_history AS TABLE public.spotify_play_history;
CREATE TABLE backup_20261108.leaderboard_config AS TABLE public.leaderboard_config;
CREATE TABLE backup_20261108.user_score_visibility AS TABLE public.user_score_visibility;
CREATE TABLE backup_20261108.tooltip_defaults AS TABLE public.tooltip_defaults;
CREATE TABLE backup_20261108.tooltip_overrides AS TABLE public.tooltip_overrides;
CREATE TABLE backup_20261108.obsession_preferences_conflicts AS
  SELECT user_id, source_preference_conflicts FROM public.obsession_preferences
  WHERE source_preference_conflicts IS NOT NULL;
-- oauth_connections, user_settings and both Strava tables are empty.
-- RLS with no policies on top of the schema revoke: unreadable by clients
-- even if the schema were ever exposed.
ALTER TABLE backup_20261108.user_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.life_score_derivatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.life_score_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.user_position_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.user_listening_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.scoring_field_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.recompute_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.spotify_play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.leaderboard_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.user_score_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.tooltip_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.tooltip_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_20261108.obsession_preferences_conflicts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA backup_20261108 FROM PUBLIC, anon, authenticated;

-- Cross-table policy that blocks dropping leaderboard_config (public read
-- of leaderboard users' profiles — a leak once the leaderboard is gone).
DROP POLICY IF EXISTS "Public can read leaderboard users' profiles" ON public.profiles;

-- Views first (depend on tables, including KEEP tables).
-- oauth_connections_unified: UNION of spotify_tokens + obsession_strava_tokens,
-- read only by the removed admin OAuth tab. The underlying tables stay.
DROP VIEW IF EXISTS public.oauth_connections_unified;

-- Life Scores: event/derived data.
DROP TABLE IF EXISTS public.score_events;            -- score change feed (cut feed)
DROP TABLE IF EXISTS public.life_score_derivatives;  -- derivative metrics (cut engine)
DROP TABLE IF EXISTS public.life_score_samples;      -- raw samples (cut engine)
DROP TABLE IF EXISTS public.user_position_history;   -- per-scale position history (cut cron)
DROP TABLE IF EXISTS public.user_listening_stats;    -- Spotify ingestion aggregates (cut cron)
DROP TABLE IF EXISTS public.spotify_play_history;    -- Spotify recently-played log (cut cron)
DROP TABLE IF EXISTS public.recompute_locks;         -- recompute rate limit (cut cron)
DROP TABLE IF EXISTS public.user_score_visibility;   -- reveal toggles (removed from ProfileDropdown)

-- Life Scores: config.
DROP TABLE IF EXISTS public.scoring_field_weights;   -- admin scoring tab (removed)
DROP TABLE IF EXISTS public.leaderboard_config;      -- admin leaderboard tab (removed)
DROP TABLE IF EXISTS public.tooltip_overrides;       -- admin tooltips tab (removed)
DROP TABLE IF EXISTS public.tooltip_defaults;        -- admin tooltips tab (removed)

-- Life Scores: snapshot table (score columns live here, none on profiles).
DROP TABLE IF EXISTS public.user_scores;

-- Connectors (Discord / MyNetDiary API key). Strava uses obsession_strava_tokens.
DROP TABLE IF EXISTS public.oauth_connections;
DROP FUNCTION IF EXISTS public.encrypt_token(text, text);   -- created for oauth_connections; no callers
DROP FUNCTION IF EXISTS public.decrypt_token(bytea, text);  -- created for oauth_connections; no callers

-- /api/settings (removed in 65426c2). Created by hand in prod, never by a
-- migration; the sync wrote null and its reads were ignored.
DROP TABLE IF EXISTS public.user_settings;

-- Strava (cut entirely). oauth_connections_unified, the only view over
-- obsession_strava_tokens, is dropped above. Its CHECK constraint goes with
-- the column; the default ('ask') meant no row ever needed it.
DROP TABLE IF EXISTS public.obsession_strava_activities;
DROP TABLE IF EXISTS public.obsession_strava_tokens;
ALTER TABLE public.obsession_preferences DROP COLUMN IF EXISTS source_preference_conflicts;

COMMIT;

-- After applying, verify (expect 0 rows):
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN (
--     'user_scores','score_events','life_score_derivatives','life_score_samples',
--     'user_position_history','user_listening_stats','scoring_field_weights',
--     'recompute_locks','spotify_play_history','leaderboard_config',
--     'user_score_visibility','tooltip_defaults','tooltip_overrides',
--     'oauth_connections','oauth_connections_unified','user_settings',
--     'obsession_strava_tokens','obsession_strava_activities');
--   SELECT column_name FROM information_schema.columns WHERE table_schema='public'
--   AND table_name='obsession_preferences' AND column_name='source_preference_conflicts';
-- Before applying, re-check prod for anything else Strava-shaped:
--   SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relname ILIKE '%strava%';
--   SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosrc ILIKE '%strava%';
-- and that every KEEP table above still exists with RLS enabled:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname;
