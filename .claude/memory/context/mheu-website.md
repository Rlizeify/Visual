# MHEU Web App — Source of Truth

Last refreshed: 2026-05-23 against commit `3fe0265` on `main`.

## What this is

`https://mheu.lol` — the active product. A React + Vite SPA in `/web`
deployed to Vercel, with Supabase for auth/data and a serverless cron
for daily score recompute. The Electron "Visual" desktop is retired
into `legacy/desktop/` and is not part of this surface.

## Routes (web/src/App.tsx)

| Path | Component | Auth | Notes |
|---|---|---|---|
| `/login` | `pages/Login` | none | Supabase email/password |
| `/signup` | `pages/Signup` | none | |
| `/spotify-login` | `features/spotify/LoginPage` | session | OAuth code-with-PKCE |
| `/callback` | (in-App handler) | none | Spotify OAuth return |
| `/admin/login` | `pages/AdminLogin` | none | Same Supabase session, gates on `is_admin` |
| `/admin` | `pages/AdminDashboard` | admin | Tabbed UI: Users, OAuth, LifeScores, Leaderboard, Scoring, ScoreVisibility, Passwords, Presets, Tooltips, Palette |
| `/m` | `tabs/MusicTab` (renders `null`) | session | Visualizer mounted at App root sits behind/over all routes |
| `/h` | `tabs/HealthTab` | session | "Coming Soon" stub |
| `/e` | `tabs/EntertainmentTab` | session | Entertainment placeholder + full `AccountPage` |
| `/u` | `tabs/UserCompetitionTab` | session | Leaderboard + social feed |
| `*` | redirect | — | `/login` (or `/m` on localhost) |

The four MHEU routes share the `MHEUShell` layout (56px nav, fog
overlay on H/E/U). The Butterchurn `VisualizerPage` is mounted once
in `App.tsx` inside a `position: fixed` div and stays mounted; its
z-index swaps between 100 (M) and 0 (everywhere else).

## Audio pipeline

One MediaStream (tab audio via `getDisplayMedia({audio:true})` or
system loopback via `getUserMedia`) feeds one `AudioContext` and one
shared `AnalyserNode` owned by the `VisualizerEngine` singleton in
`web/src/features/visualizer/`. Three consumers:

1. Butterchurn — `visualizer.connectAudio(sharedAnalyser)`.
2. Gear-icon SIGNAL meter — `engine.getCurrentSignalLevel()`.
3. `useAudioSource()` in `web/src/audio/` — 200-bucket ring buffer
   sampled at 100ms, downsamples in place, resets on Spotify trackId
   change. Feeds the M-tab `WaveformProgressBar`.

Capture requires one user gesture per session because
`getDisplayMedia` cannot be auto-restored. Decision filed in
`.claude/memory/decisions/audio-source-routing.md`. Full audit in
`.claude/memory/context/audio-pipeline-audit.md`.

## Spotify

**Used for:**
- Metadata: track name, artist, album art, position, duration,
  isPlaying, shuffle — via 5s polling in
  `services/spotify/polling.ts`.
- Commands: play, pause, next, previous, shuffle, **seek** — via
  `services/spotify/player.ts`. Seek is wired to the waveform
  progress bar; requires Premium + active device.
- Auth: OAuth code-with-PKCE in `services/spotify/auth.ts` plus
  `tokens.ts` (refresh) and `session.ts` (server-issued JWT for
  display-name persistence).

**Archived (2026-05-22, T2):** `/v1/audio-analysis` and
`/v1/audio-features` — both 403'd for most clients starting late
2024. Client moved to `web/src/archive/spotify-audio-analysis/`.
No Web Playback SDK in-app — DRM blocks AnalyserNode access (see
`decisions/reactivity-architecture.md`).

## Supabase schema

22 migrations under `web/supabase/migrations/`. Tables (public schema):
`profiles`, `users`, `oauth_connections`, `life_score_samples`,
`life_score_derivatives`, `visualizer_presets`, `leaderboard_config`,
`audit_log`, `user_scores`, `score_events`, `user_score_visibility`,
`tooltip_defaults`, `tooltip_overrides`, `user_listening_stats`,
`spotify_play_history`, `scoring_field_weights`,
`scoring_field_metadata`, `user_position_history`, `keepalive`, plus
the Supabase auth tables. RLS enabled on every public table.
`public.is_admin(uuid)` SECURITY DEFINER bypasses self-only RLS for
the admin role.

The two newest migrations are flagged as not-confirmed-against-prod:
- `20260522000001_keepalive.sql`
- `20260523000001_user_scores_profiles_fk.sql`

## API routes (web/api/)

**Helpers (no default export — not counted toward Vercel function limit):**
`_admin.ts`, `_auth.ts`, `_db.ts`, `_jwt.ts`, `admin/_admin.ts`.

| Endpoint | Status | Purpose |
|---|---|---|
| `auth.ts` | 200 | Supabase JWT issue + username lookup |
| `oauth.ts` | 200 | Discord + MyNetDiary OAuth handshakes |
| `scores.ts` | 200 (fixed `a296c88`) | Leaderboard / user-scores / events / recompute |
| `settings.ts` | 200 | User-tunable settings |
| `health.ts` | 200 | Readiness probe |
| `cron/recompute.ts` | 200 (daily cron) | Score recompute for stale rows + keepalive ping |
| `admin/users.ts` | 200 | CRUD + password reset/set (super-admin only) |
| `admin/leaderboard.ts` | 200 | List + replace slots + visibility |
| `admin/oauth.ts` | 200 | List + revoke our row |
| `admin/scoring.ts` | 200 | Field weights + effort multipliers |
| `admin/tooltips.ts` | 200 | Defaults + overrides |
| `admin/presets.ts` | 200 | Butterchurn preset visibility |

Function ceiling: 12/12 Hobby tier. Adding anything new requires
consolidating two existing ones first.

## Deployment

- Branch: single `main` on `origin` (no other remote branches).
- Submodules: none. `git ls-files --stage | grep ^160000` is empty.
- Vercel project: `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` ("project-iwmob").
  Root directory `web`, Node 24.x.
- Custom domain: mheu.lol (owned by this project).
- Vercel cron: `0 0 * * *` daily UTC midnight (Hobby limit). Hits
  `/api/cron/recompute` which pings `keepalive` first, then iterates
  stale user_scores rows.
- Guard scripts: `scripts/check-vercel-link.sh` + pre-commit hook
  block `web/.vercel/` drift.
- Always deploy from repo root: `npx vercel --prod`.

## What's shipped

- Real-time scoring engine, soft-cap 0-200 curve, prestige tiers
  100/150/180.
- 4 connectors: Spotify (live), Discord (plumbed, env missing),
  MyNetDiary (stub), AppleHealth (stub).
- Admin Scoring panel + accent color per user + Account UI with
  avatar uploads + admin Palette tab.
- T2 audio pipeline (2026-05-22) — single shared AnalyserNode, three
  consumers, Spotify analysis archived.
- T3 waveform progress bar (2026-05-23) — SVG path with Catmull-Rom
  smoothing, idle 5px flush to nav, active 72px peaks, click-to-seek.
- T4 social feed (2026-05-23) — `features/feed/` module with avatars,
  magnitude badges, deterministic verbs, inline expand, slide-in,
  server-enforced `reveal_action`.
- Supabase keepalive (client + cron) to prevent 7-day auto-pause.

## What's broken or partial

- H tab is a "Coming Soon" stub.
- Entertainment half of the E tab is a placeholder (Account UI is
  fine).
- Discord connector returns nothing — env vars not set on Vercel.
- Vercel Deployment Protection state not confirmed.
- Migrations `20260522000001` and `20260523000001` not confirmed
  applied to production.
- Spotify Premium gating for the waveform `seek()` call — free
  accounts silently fail.

## What's next

See `roadmap.md`. Top of stack: apply the two new migrations,
configure Discord env vars, decide Deployment Protection,
flesh out the H and E (entertainment) tabs.
