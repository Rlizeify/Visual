# Spotify Token Persistence — Audit (PART 1)

Date: 2026-05-24. Scope: every read/write of Spotify OAuth tokens in
`web/src/` plus the OAuth flow + identity context surrounding them.

## TL;DR

Spotify tokens live exclusively in browser `localStorage` under keys
`mheu_access_token`, `mheu_refresh_token`, `mheu_token_expiry`. They
have **no tie to the Supabase user**. Signing in on a new browser /
new device / after a `clearAuth()` wipe forces a full Spotify
re-link. Multiple tabs share the keys (localStorage is per-origin),
so race conditions exist on simultaneous refresh attempts but
currently cause only transient access_token churn — there is no
upstream mitigation.

## Files touching Spotify tokens

| File | Action |
|------|--------|
| `services/spotify/auth.ts` | OAuth code+PKCE exchange, **writes** `mheu_access_token`/`mheu_refresh_token`/`mheu_token_expiry`. Calls `clearAuth()` on early-exit. |
| `services/spotify/tokens.ts` | All token reads + the `refreshToken()` flow. **Writes** back the rotated access_token / refresh_token. `clearAuth()` deletes every `mheu_*` localStorage key (overbroad — also nukes `mheu_session` + `mheu_theme_id`). |
| `services/spotify/session.ts` | Reads access_token to call `/v1/me`. Stores `mheu_session` JWT (separate concern, **not** a Spotify token). |
| `services/spotify/player.ts` | Reads access_token for play/pause/next/prev/seek/shuffle. |
| `services/spotify/polling.ts` | Reads access_token for `/v1/me/player` polling. |
| `archive/spotify-audio-analysis/analysis.ts` | Archived. Still reads access_token in dead path — ignore. |
| `App.tsx` | Calls `isAuthenticated()`, `hasRefreshToken()`, `refreshToken()`, `clearAuth()`, `handleCallback()`. Mounts `/callback` handler. |
| `features/spotify/LoginPage.tsx` | Builds the auth URL; does not touch tokens. |

## OAuth flow today

1. User signs into Supabase (email/password or username/password) →
   `/login` → on success App.tsx routes to `/spotify-login` if not
   Spotify-authed, or `/m` if `isAuthenticated()` returns true.
2. `/spotify-login` shows the LoginPage QR + button → on click
   `window.location.href = buildAuthUrl()` (auth.ts) →
   `sessionStorage.code_verifier` saved.
3. Spotify redirects to `/callback` → App.tsx `useEffect` calls
   `handleCallback()` → POSTs to `accounts.spotify.com/api/token` →
   on success writes the three `mheu_*` keys to localStorage and
   clears the code_verifier → returns the access_token.
4. App then calls `postSessionAuth(token)` → POST `/api/auth` →
   server issues a JWT carrying `spotify_id` + `display_name`, stored
   as `mheu_session` localStorage.
5. Refresh: whenever any consumer needs a token and `isAuthenticated()`
   returns false but `hasRefreshToken()` is true, App.tsx calls
   `refreshToken()` (currently only on entry to `/spotify-login`).
   On success the new access_token + expiry overwrite localStorage,
   and if Spotify rotated the refresh_token that gets overwritten too.

## Supabase user_id availability at each step

- During OAuth flow the Supabase session is already established
  (`/spotify-login` is protected). `useAuth().user.id` is available
  inside React; `App.tsx` `handleCallback` effect runs inside the
  authed shell so it can reach the user.
- `services/spotify/*` modules are NOT React; they have no direct
  access to the Supabase user. Today they don't need it because
  everything is browser-scoped. After this change, they will need
  the user_id at: token write time (upsert), token read time
  (hydrate-on-boot), refresh time (write back), disconnect time
  (delete row). Resolution: a new `tokenStore` module owns an
  in-memory user_id + tokens; App.tsx feeds it the user_id after
  auth hydration.

## Cross-tab + race conditions

- localStorage is shared across tabs of the same origin. Two open
  tabs both see the same tokens.
- No mutex on `refreshToken()`. If two tabs simultaneously detect
  expiry and POST to `accounts.spotify.com/api/token`, both succeed
  individually, both write to localStorage, last-write-wins. Spotify
  accepts repeated grants on the same refresh_token until a rotation.
- When Spotify rotates the refresh_token (intermittent — not every
  refresh), the loser of the race ends up with a stale refresh_token
  in memory. Next refresh on that tab fails until reload.
- No `storage` event listener wires tabs together. Each tab calls
  `getAccessToken()` synchronously from localStorage so cross-tab
  updates are seen on next call.

After this change: same race exists, mitigated only by Supabase
being the source of truth. We add a TODO to re-hydrate from
Supabase on 401 before retrying, but that is not in this PR.

## What's in localStorage today (Spotify-related)

| Key | Set by | Read by | Notes |
|---|---|---|---|
| `mheu_access_token` | auth.ts, tokens.ts | tokens.ts, session.ts, player.ts, polling.ts | Removed by `clearAuth()` |
| `mheu_refresh_token` | auth.ts, tokens.ts | tokens.ts | Removed by `clearAuth()` |
| `mheu_token_expiry` | auth.ts, tokens.ts | tokens.ts | Removed by `clearAuth()` |
| `mheu_session` | session.ts | session.ts, VisualizerPage | NOT a Spotify token but currently swept by `clearAuth()` |

## Implications for the new design

1. New table `spotify_tokens(user_id pk, access_token, refresh_token,
   expires_at, scope, created_at, updated_at)` with self-only RLS.
2. New in-memory cache + persistence layer
   (`services/spotify/tokenStore.ts`) owns user_id + tokens. Existing
   token-read call sites unchanged (still call `getAccessToken()`).
3. `handleCallback()` writes tokens via tokenStore (upsert Supabase).
4. App boot: after Supabase auth hydration, `tokenStore.setUser(user.id)`
   hydrates from `spotify_tokens` row, running the one-time
   localStorage → Supabase migration if no row exists but valid local
   tokens do.
5. `refreshToken()` writes refreshed access_token (+ optional rotated
   refresh_token) via tokenStore.
6. Sign-out: clear in-memory only. Do NOT delete the Supabase row.
7. New "Disconnect Spotify" button in profile dropdown: deletes the
   Supabase row + clears in-memory tokens.
8. Narrow `clearAuth()` to spotify-only keys so it stops nuking
   `mheu_session` / `mheu_theme_id` as collateral.

## Open follow-ups (out of scope for this change)

- Cross-tab `storage` event listener so refresh by tab A wakes tab B.
- 401 retry path that re-hydrates from Supabase before failing.
- Eventually move Spotify analytics/audio-analysis client out of
  archive or delete entirely.
