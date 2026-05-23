# Active Context

**Last updated**: 2026-05-23 (Session 12)

## Current State

**T4 done — U-tab social feed rebuilt.**

- New `web/src/features/feed/` module: `SocialFeed`, `FeedRow`,
  `FeedRowDetail`, `FeedAvatar`, `MagnitudeBadge`, `RelativeTimestamp`,
  `useFeedDiff`, `eventCopy`, `feed.css` — one job per file, all under
  150 lines.
- Avatar 44px circle with per-user accent border + letter fallback
  tinted by accent. Per-row accents come from `event.accent_color`
  (other users' colors) so rows never repaint when viewer's accent
  changes.
- Magnitude badge: green for +, red for −, U+2212 minus, σ suffix on
  derivatives. Colors via new tokens (`--color-success*`, `--color-danger*`).
- Deterministic verb pool via FNV-1a hash of event.id: position
  (climbed/rose/jumped/surged · dropped/slipped/fell/tumbled), derivatives
  (spiked/jumped/surged/kicked up · cooled/sagged/eased/dipped).
- Source-line ("cause") rendered ONLY when own event AND server included
  it (server enforces `isOwnEvent && reveal_action`). Re-asserted client-
  side as defense-in-depth — see top of `eventCopy.ts`.
- Slide-in 200ms ease-out on new arrivals (diffed by id), scroll
  preservation via useLayoutEffect (only adjusts when feed top is above
  viewport).
- Empty state: "No activity yet. Listen to something."
- Inline click expand/collapse, one row at a time. No modal.
- Polling + visibilitychange handler unchanged in `UserCompetitionTab`.
- Old inline block archived at
  `web/src/archive/social-feed-inline/UserCompetitionTab-feed-snippet.md`.

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

**Next.** No queued task. T1-T4 all merged. Awaiting next direction.

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
