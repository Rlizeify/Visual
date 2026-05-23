# Active Context

**Last updated**: 2026-05-23 (Session 13 — memory refresh)

## Current State

Memory refresh complete. All `.claude/memory/` files now match the
actual state of the code at commit `3fe0265` on `main`.

**No queued engineering task.** T1–T4 + the /api/scores 500 fix are
shipped and merged. The next moves are operational, not engineering:
apply two pending Supabase migrations, set Discord env vars on
Vercel, confirm Deployment Protection state.

## Active Product

MHEU web app at https://mheu.lol. Source tree `/web`. Electron
desktop is parked in `legacy/desktop/`.

## What's Live on mheu.lol

- Real-time scoring engine (soft-cap 0–200), 4 connectors, prestige
  tiers.
- M tab: Butterchurn + waveform progress bar (SVG path, click to
  seek) + Controls + GearMenu (tab-audio capture + signal meter).
- H tab: stub.
- E tab: entertainment placeholder + full AccountPage (accent picker
  + avatar + display name).
- U tab: leaderboard + social feed (T4 module under
  `web/src/features/feed/`).
- /admin: 10 tabs (Users, OAuth, LifeScores, Leaderboard, Scoring,
  ScoreVisibility, Passwords, Presets, Tooltips, Palette).
- Supabase keepalive (client + cron) preventing 7-day auto-pause.

## Function Budget (Hobby tier: 12)

At ceiling. Anything new replaces or folds into an existing
function. Helpers prefixed with `_` (no default export) are not
counted.

## Manual Steps Required

1. Apply `web/supabase/migrations/20260522000001_keepalive.sql` to
   production Supabase.
2. Apply `web/supabase/migrations/20260523000001_user_scores_profiles_fk.sql`
   to production Supabase (optional — handler already works without
   it).
3. Set Discord OAuth env vars on Vercel:
   `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
   `DISCORD_REDIRECT_URI`.
4. Decide Vercel Deployment Protection state.

## Git State

- Local: `main` at `3fe0265`, tracking `origin/main` (in sync at
  start of session; will advance after the memory-refresh commit).
- Remote: only `origin/main`.
- Vercel: `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` ("project-iwmob"),
  root dir `web`, deploying from `main`. mheu.lol live.

## Untracked but Present

- `/Visual/` — old nested-clone folder from session-17 era.
  Gitignored. Preserved on disk; never tracked.
