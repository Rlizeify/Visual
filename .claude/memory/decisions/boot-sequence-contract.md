# Decision: Boot sequence contract — LoadingScreen owns first paint

**Date**: 2026-05-25
**Status**: Adopted
**Supersedes**: implicit boot flow from `aff02d1` + `6a33fff`.

## Problem

After `aff02d1` (Spotify token persistence) shipped, refreshing on
`/m` (or any MHEU route) with a linked Spotify briefly routed through
`/spotify-login` before snapping back to the main app. LoadingScreen
did not cover the gap. Root cause documented in
`.claude/memory/progress/spotify-login-redirect-bug.md` —
`setUserAndHydrate` was fire-and-forget, three different effects
read `mem` synchronously before hydration finished, and the
MHEU-route protector fired during the first render with `session`
still null.

## Contract

> **AppRoutes must not make a routing decision for a signed-in user
> until the Spotify hydration state machine has left `'loading'`.
> Until then, LoadingScreen is on screen.**

### Hydration state machine

`type SpotifyHydration = 'idle' | 'loading' | 'linked' | 'not-linked' | 'error'`

| State | Meaning | Routing implication |
|---|---|---|
| `idle` | No signed-in user. | LoadingScreen until session resolves. |
| `loading` | `setUserAndHydrate` in flight. | LoadingScreen. |
| `linked` | Row present in `mem`. `hasTokens() === true`. | Allow `/m`. |
| `not-linked` | Row absent, no migratable legacy keys. | Force `/spotify-login`. |
| `error` | Supabase down OR 8s timeout. | Treat as `not-linked` for routing; surface a banner. |

State transitions:

- `user?.id` becomes defined → `'loading'`.
- `setUserAndHydrate` resolves → `'linked'` / `'not-linked'` / `'error'`.
- Sign-out → `'idle'`.
- `refresh_invalid` event from Spotify refresh failure → `'not-linked'`.
- `/callback` writes new tokens via `setTokens()` → caller explicitly sets `'linked'`.

### `booting` derived flag

```ts
const booting =
  authLoading ||
  loading ||
  (!!session && (spotifyHydration === 'idle' || spotifyHydration === 'loading'))
```

- `authLoading` — Supabase session hydration. Resolves to `false`
  whether session is null or populated.
- `loading` — only set by `/callback` and the silent-refresh path on
  `/spotify-login`.
- The third clause keeps the splash up for signed-in users whose
  Spotify tokens are still loading.

When `booting === true`, AppRoutes returns `<LoadingScreen />`. All
routing decision effects bail at the top with `if (booting) return`.

### Routing decision (single effect)

After boot completes, a single effect runs the gate:

1. Not signed in (and not localhost): redirect to `/login` unless
   already on a public route (`/login`, `/signup`, `/callback`,
   `/admin/login`, `/admin`).
2. Signed in, on `/login` `/signup` `/`: redirect to `/m` if linked,
   else `/spotify-login`.
3. Signed in, on `/spotify-login`, linked: redirect to `/m`.
4. Signed in, on MHEU route, not linked: redirect to `/spotify-login`.

All four use `replace: true` so the browser back button doesn't
recover bad intermediate URLs.

### Splash backstop

For the brief frame between a `navigate(..., {replace: true})` call
and the next render landing on the new pathname, AppRoutes also
shows LoadingScreen instead of the about-to-be-replaced page:

```ts
if (session) {
  if (pathname === '/login' || pathname === '/signup' || pathname === '/') {
    return <LoadingScreen />
  }
  if (pathname === '/spotify-login' && spotifyLinked) {
    return <LoadingScreen />
  }
}
```

This is belt-and-suspenders — the boot gate already prevents the
race that lands a linked user on `/spotify-login`.

## Defensive coding

`setUserAndHydrate` races the Supabase round-trip against an 8s
`setTimeout`. If Supabase doesn't answer in time, the outcome is
`'error'` (treated as `'not-linked'` for routing). A `load_failed`
event is emitted so the banner can surface "couldn't reach Spotify
token storage". This guarantees boot completes in bounded time even
when Supabase is dead.

`setUserAndHydrate` never throws. The internal `try/catch` blocks
in `hydrate` and `migrateFromLocalStorage` swallow everything and
either emit a `load_failed` event or return the appropriate outcome.
The `.catch()` on the App.tsx side is a paranoid backstop.

## Out of scope

- Server-side redirects / Vercel edge rules — none exist; SPA
  fallback serves `index.html` for every path.
- LoadingScreen internals (the 4-stage timeline + self-healing
  recovery) are unchanged from `6a33fff`.
- Cross-tab token sync — still last-write-wins, deferred.
