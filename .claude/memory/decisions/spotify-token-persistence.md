# Spotify Token Persistence Architecture

Date: 2026-05-24. Supersedes the localStorage-only persistence in
place since the original Spotify login work.

## Context

Spotify OAuth tokens lived exclusively in browser localStorage under
`mheu_access_token` / `mheu_refresh_token` / `mheu_token_expiry`. A
user signing in on a second browser, after clearing site data, or on
a TV after a session purge had to re-link Spotify every time. The
link followed the browser, not the account.

## Decision

Supabase is the source of truth. An in-memory cache fronts every read
for performance. Local storage is no longer written — it's only read
once for a one-time migration of pre-existing users.

### Surface map

- Table `public.spotify_tokens` (migration
  `20260524000002_add_spotify_tokens_table.sql`): one row per user_id
  with `access_token`, `refresh_token`, `expires_at`, `scope`,
  `created_at`, `updated_at`. Self-only RLS — users can only see /
  insert / update / delete their own row. Updated_at refreshed by
  a `BEFORE UPDATE` trigger.
- Module `web/src/services/spotify/tokenStore.ts` owns the in-memory
  cache, the Supabase persistence layer, and the migration shim. It
  exposes:
  - reads: `getAccessToken()`, `getRefreshToken()`, `getExpiresAtMs()`,
    `hasTokens()`
  - lifecycle: `setUserAndHydrate(userId)`, `setTokens(t)`,
    `updateAccess(...)`, `clearLocal()`, `disconnect()`,
    `notifyRefreshInvalid()`
  - events: `subscribe(fn)` — `save_failed`, `load_failed`,
    `refresh_invalid`, `migrated`
- Module `web/src/services/spotify/tokens.ts` is now a thin adapter
  over tokenStore — preserves the legacy import surface (player.ts,
  polling.ts, session.ts, App.tsx unchanged).
- `auth.ts handleCallback()` writes via `setTokens(...)`.
- `App.tsx` calls `setUserAndHydrate(user.id)` once Supabase auth
  hydrates the user. Subscribes to events for the top-of-page banner.
- Both `ProfileDropdown.tsx` files add a "Disconnect Spotify" button
  that calls `disconnectSpotify()` (alias of `tokenStore.disconnect()`).

### Lifecycle

| Event | Memory | Supabase | localStorage |
|---|---|---|---|
| OAuth callback success | written | upsert | untouched |
| Refresh success | updated | upsert | untouched |
| App boot, Supabase user available | hydrated from row OR migrated from legacy keys | row or new from migration | cleared on migration |
| Sign-out | cleared | preserved | preserved (will be cleared on next migration check) |
| Disconnect Spotify | cleared | deleted | cleared |
| Refresh returns 400/401 | cleared via disconnect | deleted | cleared |

### Hydration cache

`sessionStorage.mheu_spotify_hydrated = <user_id>` is set after a
successful hydrate (and after persist/migrate). Subsequent calls to
`setUserAndHydrate(userId)` within the same tab/session skip the
Supabase round-trip.

### Migration shim (one-time, dormant after 2026-06-23)

`migrateFromLocalStorage(userId)` runs only when there's no Supabase
row but valid legacy keys are present. It upserts to Supabase, then
clears the legacy keys. The clear happens even if the upsert fails,
so the legacy keys don't shadow the Supabase truth on retry. A
`migrated` event is emitted purely for observability.

The TODO marker in tokenStore.ts (`TODO(2026-06-23)`) flags the
shim for removal. After that date users who haven't signed in
during the migration window simply re-link manually — same UX as a
brand-new browser.

### Defensive coding

- Supabase upsert failure → log + emit `save_failed`. Tokens stay
  functional in memory; a banner tells the user re-link may be
  needed on other devices.
- Supabase read failure on boot → log + emit `load_failed`. App
  treats the user as "not linked" — the LoginPage / spotify-login
  flow is the same path they'd take normally.
- Refresh returns 400/401 → `notifyRefreshInvalid()` clears the row
  + memory + legacy keys, emits `refresh_invalid`. Banner prompts
  the user to reconnect.

### Cross-tab / race notes

localStorage is per-origin, so two open tabs both see the same legacy
keys during migration. Race conditions on `refreshToken()` are
unchanged from the legacy design — Supabase as truth makes
last-write-wins acceptable. A future change can listen on the
`storage` event or re-hydrate from Supabase on 401 before retrying.

## Reasoning

Alternatives considered:

- **Server-only tokens (refresh on backend)**: would mean adding a
  Vercel function for the Spotify proxy. We're at 12/12 on the Hobby
  plan; not viable today. Client-side refresh keeps the function
  budget intact and the Spotify Web API CORS-allows browser calls
  on the documented surfaces.
- **Encrypt at rest (pgcrypto)**: deferred. Tokens are bound by RLS
  to the user; the service-role key is the only path around RLS and
  it stays server-side. The OAuth-connections table for life-score
  connectors already uses pgcrypto for tokens; we can fold spotify
  in later if a third party needs decrypted reads. Not in this PR.
- **Drop localStorage migration**: simpler but forces every existing
  user to re-link on first visit post-deploy. 30-day shim lets the
  rollout be invisible.
