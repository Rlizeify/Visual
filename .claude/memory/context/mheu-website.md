# MHEU Web App Roadmap

## Status

- **Branch**: single `main` (consolidated 2026-05-22)
- **Vercel project**: `project-iwmob` (prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR)
- **Domain**: mheu.lol
- **Function count**: 12 / 12 (Hobby tier limit)
- **Keepalive**: shipped — client + daily cron, see `supabase-keepalive.md`

## Completed (recent)

- **T4 — U-tab social feed redesign (2026-05-23)**: replaced the inline
  feed block in `UserCompetitionTab.tsx` with a new module under
  `web/src/features/feed/` (8 files + feed.css). Avatar circle with
  per-user accent border + letter fallback; deterministic verb pool via
  FNV-1a hash of event.id; magnitude badges (green/red, U+2212, σ for
  z-scores); inline expand/collapse with one row at a time; 200ms
  slide-in for new arrivals; scroll preservation via useLayoutEffect;
  empty state "No activity yet. Listen to something." `reveal_action`
  rule enforced server-side, re-asserted client-side as defense in
  depth. Old inline block archived at
  `web/src/archive/social-feed-inline/`. Polling + visibilitychange
  handler on `UserCompetitionTab` unchanged.
- **T3 — waveform progress bar (2026-05-23)**: full-width bar at the top
  of the M tab (just under the MHEU nav). Consumes `useAudioSource()`.
  Idle 5px flat / active 72px peaks with 3s pointer debounce. Red->orange
  gradient driven by `position / duration`. Click-to-seek via new
  `seek()` in `services/spotify/player.ts` (PUT /v1/me/player/seek).
  Also: `--radius: 8px` token added, applied to Controls bar + GearMenu
  panel; polling console.logs trimmed.
- **T2 — audio pipeline rewrite (2026-05-22)**: one shared `AnalyserNode` owned
  by `VisualizerEngine`, fed by tab audio (`getDisplayMedia`) or system loopback
  (`getUserMedia`). Three consumers off the same node:
  - Butterchurn visualizer (`connectAudio(sharedAnalyser)`) — was previously on
    a synthetic AnalyserNode driven by Spotify polling, now reacts to real audio.
  - Gear-icon SIGNAL meter — `getCurrentSignalLevel()`.
  - `useAudioSource()` hook in `web/src/audio/` — 200-bucket accumulated
    waveform + position + duration + trackId, ready for T3 to consume.

  Spotify `/v1/audio-analysis` + `/v1/audio-features` client archived to
  `web/src/archive/spotify-audio-analysis/` (was 403'ing for most clients).
  Synthetic music-data pipeline deleted. Bass/mid/high reactivity sliders
  removed. See `.claude/memory/decisions/audio-source-routing.md`.
- Branch consolidation to `main`.
- Submodule gitlink removed (`Visual` no longer breaks Vercel).
- Supabase keepalive (client ping + folded cron ping).
- Real-time scoring engine + 4 connectors.
- Accent color picker per user.
- Admin scoring panel with weights/effort.
- Account UI + avatar uploads.
- Prestige tiers + admin palette tab.

## Up Next

1. Apply `20260522000001_keepalive.sql` migration to production Supabase.
2. Add Discord OAuth env vars (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`) to Vercel.
3. Decide whether to disable Vercel Deployment Protection for public access.

## Constraints

- 12-function Hobby limit. Any new endpoint must replace or fold into an existing one.
- Daily-only crons on Hobby. Use the existing `cron/recompute.ts` for anything that needs a schedule.
- RLS enabled on all 19 tables (now 20 with `keepalive`). Service-role key only in `api/_admin.ts` and `api/cron/*`.

## Deployment

- Always deploy from repo root: `npx vercel --prod`.
- Pre-commit hook blocks `web/.vercel` drift; `scripts/check-vercel-link.sh` confirms link.
- Build: `cd web && npm install && npm run build` → `web/dist`.
