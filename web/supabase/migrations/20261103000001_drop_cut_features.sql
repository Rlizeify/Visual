-- Phase 1C: drop database objects for features cut on 2026-11-03.
--
-- STATUS: NOT APPLIED. Committed unapplied on purpose:
--   1. No backup exists yet. The cloud session that wrote this had only the
--      public anon key (RLS hides most rows), so it could not export these
--      tables. Back them up first (see "Before applying").
--   2. Prod has drifted from migrations before (20260523000001 was recorded
--      as applied but its FK was never created), so FKs/dependents in prod
--      could not be confirmed against information_schema.
--
-- Owner decisions (2026-11-03): Life Scores cut entirely; Discord and
-- MyNetDiary API-key connectors cut; admin slimmed to users + presets;
-- /api/settings removed (it never worked). Code using every object below was
-- removed in commits 3433c1e, 67c224b and 65426c2. Surviving code on main
-- has zero references to any of them (re-grepped before writing this).
--
-- Deliberately KEPT (do not add here):
--   profiles, spotify_tokens, visualizer_presets, keepalive, avatars bucket,
--   option_candidates, investing_scenarios, market_snapshot, all obsession_*,
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
-- Before applying:
--   pg_dump "$SUPABASE_DB_URL" --data-only --format=custom \
--     -t public.user_scores -t public.score_events -t public.life_score_derivatives \
--     -t public.life_score_samples -t public.user_position_history \
--     -t public.user_listening_stats -t public.scoring_field_weights \
--     -t public.recompute_locks -t public.spotify_play_history \
--     -t public.leaderboard_config -t public.user_score_visibility \
--     -t public.tooltip_defaults -t public.tooltip_overrides \
--     -t public.oauth_connections -t public.user_settings \
--     -f backups/db-20261103/cut_features.dump
--   and record row counts per table in backups/db-20261103/manifest.json.

BEGIN;

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

COMMIT;

-- After applying, verify (expect 0 rows):
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN (
--     'user_scores','score_events','life_score_derivatives','life_score_samples',
--     'user_position_history','user_listening_stats','scoring_field_weights',
--     'recompute_locks','spotify_play_history','leaderboard_config',
--     'user_score_visibility','tooltip_defaults','tooltip_overrides',
--     'oauth_connections','oauth_connections_unified','user_settings');
-- and that every KEEP table above still exists with RLS enabled:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname;
