# Decision: oauth_connections_unified VIEW for admin tab

**Date**: 2026-05-30

## Context

The admin OAuth tab (`web/src/components/admin/OAuthTab.tsx`) was
empty. It queries `web/api/admin/oauth.ts`, which selected from the
legacy table `public.oauth_connections`. That table is unused —
live tokens have been split across per-provider tables since
mid-2026:

- `public.spotify_tokens` — primary key `user_id`
- `public.obsession_strava_tokens` — primary key `user_id`

(Discord and MyNetDiary handshakes live in
`public.oauth_connections` still, but Stone is not actively using
them; for now the relevant providers are Spotify + Strava.)

## Decision

Create a **read-only VIEW** `public.oauth_connections_unified` that
UNION ALL's the live tables, plus update the admin handler to do
provider-routed writes.

```sql
CREATE OR REPLACE VIEW public.oauth_connections_unified
WITH (security_invoker = true) AS
SELECT
  ('spotify:' || user_id::text) AS id,
  user_id,
  'spotify'::text AS provider,
  scope, expires_at, created_at, updated_at
FROM public.spotify_tokens
UNION ALL
SELECT
  ('strava:' || user_id::text) AS id,
  user_id,
  'strava'::text AS provider,
  scope, expires_at, created_at, updated_at
FROM public.obsession_strava_tokens;
```

### Why a view, not a table

- No write-amplification — the per-provider tables stay canonical.
- No drift — `created_at`/`updated_at` are exactly what the live
  rows hold.
- `security_invoker = true` (PG 15+) makes RLS evaluate against
  the calling role, so the existing per-table policies still
  govern access. Admin code uses the service role anyway, which
  bypasses RLS.

### Synthetic ID

The view has no natural single-column PK. The admin UI needs a
stable row key, and DELETE needs to identify which provider table
to touch. Synthetic ID `${provider}:${user_id}` solves both:

- React `key={row.id}` is stable.
- `web/api/admin/oauth.ts` splits the ID at `:` to route the
  DELETE to `spotify_tokens` or `obsession_strava_tokens`.

### Naming compromise

Stone's spec said the view should be `oauth_connections`. But
`oauth_connections` already exists as a real table. Renaming or
dropping that table would have been destructive (Discord +
MyNetDiary still write there). The view is suffixed `_unified` —
slightly less elegant, but does not collide.

## Alternatives Considered

- **Materialized view**: rejected. Adds refresh-policy complexity
  for a feature called once per admin page load.
- **Rewrite admin handler to query all three tables and merge in
  Node**: rejected. Three round-trips instead of one. Pagination
  becomes weird. View pushes the merge into Postgres.
- **Add Discord + MyNetDiary to the view**: deferred. Those
  rows live in the existing `oauth_connections` table; merging in
  would require a fourth source. Will add when Stone enables those
  providers in earnest.

## Files

- Migration: `web/supabase/migrations/20260530000001_oauth_connections_unified_view.sql`
- Handler: `web/api/admin/oauth.ts` (provider-routed DELETE)
- UI: `web/src/components/admin/OAuthTab.tsx`
  (`encodeURIComponent` on the synthetic ID for the URL)

## Status

Shipped. Migration applied via `supabase db push` from `web/`.
