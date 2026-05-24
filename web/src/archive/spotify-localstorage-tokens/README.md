# Spotify localStorage Token Snapshot

Archived: 2026-05-24. Replaced by Supabase-backed persistence in
`services/spotify/tokenStore.ts`.

## What this is

Snapshot of the pre-rewrite `auth.ts` (token-writing portion) and the
entire `tokens.ts` module that persisted Spotify OAuth tokens in
browser `localStorage`. The keys used were:

- `mheu_access_token`
- `mheu_refresh_token`
- `mheu_token_expiry`

`clearAuth()` swept every `mheu_*` key, which had the side effect of
also nuking `mheu_session` (server-issued JWT for display name) and
`mheu_theme_id` (cached active theme).

## Why retired

Tokens were tied to the browser, not the Supabase user. Signing in
on a second device required a fresh Spotify re-link every time.

## Replacement

- Table: `public.spotify_tokens` (per-user, self-only RLS).
  Migration: `web/supabase/migrations/20260524000002_add_spotify_tokens_table.sql`.
- Module: `web/src/services/spotify/tokenStore.ts` — in-memory cache,
  Supabase as source of truth, one-time localStorage migration on
  first boot post-rewrite (sessionStorage flag skips on subsequent
  boots in the same session).
- Audit: `.claude/memory/progress/spotify-token-persistence-audit.md`
- Decision: `.claude/memory/decisions/spotify-token-persistence.md`

## Bringing it back

Don't. The Supabase-backed flow is strictly more capable; the legacy
keys are still recognized for migration only until ~2026-06-23.
