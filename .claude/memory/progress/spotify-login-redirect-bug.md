# Audit: /spotify-login flash on refresh + missing LoadingScreen

**Date**: 2026-05-25
**Triggered by**: regression after `aff02d1` (Spotify token persistence).
**Symptom**: refreshing on `/m` (or any MHEU route) with linked
Spotify briefly routes through `/spotify-login` before returning to
the main app. LoadingScreen does not cover the gap.

## Boot sequence today

### What App.tsx actually does

1. `AuthProvider` initializes with `loading=true`, `session=null`,
   `user=null`. Subscribes to `supabase.auth`.
2. `AppRoutes` mounts. Effects (all unconditional) fire after the
   first render, BEFORE `authLoading` resolves:
   - Line 51 (`setUserAndHydrate(user.id)`) — guarded by
     `if (!user?.id) return`. User is null. **Does nothing this pass.**
   - Line 82 (`/login` → spotify routing) — guarded by `if (authLoading) return`. **Does nothing this pass.**
   - Line 114 (`/spotify-login` auto-link) — fires only when pathname
     is `/spotify-login`. Not yet. **Does nothing this pass.**
   - Line 129 (MHEU route protect) — `if (isMHEURoute && !session && !isLocalhost) navigate('/login', { replace: true })`.
     **Fires.** No `authLoading` guard. URL becomes `/login`.
3. AppRoutes returns `<LoadingScreen />` (early return at line 142,
   `authLoading || loading`). LoadingScreen renders for the duration
   of Supabase auth hydration.
4. Supabase auth resolves. `authLoading=false`, `session=X`, `user=X`.
5. Render 2. `authLoading || loading` is false — LoadingScreen
   unmounts. AppRoutes renders `<Routes>`. pathname is `/login`
   now (from step 2). `<Login />` paints. **Auth form flashes.**
   (Existing guard at line 149 catches this with another LoadingScreen
   for `/login` `/signup` `/`. Good — flash is hidden HERE.)
6. Effects re-run with new deps:
   - Line 51: `setUserAndHydrate(user.id)` now fires. Async hydrate
     of `spotify_tokens` row begins. **No React state tracks this.**
   - Line 82: `session && pathname==='/login'`. Calls
     `isSpotifyAuthenticated()` synchronously. `mem` is `null`
     (hydrate hasn't resolved). Returns false. → `navigate('/spotify-login', { replace: true })`.
   - URL becomes `/spotify-login`.
7. Render 3. pathname is `/spotify-login`. The
   `session && (pathname==='/login'|'/signup'|'/')` guard at line 149
   does NOT match — `/spotify-login` is missing from that list.
   `<SpotifyLoginPage />` paints. **This is the visible flash.**
8. Effect at line 114 fires: pathname is `/spotify-login`.
   - `isSpotifyAuthenticated()` — `mem` still null. False.
   - `hasRefreshToken()` — `mem` still null. False.
   - Falls through both branches. **No redirect.**
9. `setUserAndHydrate` resolves. `mem` is now populated. BUT
   `mem` is module-level state — React doesn't see the change.
   No re-render. The effect at line 114 does NOT re-evaluate. User
   is stuck on `/spotify-login` showing the QR + Login button.
10. The "auto-completes the OAuth handshake" described in the bug
    report happens IF the user clicks Login (or via some other code
    path) — `LoginPage.tsx` builds an auth URL and redirects to
    `accounts.spotify.com`. After the round-trip the `/callback`
    handler navigates to `/m`. From the user's POV this looks like
    "auto-magic" because there's no flash of intent between QR
    appearing and the redirect happening.

### Why the LoadingScreen doesn't cover the flash

- It mounts on `authLoading || loading`.
- `authLoading` is true only during Supabase session hydration.
- The `loading` state (line 39) is set true only during `/callback`
  processing or the `/spotify-login` refresh-token path.
- Once `authLoading=false`, the LoadingScreen unmounts EVEN IF
  spotify_tokens is still loading. That gap is when `/spotify-login`
  becomes visible.
- `setUserAndHydrate` is fire-and-forget (`void setUserAndHydrate(user.id)`).
  No promise tracked, no resolve hook, no React state.

## Network panel evidence (from Stone's screenshot)

- First request after refresh: `GET mheu.lol/spotify-login` document.
  Confirms URL bar is at `/spotify-login` at refresh moment.
  → Either previous session left it there (no nav away on hydrate
  resolve) OR the race above ran on a prior refresh and the
  `replace: true` in the `/login` → `/spotify-login` chain stuck.
- Subsequent requests: `profiles?select=accent_color`,
  `profiles?select=theme_id`, `keepalive`. NO `spotify_tokens`
  request visible in that window.
  → Means `setUserAndHydrate` either hasn't fired yet (effect waits
  for `user?.id`) or fires after the visible flash. Either way the
  hydrate completes too late to affect the routing decision.

## Root cause

Routing decisions read `isSpotifyAuthenticated()` synchronously
before the in-memory cache is hydrated from Supabase. There is no
state machine tracking "has spotify_tokens been loaded yet". Three
specific defects compound:

1. **MHEU-protect effect (line 129) lacks an `authLoading` guard.**
   It fires during the first render while session is still null,
   force-pushing the URL to `/login`. This makes the user enter the
   `/login` → `/spotify-login` redirect chain even though they
   started on `/m`.
2. **`/login` → spotify redirect (line 82) reads token state
   synchronously.** Even if it had a guard, it can't know whether
   the absence of tokens in `mem` means "not linked" or "not loaded
   yet". It assumes the former.
3. **`setUserAndHydrate` is fire-and-forget.** No promise tracked.
   No re-render after resolve. The `/spotify-login` auto-link
   effect (line 114) runs once on pathname change with stale state
   and never re-evaluates.

## Fix shape

Introduce a `spotifyHydration` state in `AppRoutes`:
`'idle' | 'loading' | 'linked' | 'not-linked' | 'error'`.

- `idle` while no user.
- `loading` while `setUserAndHydrate` runs (with an 8s timeout).
- `linked` after hydrate completes AND `hasTokens()` returns true.
- `not-linked` after hydrate completes AND `hasTokens()` returns
  false, OR after the 8s timeout, OR after `load_failed` event.
- `error` only when we want a banner; for routing purposes it's
  treated as `not-linked`.

Gates:

- LoadingScreen shows when `authLoading || (session && spotifyHydration === 'loading')`.
- MHEU-protect effect waits for `!authLoading`.
- `/login` → spotify redirect waits for `spotifyHydration !== 'loading'`
  and reads `hasTokens()` only after that.
- `/spotify-login` auto-link no longer needs to do its own check —
  by the time the user lands on `/spotify-login`, we already know
  the state.

Add `/spotify-login` to the line-149 splash list so even a transient
flash through that pathname doesn't show the QR page.

## Files to touch

- `web/src/App.tsx` — add hydration state machine, gate effects, expand splash list.
- `web/src/services/spotify/tokenStore.ts` — add 8s timeout to `setUserAndHydrate` so callers can race it; also expose a `hasTokens()` reader (already there).
- `.claude/memory/decisions/boot-sequence-contract.md` — new decision doc.
- `.claude/memory/progress/changelog.md` + `context/active.md` — log fix.

## Edge cases

| Scenario | Expected | Notes |
|---|---|---|
| New user, no row | LoadingScreen → /spotify-login | hydrate resolves not-linked, /login effect routes |
| Returning user, valid tokens | LoadingScreen → /m | hydrate resolves linked, no /spotify-login flash |
| Expired access, valid refresh | LoadingScreen → /m | /m route's polling/play call hits refresh path automatically; no flash |
| Refresh token rejected | LoadingScreen → /spotify-login + banner | refresh path in polling/play emits `refresh_invalid`, banner shows |
| Supabase down | LoadingScreen → /spotify-login after 8s timeout, banner | treat as not-linked for routing |

## Out of scope

- Server-side redirects (no `_redirects`/edge rule in this repo —
  Vercel SPA fallback serves index.html for `/spotify-login` GET).
- AuthContext loading mechanism — unchanged.
- LoadingScreen internals — unchanged (already self-healing).
