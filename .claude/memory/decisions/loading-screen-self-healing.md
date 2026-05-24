# Loading Screen — Self-Healing Splash

**Date:** 2026-05-24
**Status:** Shipped
**Trigger:** Stone's `mheu_token_expiry = "Infinity"` corruption hung
the boot splash with no escape hatch other than DevTools.

## Decision

Replace the inline branded splash in `App.tsx` with a single
`LoadingScreen` component that progresses through four stages on a
fixed time budget, escalating from invisible (stage 1) to fully
autonomous recovery (stage 4):

| Stage | Window | Behavior |
|-------|--------|----------|
| 1 | 0-5s | Spinner only. Identical to v1 — no UI difference. |
| 2 | 5-15s | Adds aria-live "Loading is taking longer than usual." |
| 3 | 15-30s | Adds help card with three buttons: Try again, Clear cache & reload, Sign out & reload. |
| 4 | 30s+ | Auto-fires Clear cache & reload, shows red banner. |

A `sessionStorage.mheu_auto_recovered_at` flag (2-min TTL) prevents
infinite reload loops: if the splash reaches stage 4 again within
that window, the auto-trigger is skipped and a final error state
appears with a "Sign out and return to login" button.

## Why a single component, not a hook

The splash exists *before* the theme system, the auth context, or
even some CSS variables are guaranteed available. A component with
inline styles and hardcoded hex fallbacks is the only thing that can
render under all of those failure modes. A hook would have to be
mounted from somewhere, and that somewhere would inherit the same
fragility.

## Why setTimeout, not RAF

- Stages are tied to wall-clock time the user perceives, not paint
  rate. A 1Hz monitor or a backgrounded tab should still escalate.
- setTimeout is simpler to reason about and clear on unmount.
- RAF would pause when the tab loses focus — not what we want for
  a splash that needs to time out reliably.

## Why hardcoded hex fallbacks

`tokens.css` is loaded by `index.html` before the React bundle. If it
fails (CDN miss, corrupted cache, network blip mid-load) the splash
must still render. Every token reference uses CSS `var(--name, #hex)`
syntax with the brand color baked in. Brand fallbacks:

```
--color-bg            → #010103
--accent-color        → #00dcc8
--accent-color-dim    → rgba(0, 220, 200, 0.6)
--accent-color-bright → #00dcc8
--accent-color-glow   → rgba(0, 220, 200, 0.3)
```

## Why three recovery actions at stage 3

Each addresses a distinct failure class:

1. **Try again** — soft `location.reload()`. Fixes transient network
   blips, half-loaded JS chunks, supabase 5xx.
2. **Clear cache & reload** — `localStorage.clear() +
   sessionStorage.clear() + serviceWorker.unregister()`. Fixes
   poisoned client state (Stone's case), stale SW caches.
3. **Sign out & reload** — fire-and-forget `supabase.auth.signOut()`
   + `localStorage.clear()` + redirect to `/login`. Fixes broken
   auth tokens, corrupted Supabase session rows.

User picks the action whose blurb matches their suspicion. None
require knowing what the actual fault is.

## Why stage 4 auto-clears cache (not signs out)

Most stuck-boot cases are cache or storage corruption. Signing the
user out would destroy a working session for what's probably a
transient client problem. Clear-cache loses local state but preserves
the Supabase row (the source of truth post-2026-05-24 Spotify token
migration). If clear-cache doesn't fix it, the final error state
offers sign-out as the next step.

## Why no Sentry / no error reporting

Out of scope. The user already has a workaround (the help card).
Adding an error reporter would push us into asking about privacy
consent UI which isn't a fight worth picking today. If stuck-boot
rates climb post-ship, revisit.

## Files

- `web/src/components/LoadingScreen.tsx` — the component.
- `web/src/archive/loading-screen-v1/` — old inline JSX preserved.
- `.claude/memory/progress/loading-screen-audit.md` — 10 failure
  modes catalogued.

## Companion change (PART 1.5)

`web/src/services/spotify/tokenStore.ts`'s `migrateFromLocalStorage`
was hardened in the same commit: every step (parseInt validation,
`new Date(...).toISOString()`, `await persist`, the legacy-key
clear) is now in its own try/catch. A pathological legacy value can
no longer escape the shim and bubble out as an unhandled promise
rejection. Belt-and-suspenders: the loading screen catches the class
of failure, the shim hardening prevents this specific instance.

## What did NOT change

- No timeouts added to fetches in `auth.ts`, `tokenStore.ts`, or
  Supabase calls. Listed in the audit as out-of-scope.
- No service worker registration introduced — the unregister step
  in clear-cache is preemptive (we don't ship a SW today).
- Theme system unchanged. LoadingScreen is theme-neutral by design.
