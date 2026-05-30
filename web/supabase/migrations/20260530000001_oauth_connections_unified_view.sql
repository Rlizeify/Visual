-- Unified OAuth connections view for the admin tab.
--
-- WHY: per-provider tables (`spotify_tokens`, `obsession_strava_tokens`)
-- now hold the live OAuth state, but the admin OAuth tab still queries
-- the legacy `public.oauth_connections` table — which is empty for
-- most users because the live token flow bypasses it. Admin tab shows
-- "NO CONNECTIONS" despite users being actively linked.
--
-- WHAT: a view that UNIONs the per-provider token tables into a single
-- shape the admin can query. `security_invoker = true` so the
-- per-provider RLS on the underlying tables applies when a non-service
-- caller queries the view; service-role (admin endpoint) bypasses RLS
-- as usual.
--
-- NAMING: this view is `oauth_connections_unified` rather than plain
-- `oauth_connections` because the latter is an existing table with
-- live Discord / MyNetDiary writers. Once those providers move to
-- their own per-provider tables and the legacy table can be retired,
-- this view can be renamed.
--
-- ADDING PROVIDERS: append a UNION ALL branch with the same column
-- shape. Synthetic id is `${provider}:${user_id}` so the admin
-- handler can route DELETE to the correct underlying table.
--
-- BACKOUT: DROP VIEW IF EXISTS public.oauth_connections_unified;

CREATE OR REPLACE VIEW public.oauth_connections_unified
WITH (security_invoker = true) AS
SELECT
  ('spotify:' || user_id::text)            AS id,
  user_id,
  'spotify'::text                          AS provider,
  scope,
  expires_at,
  created_at,
  updated_at
FROM public.spotify_tokens

UNION ALL

SELECT
  ('strava:' || user_id::text)             AS id,
  user_id,
  'strava'::text                           AS provider,
  scope,
  expires_at,
  created_at,
  updated_at
FROM public.obsession_strava_tokens;

COMMENT ON VIEW public.oauth_connections_unified IS
  'Unified per-provider OAuth token view for admin. Synthetic id = provider:user_id. RLS cascades from underlying tables via security_invoker.';
