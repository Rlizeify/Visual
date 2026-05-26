# Obsession — Architecture Decisions

**Date**: 2026-05-25
**Status**: shipped

## Context

Build a per-user, hidden, AC-130-locked self-discipline surface
without disturbing the rest of the app. Five separate sub-features
(meditations / training / lifts / amor / settings) need their own
state, server endpoints, and visual chrome — but they share a
locked-down look and a single hidden entry point.

## Decisions

### 1. Easter-egg keystroke listener for access

The feature is hidden. No nav tile, no link. Entry is `useObsessionEgg()`
mounted from `App.tsx` (once auth resolves) — a window-level keydown
listener that buffers the last 9 keys and routes to `/obsession` on
`endsWith('obsession')`.

Skip conditions:
- `document.activeElement.tagName ∈ {INPUT, TEXTAREA}` or `isContentEditable`
- `e.metaKey || e.ctrlKey || e.altKey`
- No signed-in user
- > 3000ms gap since last key (buffer resets)

**Why**: keeps the surface private without auth gymnastics. Stone
knows the egg; nobody else needs to.

### 2. DOM-only theme override in a subtree

`ThemeOverrideProvider id="ac130-thermal"` wraps `<Routes>` inside
`ObsessionRoutes`. It mutates `document.documentElement.dataset.theme`
on mount and restores the prior value on unmount. **It does NOT call
`setTheme()`** on the shared `ThemeContext`, so the user's chosen
theme persists for the rest of the app.

**Why**: the theme override is presentational only. Writing back
through `ThemeContext` would persist to `profiles.theme_id` and
permanently flip the user's theme just because they triggered the
egg. The DOM-only override scopes the AC-130 look to `/obsession/*`
without side effects.

### 3. Per-user RLS, no admin surface

All 11 `obsession_*` tables have RLS `auth.uid() = user_id` for both
read and write. Quote pool is read-anyone, no write policy (seed
via service role). No admin views — obsession is private to the
user. The service role is never used for obsession reads.

**Why**: the entire feature is a personal discipline tool. Admin
visibility into someone's meditations or lifts would defeat the
purpose. Per-user RLS is the minimum-surface enforcement.

### 4. Strava OAuth folded into existing `api/oauth.ts`

Vercel Hobby tier caps at 12 functions, and we're at the ceiling.
Strava handshake (start + callback) + sync all live in
`api/oauth.ts` via `?provider=strava` and `?action=strava-sync`
branches. No new function file.

**Why**: the alternative is paying for Vercel Pro. The router pattern
is already there for Discord and MyNetDiary; Strava slots in
cleanly. Tokens stored plain-text in `obsession_strava_tokens`
(matches schema — encryption is a future hardening pass).

### 5. Wall-clock elapsed for 7-min discipline

The draft row stores `started_at`; every tick of the write-surface
timer recomputes elapsed from `Date.now() - startedAt` rather than
counting `setInterval` ticks. Backgrounded or sleeping tabs snap
to the correct elapsed value on resume.

**Why**: `setInterval` skews wildly under tab throttling. The
discipline cap (and the auto-submit at duration) must be honest
about wall time. Storing `started_at` server-side also lets the
write surface resume across browsers / devices.

### 6. Routing gate exempts obsession routes

The Spotify hydration gate in `AppRoutes` does an
`if (isObsessionRoute) return` before its routing decision, so the
egg never bounces a Spotify-linked user through `/spotify-login`
before landing.

**Why**: the egg is a goto. It must work from any auth state without
the surrounding app's routing logic interfering. The exemption is
the smallest-surface fix; the gate still runs for all other routes.

### 7. No new dependencies

CSV parsing is hand-rolled in `lib/training.ts` (handles quoted
fields with embedded commas + escaped quotes — sufficient for
MyNetDiary export). Export bundles ship as JSON/CSV via `Blob` +
`URL.createObjectURL`, not JSZip.

**Why**: keeps the dep tree clean. Both libs would add ~30 KB
gzipped for one use site each. Hand-rolled equivalents are ~40
lines total.

## Files

| File | Role |
|------|------|
| `web/src/features/obsession/useObsessionEgg.ts` | Keystroke listener hook |
| `web/src/features/obsession/ThemeOverrideProvider.tsx` | DOM-only theme override |
| `web/src/features/obsession/ObsessionRoutes.tsx` | `<Routes>` for `/obsession/*` |
| `web/src/features/obsession/ObsessionLayout.tsx` | Shared HUD shell |
| `web/src/features/obsession/lib/*.ts` | Types, helpers, CRUD, export |
| `web/src/features/obsession/pages/*.tsx` | Surface pages |
| `web/src/App.tsx` | Egg + exemption + route mount |
| `web/api/oauth.ts` | Strava handlers folded in |
| `web/supabase/migrations/20260525120000_obsession_tables.sql` | 11 tables + RLS |

## Open follow-ups

- Strava token encryption (pgcrypto) — currently plain text.
- Quote pool seeding (table exists, empty).
- Bundle size pass (1.56 MB / 370 kB gzipped — over Vite warn
  threshold but non-blocking).
- Mobile pass — feature is desktop-primary, mobile is degraded.
