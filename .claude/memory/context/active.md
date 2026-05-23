# Active Context

**Last updated**: 2026-05-23 (Session 11)

## Current State

**T3 done — waveform progress bar live on the M tab.**

- `WaveformProgressBar.tsx` mounted in `VisualizerPage` under `!hideUI`.
  Idle 5px line / active 72px peaks (3s pointer-debounced). Red->orange
  gradient driven by `position / duration`. Click-to-seek through
  `seek(position_ms)` in `services/spotify/player.ts`.
- `--radius: 8px` added to `tokens.css`. Controls bar + GearMenu side
  panel now use it (children stay squared).
- Polling debug noise removed; 5s `pollPlaybackState` still runs for
  track metadata / position / isPlaying.
- Code-file line limit dropped (priorities.md / roadmap.md). `.md` files
  still cap at 200.

**T2 done — audio pipeline rewired to live tab audio.**

- New `web/src/audio/` module: `useAudioSource()` hook + persistent ring-buffer
  accumulated waveform (200 buckets, downsamples in place).
- Butterchurn + gear-icon meter + T3 (upcoming) all read from one shared
  `AnalyserNode` owned by `VisualizerEngine`.
- Spotify `/v1/audio-analysis` + `/v1/audio-features` paths archived to
  `web/src/archive/spotify-audio-analysis/`.
- Bass/mid/high reactivity sliders removed (depended on synthetic path).
- Build passes (`cd web && npm run build`).

**Next.** T3 — build the waveform progress bar across the top of the M tab.
Consume `useAudioSource()`. Render `waveform[]` left-to-right, fill with
red-to-orange gradient based on `position / duration`.

**Single-branch repo + Supabase keepalive shipped.**

- Repo consolidated to one branch: `main` (formerly `Desktop`).
- `Visual` submodule gitlink removed — Vercel deploys no longer fail at "Failed to fetch one or more git submodules".
- Supabase keepalive live: client-ping on every visit + daily server-ping inside existing cron.

## What's Live on mheu.lol

- New Scoring Engine (soft-cap 0-200, cap at 100)
- 4 connectors (Spotify, Discord, MyNetDiary, AppleHealth)
- Admin Scoring Panel + accent theme + account UI
- Time scale selector (Day/Week/Month)
- Prestige tiers (100/150/180)
- **NEW**: Supabase keepalive heartbeat (table `public.keepalive`)

## Function Budget (Hobby tier: 12)

12/12 — at the limit. Keepalive is folded into `api/cron/recompute.ts`. Do NOT add new functions without consolidating two existing ones first.

## Deployment Notes

- Single branch: `main` only.
- Vercel project `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR`, root dir `web/`.
- Daily cron at `0 0 * * *` runs both score recompute and keepalive ping.
- See `.claude/memory/context/supabase-keepalive.md` for verification SQL.

## Manual Steps Required

1. **Apply keepalive migration** to production Supabase:
   - `20260522000001_keepalive.sql` (creates `public.keepalive` + RLS).
2. Discord env vars (still pending from previous session).

## Git State

- Local: `main` at `dddfdfc`, tracking `origin/main`.
- Remote: only `origin/main` (Desktop, web-app, refactor/consolidate, claude/lucid-payne-2538da all deleted).
- GitHub default branch: `main`.
- Vercel deploying from `main` with Root Directory `web`. mheu.lol live.

## Local-only branches (historical, not on remote)

- `clean-deploy`, `master`, `vercel-deploy` — leftover branches with unique commits from earlier sessions. Not pushed anywhere. Decide whether to archive or delete per session.
