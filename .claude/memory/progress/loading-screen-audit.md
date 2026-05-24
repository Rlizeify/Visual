# Loading Screen — Audit (PART 1)

Date: 2026-05-24. Triggered by Stone's report: a poisoned localStorage
state caused the app to hang on the loading spinner forever. He had
to clear localStorage via DevTools paste to recover.

## Current state

There is **no `LoadingScreen.tsx`**. The splash is duplicated inline
in `web/src/App.tsx` at two locations:

1. Lines 117-150 — rendered when `authLoading || loading` is true.
2. Lines 154-187 — rendered when `session && pathname in ['/login',
   '/signup', '/']` to prevent the auth form from flashing for
   already-authed users.

Both blocks are identical: black background, `MHEU` wordmark, a
spinning circle made from a border + `@keyframes mheu-spin`. Styling
uses CSS custom properties from `web/src/styles/tokens.css`
(`--color-bg`, `--accent-color`, `--accent-color-glow`,
`--accent-color-dim`, `--accent-color-bright`, `--font-ui`).

There is **no time limit, no recovery action, no diagnostic message**.
If a dependency hangs, the spinner spins until the user closes the
tab.

## What the loading screen waits on

`authLoading` flips false when `supabase.auth.getSession()` resolves
(inside `AuthContext.tsx`, lines 38-44). This is the canonical "boot
loading" condition.

`loading` is local to `AppRoutes` and flips to true in two paths:

- `/callback` (lines 72-87) — set true on entry, set false after
  `handleCallback()` (which now awaits `setTokens(...)` → Supabase
  upsert) AND `postSessionAuth(...)` resolve.
- `/spotify-login` (lines 90-102) — set true if `hasRefreshToken()`
  is true, set false after `refreshToken()` resolves.

`ThemeProvider` mounts inside the same tree but does NOT gate the
loading screen — its hydration is fire-and-forget and any throw is
caught by `ThemeErrorBoundary`. So a broken theme cannot hang the
splash, only the ErrorBoundary fallback can take over the visible
tree.

The Spotify `tokenStore.setUserAndHydrate` is also fire-and-forget
from a `useEffect` in `AppRoutes`. It does NOT gate the splash —
even if it hangs, the splash already cleared once `authLoading`
flipped false.

## Failure modes (every way the splash can stick)

| # | Condition | Stuck because |
|---|---|---|
| 1 | `supabase.auth.getSession()` never resolves | `authLoading` stays true. Causes: Supabase outage, blocked network, corrupted session token in localStorage that throws inside the auth lib's hydration. |
| 2 | `supabase.auth.getSession()` throws synchronously during AuthContext effect setup | Same outcome — initial state stays `loading: true`. Currently NOT in a try/catch. |
| 3 | OAuth callback: `handleCallback()` hangs on `accounts.spotify.com/api/token` POST | `loading` stays true. No timeout set on the `fetch`. |
| 4 | OAuth callback: `setTokens(...)` hangs because the Supabase upsert never resolves | Same. `setTokens` awaits supabase, no timeout. |
| 5 | OAuth callback: `postSessionAuth(token)` hangs on `/api/auth` POST | Same. The `try/catch` inside swallows errors but never times out. |
| 6 | `tokenStore.setUserAndHydrate` throws synchronously during App boot | Doesn't directly stick the splash (it's fire-and-forget), BUT if the throw happens inside a React render path (e.g., a module side-effect) the whole tree may unmount and the error bubbles to React's default empty render. |
| 7 | **Migration shim corruption** (Stone's case) | `migrateFromLocalStorage` reads three legacy keys then calls `new Date(parseInt(expiry, 10)).toISOString()`. For `expiry = "Infinity"` or other pathological strings the Date constructor produces an Invalid Date and `.toISOString()` throws `RangeError`. The throw propagates up through `setUserAndHydrate` since the `try/catch` only covers the synchronous `getItem` calls, not the body that follows. |
| 8 | `fonts/HitmarkerText` font file 404 / hangs | Splash renders with fallback `monospace`. Not stuck, just ugly. Listed for completeness. |
| 9 | localStorage quota exceeded during a write inside the splash render | None — splash doesn't write storage. Not a risk. |
| 10 | Service worker stuck caching an old asset | Page loads, splash never advances because the old JS doesn't know about new endpoints. Hard to detect; the proposed "clear cache + unregister SW + reload" action covers it. |

## Findings summary

Stone's case maps to **mode 7**. The migration shim's `try/catch` is
too narrow — it covers the three `getItem` calls, but the unsafe
work (`parseInt`, `new Date(...).toISOString()`, the `await persist`,
the `clearLegacyLocalStorage`) all run outside it. A pathological
legacy value can throw out of the shim, bubble through the awaited
chain in `setUserAndHydrate`, and (since `setUserAndHydrate` is
called as `void setUserAndHydrate(user.id)` from a React effect)
manifest as an unhandled promise rejection that drops the user on a
blank screen rather than the splash — but combined with a partially-
loaded React tree the visible outcome can be a forever spinner.

Modes 1, 3, 4, 5 all share the same structural issue: no timeout on
async work, no upper bound on the splash. The self-healing loading
screen addresses these collectively by giving the user a recovery
path at 15s and auto-clearing cache at 30s.

## Out of scope for this change

- Adding `Promise.race`-style timeouts to individual fetches.
- Replacing the Supabase client.
- Service-worker registration (none currently exists; the
  unregister-SW step in the clear-cache action is preemptive).
