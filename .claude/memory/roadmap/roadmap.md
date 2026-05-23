# Roadmap

Last refreshed: 2026-05-23 against commit `3fe0265` on `main`.

The active product is the **MHEU web app** at https://mheu.lol. The
Electron Visual desktop is retired into `legacy/desktop/`.

## MHEU Web — Shipped

- **Theme system foundation (2026-05-23).** Registry +
  `useTheme()` + 3 registered themes (Frutiger Aero extracted from the
  existing look, Asian Vibrant + AC-130 Thermal stubbed). Profile icon
  pinned top-left of nav, dropdown houses avatar / accent picker /
  reveal toggles / theme switcher / sign-out. E tab now a placeholder.
  Migration `20260524000001` adds `profiles.theme_id` + self-update
  RLS for `user_score_visibility`. See
  `.claude/memory/decisions/theme-system-architecture.md`.
- **T4 — U-tab social feed redesign (2026-05-23).** New
  `web/src/features/feed/` module: SocialFeed, FeedRow, FeedRowDetail,
  FeedAvatar, MagnitudeBadge, RelativeTimestamp, useFeedDiff,
  eventCopy, feed.css. Avatar circle with per-user accent border +
  letter fallback; deterministic verb pool via FNV-1a hash;
  green/red magnitude badges (U+2212 minus, σ on z-scores); inline
  expand/collapse one-at-a-time; 200ms slide-in for new arrivals;
  scroll preservation via useLayoutEffect; `reveal_action`
  enforced server-side, re-asserted client-side. Old inline block
  archived.
- **T3 polish (2026-05-23, commit `0e24440`).** SVG `<path>` waveform
  renderer with Catmull-Rom smoothing replaces the earlier
  gradient-fill block style. Idle 5px line flushes to the nav
  bottom. Container height animates so the bar grows downward
  without nudging content.
- **T3 — waveform progress bar (2026-05-23).** Full-width bar
  pinned at top:56px under the MHEU nav. Idle 5px / active 72px,
  3s pointer debounce. Click-to-seek via new `seek()` in
  `services/spotify/player.ts`. `--radius: 8px` token added,
  applied to Controls bar + GearMenu side panel.
- **T2 — audio pipeline rewrite (2026-05-22).** Single shared
  `AnalyserNode` owned by `VisualizerEngine`, fed by tab audio or
  system loopback. Three consumers: Butterchurn, gear meter,
  `useAudioSource()`. Spotify `/v1/audio-analysis` archived.
- **/api/scores 500 fix (2026-05-23, `a296c88`).** Split the
  user_scores → profiles join into a separate query, added a
  top-level try/catch returning structured JSON, added entry +
  error logs. Triage file: `.claude/memory/progress/scores-500.md`.
- Branch consolidation to single `main`.
- Submodule gitlink removed (`Visual/` no longer breaks Vercel).
- Supabase keepalive (client ping + folded cron ping).
- Real-time scoring engine, 4 connectors, prestige tiers.
- Accent color picker, account UI, admin palette tab.

## MHEU Web — Up Next

1. **Apply pending Supabase migrations to production.**
   `20260522000001_keepalive.sql`,
   `20260523000001_user_scores_profiles_fk.sql`, and
   `20260524000001_profiles_theme_id.sql`. The theme system foundation
   needs the new column or theme persistence + reveal toggles fail.
2. **Build Asian Vibrant theme.** Currently a stub shell with a
   "coming soon" placeholder. Replace `NullStub`s in
   `web/src/themes/asian-vibrant/components/` with real implementations.
3. **Build AC-130 Thermal theme.** Same pattern; see
   `web/src/themes/ac130-thermal/README.md` for the aesthetic spec.
4. **Set Discord OAuth env vars** on Vercel
   (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
   `DISCORD_REDIRECT_URI`). Connector code is live; only env is
   missing.
5. **Decide Vercel Deployment Protection.** Confirm whether mheu.lol
   is publicly reachable without an SSO bounce.
6. **Build out the H tab.** Currently a "Coming Soon" stub. Surface
   the AppleHealth + MyNetDiary connectors (stubs at
   `web/src/scoring/connectors/`).
7. **Flesh out the Entertainment half of the E tab.** Movies, shows,
   games consumption tracking. Account UI no longer lives there
   (moved to the profile dropdown).
8. **Premium-gate the M-tab seek.** Free accounts silently fail
   `PUT /v1/me/player/seek`; surface a tooltip or disable the click
   region when not Premium.
9. **Server-side rate limiting on `/admin/login`.** localStorage
   counter is trivially bypassed — see
   `decisions/admin-bootstrap.md`.

## Visual Desktop — Status

**Retired into `legacy/desktop/`. No active work.**

Shipped features parked there: Hub splash, Cockpit (DJ decks,
crossfader, hot cues, pitch faders, MP3 playback, video module,
beat pads, plugin rack), Studio (additive synth, sample editor),
Butterchurn visualizer in the cockpit preview panel, 2D LJV
oscilloscope, effects (Compressor, EQ, Delay, Reverb, Chorus,
Distortion), SQLite save/load, binary synth launcher, Hitmarker
fonts in `legacy/desktop/apps/desktop/fonts/`.

Decision pending on whether to:
- (a) leave parked indefinitely,
- (b) revive as the WASAPI broadcaster from
      `decisions/reactivity-architecture.md` (Path B), or
- (c) delete.

## Constraints

- 12-function Vercel Hobby limit. Any new endpoint replaces or folds
  into an existing one.
- Daily-only crons on Hobby. Periodic work folds into
  `api/cron/recompute.ts`.
- RLS enabled on every public table. Service-role key only in
  `api/_admin.ts` and `api/cron/*`.

## Deployment

- Single branch: `main`.
- Vercel project `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` ("project-iwmob"),
  root directory `web`, custom domain mheu.lol.
- Always deploy from repo root: `npx vercel --prod`.
- Build: `cd web && npm install && npm run build` → `web/dist`.

## Deferred

- 3D oscilloscope (XY/XYZ) — archived in `legacy/desktop/`.
- Web Audio Modules (WAM) plugin standard.
- noise-craft, loop-drop-app integrations.
- Tool/MCP integrations from `decisions/tool-survey.md` (Meyda.js,
  shadertoy-react, audioMotion-analyzer).

## Conventions

- One job per file. No line limit on code; `.md` files cap at 200.
- All colors come from CSS variables in
  `web/src/styles/tokens.css`. No hardcoded hex outside the
  deliberate waveform-gradient literals.
- Archive working features (`web/src/archive/`). Delete dead code.
- File-per-plugin for any new effects.
