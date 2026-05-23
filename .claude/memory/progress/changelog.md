# Changelog

## 2026-05-23 — Theme system foundation

### Architecture
- New `web/src/themes/` directory tree. `types.ts` defines
  `ThemeManifest` + `ThemeSurfaces` contract (11 surfaces).
  `registry.ts` imports + maps all theme manifests. `ThemeContext.tsx`
  hosts `<ThemeProvider>` + `useTheme()`, hydrates from
  `profiles.theme_id`, persists changes fire-and-forget, mirrors the
  active id to `data-theme` on `<html>`.
- App.tsx wraps `<AppRoutes/>` in `<ThemeProvider>` + a `<ThemedApp>`
  that renders the active theme's `shell` around everything.

### Frutiger Aero theme (extracted from existing presentation)
- `web/src/themes/frutiger-aero/` with `tokens.css` (full token set,
  scoped to `:root[data-theme='frutiger-aero']` + new
  `--aero-glass-blur/--aero-glass-bg/--aero-button-bg/--aero-nav-bg/--aero-fog-bg`
  theme-only tokens), pass-through `shell.tsx`, and 11 component
  files. Most are re-exports of existing modules (UTab, PlaybackControls,
  GearMenu, WaveformBar, SocialFeedRow); NavBar + DashboardShell +
  ProfileDropdown + ETabPlaceholder + HTabPlaceholder + MTab are
  extracted / new.
- `web/src/components/MHEUShell.tsx` collapsed to a thin
  `useTheme().components.DashboardShell` consumer.
- `web/src/components/tabs/{HealthTab,EntertainmentTab}.tsx` collapsed
  to placeholder consumers.

### PART 2 — profile icon + dropdown
- 36px circular profile icon pinned top-left of the MHEU nav. Renders
  user avatar or initial fallback (first letter of username) with
  accent-color border. Persistent across all four tabs.
- Click opens `ProfileDropdown` anchored under the icon (desktop) or
  full-width below the nav (mobile, viewport < 600px). Outside-click
  + Escape close.
- Dropdown houses: avatar upload, accent color picker (palette +
  custom hex), `reveal_action` toggles per score type, theme switcher
  (lists all registered themes with active marker), sign-out.

### PART 4 — theme switcher
- Lives inside the profile dropdown. Selecting a theme calls
  `setTheme(id)` which writes to `profiles.theme_id` and swaps the UI
  immediately. Persists across sign-out and across devices.

### Stub themes
- `web/src/themes/asian-vibrant/` and `web/src/themes/ac130-thermal/`.
  Each: tokens.css + shell.tsx (centered "coming soon" plate +
  back-to-Frutiger-Aero button) + components/stubs.ts (NullStub) +
  index.ts + README.md describing intended aesthetic.

### E-tab archive
- `web/src/archive/e-tab-account-stuff/AccountPage.tsx` preserves the
  pre-migration AccountPage (avatar / username / connected services /
  MyNet Diary modal). README.md maps each old control to its new home.

### Supabase
- New migration `20260524000001_profiles_theme_id.sql`:
  - `profiles.theme_id text NOT NULL DEFAULT 'frutiger-aero'` with
    CHECK constraint on registered ids.
  - Adds self-scoped INSERT + UPDATE RLS policies on
    `user_score_visibility` so users can toggle their own
    `reveal_action` from the dropdown (previously admin-only).

### Memory
- New: `decisions/theme-system-architecture.md`.
- New: `patterns/theme-system.md` (how to add a theme, how to add a
  surface, stub convention, persistence + tokens).
- New: `progress/theme-system-audit.md` (PART 1 audit).

### Build
- `npm run build` clean. Bundle 1.40 MB (gzipped 328 kB) — same
  order of magnitude as before; theme system adds ~10 modules.

## 2026-05-23 (memory refresh) — Session 13

### Audit pass — code vs memory
- Confirmed Electron desktop is parked in `legacy/desktop/` and the
  active product is the MHEU web app at `/web`. CLAUDE.md and the
  root README still described Visual as a multi-window Electron
  synth — drift fixed in CLAUDE.md.
- Confirmed `apps/desktop/` does NOT exist at the repo root. The
  roadmap's "fonts in `Visual-main\apps\desktop\fonts`" item was
  unactionable as written; rewritten with the correct
  `legacy/desktop/apps/desktop/fonts/` path.
- Confirmed single `main` branch, no submodules, Vercel project
  link clean at repo root, no `web/.vercel/` drift.
- Confirmed daily cron schedule `0 0 * * *` matches Hobby tier.
  Stale `// Runs every 5 minutes` comment at the top of
  `web/api/cron/recompute.ts` flagged but not modified (not the
  refresh's job to touch code).

### Files updated
- `CLAUDE.md` — describes both products; web is active, desktop is
  legacy; updated key-files table; bumped line-count self-check.
- `.claude/memory/context/mheu-website.md` — rewritten from scratch
  as the live source of truth (routes, audio pipeline, Spotify,
  Supabase, API routes, deployment, what's shipped/broken/next).
- `.claude/memory/roadmap/roadmap.md` — rewritten. Web shipped /
  web next / desktop retired status / constraints.
- `.claude/memory/roadmap/priorities.md` — rewritten. Coding rules,
  stacks for both products, layouts, archive locations.

### Files added
- `.claude/memory/context/planning-model-briefing.md` — single-paste
  briefing for the Claude.ai web planning session.
- `.claude/memory/decisions/desktop-retirement.md` — follow-up note
  on the legacy/desktop/ move (the older synthetic-waveform decision
  pattern stays in place; this is just a status note).

### Missing changelog entries filled
- `a296c88` fix: /api/scores 500 — split profiles join. Triage in
  `.claude/memory/progress/scores-500.md`.
- `0e24440` fix: smooth SVG waveform + flush-to-nav idle position.
  T3 renderer changed from gradient-fill block to SVG `<path>` with
  Catmull-Rom smoothing, idle 5px line flushed to nav bottom,
  container height animates downward.

## 2026-05-23 (T4 — U-tab social feed redesign) — Session 12

### New feed module — `web/src/features/feed/`
- `SocialFeed.tsx` (top-level list, empty state, expanded-row state, cap 200)
- `FeedRow.tsx` (three-region row, hover/expand state, slide-in animation)
- `FeedRowDetail.tsx` (inline expand panel — type/delta/when/cause)
- `FeedAvatar.tsx` (44px circle, per-user accent border, letter fallback,
  hex→rgba helper for accent tint + glow)
- `MagnitudeBadge.tsx` (green/red pill, U+2212 minus, σ suffix on z-scores)
- `RelativeTimestamp.tsx` (auto-refreshes every 30s)
- `useFeedDiff.ts` (id-based diff, isNew flag, scrollY preservation via
  useLayoutEffect)
- `eventCopy.ts` (FNV-1a deterministic verb pool, EventCopy builder,
  defense-in-depth `isOwnEvent && source_action` re-assert)
- `feed.css` (keyframes for `feedRowSlideIn`)

### Wiring
- `UserCompetitionTab.tsx` lines 564-607 replaced with
  `<SocialFeed events={feedEvents} currentUserId={session?.user?.id ?? null} />`.
- Unused `formatDelta`, `formatTimeAgo`, `FeedEvent` interface,
  `FEED_MAX_ENTRIES` removed from UserCompetitionTab.
- Polling (30s + visibilitychange + focus) unchanged — still owned by
  UserCompetitionTab so leaderboard + user-scores share the tick.

### Tokens (web/src/styles/tokens.css)
- Added `--color-success`, `--color-success-bg`, `--color-success-border`,
  `--color-danger`, `--color-danger-bg`, `--color-danger-border`.
- Added `--row-tint` (2% white) + `--row-tint-hover` (6% white) for zebra
  rows.

### Archive
- Old inline feed snippet at
  `web/src/archive/social-feed-inline/UserCompetitionTab-feed-snippet.md`.

### Visibility / reveal_action
- Server already enforces `isOwnEvent && (visibility_override ?? userVisibility)`
  in `web/api/scores.ts:handleEvents`. Client re-asserts in `eventCopy.ts`
  with a comment block so a future change cannot silently widen rendering.

## 2026-05-23 (T3 — waveform progress bar + UI polish) — Session 11

### M-tab waveform progress bar
- New `web/src/features/spotify/WaveformProgressBar.tsx`. Full-width across
  the top of the M tab (below the 56px MHEU nav). Consumes `useAudioSource()`.
- Active state (after pointer activity over the bar) — 72px tall vertical
  peaks rendered from the 200-bucket waveform. Idle state — 5px flat line
  with the same red->orange progress gradient. 3s idle debounce.
- Fill is a `linear-gradient(90deg, #87150a 0%, #eea91c {p}%, transparent {p}%)`
  where `p = position / duration` — gradient compresses into the played
  portion so unplayed area stays clear.
- Click-to-seek wired to `seek(position_ms)` in `services/spotify/player.ts`
  (`PUT /v1/me/player/seek`). Standard Spotify Web API — requires Premium +
  active device but works the same way play/pause/next/prev already do.

### Rounded corners (Controls + GearMenu)
- Added `--radius: 8px` to `web/src/styles/tokens.css`.
- Playback controls bar: `borderRadius: var(--radius)`.
- Gear menu side panel: `borderTopLeftRadius` / `borderBottomLeftRadius`
  (right edge stays flush, since `borderRight: none` and the panel is fixed
  to the viewport edge). Children are still squared per the brutalist UI.

### Console + polling cleanup
- Removed noisy `[Poll] HTTP {status}`, `[Polling] Started/Stopped`, and
  `[Poll] No token` console.logs from `services/spotify/polling.ts`. The
  5s `setInterval` is intentionally still running — it pulls track
  metadata, position, duration, isPlaying, and shuffle state for the M
  tab UI (Controls, track card, WaveformProgressBar). It does NOT call
  any audio-analysis endpoint (that was archived in T2).

### Line-limit rule retired
- `priorities.md` and `roadmap.md` no longer enforce "max 150 lines per
  code file." Only `.md` files keep the 200-line cap (CLAUDE.md still
  self-checks at 198).

## 2026-05-22 (T2 — audio pipeline rewrite) — Session 10

### Shared AnalyserNode for all audio consumers

- Audited the full audio path. Documented in `.claude/memory/context/audio-pipeline-audit.md`.
- Replaced the Spotify-polling synthetic AnalyserNode with a real persistent
  `sharedAnalyser` owned by `VisualizerEngine`. Tab-audio / mic-audio streams
  now route into the same analyser via a new `LiveAudioRouter`.
- Butterchurn now reads the live tab audio directly (`connectAudio(sharedAnalyser)`).
  The dead "120 BPM grid" look on no-audio is gone — Butterchurn idles to
  silence and lights up the moment the user shares a tab.
- Built `web/src/audio/` module — `useAudioSource()` hook exposes a 200-bucket
  accumulated waveform, position, duration, and trackId for T3 to consume.
  Resets on Spotify trackId change. Downsamples in place when the buffer fills.
- Gear-icon SIGNAL meter still works (regression-stable — reads from the
  shared analyser via `getCurrentSignalLevel()`).

### Removed
- `web/src/services/spotify/analysis.ts` → archived to
  `web/src/archive/spotify-audio-analysis/` with a README explaining why.
- Synthetic music-data pipeline in `VisualizerEngine` — `fakeAnalyser`,
  `updateMusicData`, `updateLiveMusicData`, `runBeatScheduler`, beat-tracking
  state, `frequencyData`/`timeDomainData` buffers.
- `bass/mid/high Reactivity` settings + UI sliders (the multipliers depended on
  the synthetic path and don't translate to direct `connectAudio`).
- `MusicData.tempo` field and `AudioAnalysis*` types — unused after archive.
- `fetchAudioAnalysis` call from `polling.ts`.

### Decision file
- `.claude/memory/decisions/audio-source-routing.md` — why tab audio analyser
  over Spotify `/v1/audio-analysis` and over a synthetic waveform.

## 2026-05-22 (cleanup) — Session 9 (cont'd)

### Branch consolidation completed

- GitHub default branch switched to `main` (manual UI step by Stone).
- Deleted `origin/Desktop` and `origin/web-app` remotes — only `origin/main` remains.
- Renamed local `Desktop` → `main`, retargeted upstream to `origin/main`.
- Deleted fully-merged local branches `refactor/consolidate` and `web-app`.
- Vercel Root Directory confirmed as `web`. mheu.lol live + serving from `main`.
- Blockers cleared.

## 2026-05-22 (consolidation + keepalive) — Session 9

### Branch consolidation to single `main`

- Audited four remote branches (`Desktop`, `web-app`, `refactor/consolidate`, `claude/lucid-payne-2538da`); `Desktop` was the keeper (latest scoring engine, accent theme, .vercel cleanup, butterchurn fix).
- Wrote `.claude/memory/context/branch-audit.md` with per-branch diffstat.
- Pushed keeper state to `origin/main`, deleted other three remotes, set `main` as default.

### Fix: Vercel "Failed to fetch one or more git submodules"

- Root cause: gitlink entry `160000 e4857af... Visual` at repo root with no `.gitmodules` file → Vercel tried to fetch a non-existent submodule and failed in 2 seconds.
- `git rm --cached Visual` + added `/Visual/` to `.gitignore` to preserve the local clone without tracking it.
- Verified no gitlinks remain: `git ls-files --stage | grep ^160000` returns empty.

### Feature: Supabase keepalive (prevents 7-day auto-pause)

- New table `public.keepalive` (single row, RLS-enabled, permissive policies) via migration `20260522000001_keepalive.sql`.
- Client-side ping (`web/src/lib/keepalive.ts`) fires once per session from `App.tsx`.
- Server-side backup folded into existing daily cron `api/cron/recompute.ts` (stays under Hobby 12-function limit; standalone `/api/keepalive.ts` would have pushed us to 13).
- Doc: `.claude/memory/context/supabase-keepalive.md`.

## 2026-05-10 (fix — Desktop branch) — Session 8

### Fix: Visualizer black screen / null WebGL context

**Symptom:** `TypeError: can't access property 'createFramebuffer', this.gl is null` —
Butterchurn initializing against a null WebGL context after splash → M-tab routing.

**Root Cause:**
- `ButterchurnCanvas` ran its init `useEffect` synchronously on first paint,
  before the canvas had a non-zero bounding rect (splash still unmounting /
  parent flipping visible). `canvas.getContext('webgl')` returned null in that window.

**Fix:**
- `VisualizerEngine.initialize`: probe `getContext('webgl2'|'webgl')` first and throw a clear, retryable error if null.
- `ButterchurnCanvas.tsx`: defer init until canvas `isConnected` and bounding rect is non-zero. Use `ResizeObserver` to retry as soon as the canvas paints. Retry once after 100ms on WebGL failure. Resize handler now reads canvas rect.

**Files:**
- `web/src/features/visualizer/ButterchurnCanvas.tsx`
- `web/src/features/visualizer/VisualizerEngine.ts`

**Deploy:** `dpl_SNuxDiA1kYwknNjzNNPZuEedzcVM` → READY, auto-aliased to mheu.lol.
**Commit:** `743f21e`

## 2026-05-10 (fix — Desktop branch) — Session 7

### Fix: Vercel project link drift + mheu.lol 404

Diagnosed and fixed recurring issue where deployments went to wrong Vercel project.

**Root Cause:**
- Repo had TWO `.vercel/project.json` files:
  - `/.vercel/project.json` → `project-iwmob` (correct, owns mheu.lol)
  - `/web/.vercel/project.json` → `web` (wrong project)
- Deploying from `/web` directory used the wrong link

**Fix Applied:**
1. Deleted `/web/.vercel/` directory
2. Created guard script `scripts/check-vercel-link.sh`
3. Updated pre-commit hook to check for link drift
4. Created `web/docs/vercel-deploy.md` deployment guide

**Guard Script (`scripts/check-vercel-link.sh`):**
- Validates projectId matches `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR`
- Fails if `/web/.vercel/` exists
- Self-documenting with expected values in comments

**Pre-Commit Hook Updated:**
- Now runs Vercel link guard before secret scanning
- Blocks commits if link has drifted

**Verification:**
- `https://mheu.lol/` → 200 ✅
- `https://mheu.lol/api/health` → all env vars true ✅
- Alias confirmed: `mheu.lol` → `project-iwmob-prwi9nf6t`

**Key Rule:** Always deploy from repo root (`npx vercel --prod`), never from `/web`.

**Hobby Tier Status:** 12/12 serverless functions (at limit)

---

## 2026-05-10 (deploy — Desktop branch) — Session 6

### Deploy: mheu.lol scoring engine live + migration pushed

Fixed Vercel deployment issues and deployed the new connector-based scoring engine.

**Issues Fixed:**
1. **Vercel Deployment Protection** — All deployments require SSO auth. Using bypass header for API testing.
2. **12 Function Limit** — Connector files in `api/scoring/` were counted as serverless functions. Moved to `src/scoring/`.
3. **Stale Alias** — mheu.lol was aliased to a broken 2-second deployment. Re-aliased to working deployment.
4. **Nested .vercel directories** — Two project links caused path confusion. Removed web/.vercel.

**Migration Pushed:**
- `20260509000011_scoring_tables.sql` applied via `npx supabase db push`
- Tables created: `scoring_field_weights`, `user_position_history`, `recompute_locks`

**Field Sync:**
- 17 fields synced via `POST /api/admin/scoring?action=sync`
- Spotify: 7 fields, Discord: 3, MyNetDiary: 3, AppleHealth: 4

**Endpoints Verified:**
- `GET /api/health` — 200, all env vars present
- `GET /api/scores?action=user-scores` — 200, returns scoring shape
- `GET /api/admin/scoring` — 401 without auth (correct)
- `POST /api/scores?action=recompute` — 429 rate limited (working)
- `POST /api/admin/scoring?action=sync` — 200, synced 17 fields

**Commits:**
- `ff912b4` fix: consolidate scoring endpoints
- `447a04f` fix: move scoring engine out of api/

**Deployed:** https://mheu.lol (dpl_Gd96dBfhgqhKnX5HazDBQde8acVv)

---

## 2026-05-09 (feat — Desktop branch) — Session 5

### Feat: Modular connector system for scoring engine

Built a fully modular data connector architecture. Adding a new connector (e.g., Strava, Last.fm, GitHub) requires one file with no changes to the scoring engine, admin panel, recompute pipeline, or migrations.

**Connector Contract (`web/api/scoring/connectors/types.ts`):**
- `Connector` interface: id, displayName, isActive, fields[], fetch(userId, timeScale)
- `ConnectorField` descriptor: id, displayName, description, unit, dataType, defaultWeight, defaultEffortMultiplier, sparsityClass, expectedRange, inactive
- `SparsityClass` effort multiplier heuristic: passive=0.3, semi-active=0.7, active=1.5
- `TimeScale`: 'day' | 'week' | 'month'

**Connector Registry (`web/api/scoring/connectors/index.ts`):**
- `getConnectors()`, `getActiveConnectors()` — list all/active connectors
- `getFields()`, `getActiveFields()` — list all/active fields
- `getFieldById()`, `getConnectorById()`, `getConnectorForField()` — lookups
- `fetchAll(userId, timeScale)` — fetches from all active connectors in parallel
- `getFieldMetadataForAdmin()` — returns field metadata for admin panel

**Connectors Implemented:**
- `spotify.ts` — Fully implemented with 7 fields: listening_minutes, unique_artists, unique_tracks, unique_playlists, consistency, top_genre_concentration, discovery_rate
- `discord.ts` — Stub (inactive): messages_sent, voice_minutes, server_count
- `mynetdiary.ts` — Stub (inactive): calories_logged, days_logged, macro_consistency
- `applehealth.ts` — Stub (inactive): steps, active_minutes, workouts_logged, sleep_hours

**Documentation (`web/docs/adding-a-connector.md`):**
- Worked example: Strava connector in ~40 lines
- Field descriptor reference table
- Effort multiplier heuristic explanation
- Fetch function best practices with error handling

**Key Design Decisions:**
- Scoring engine NEVER imports specific connectors — only consumes registry
- Inactive connectors still appear in admin panel (greyed out)
- Field metadata is the source of truth for admin panel labels/units/sliders
- Errors in individual connectors don't fail the whole fetchAll operation

---

## 2026-05-09 (deploy — Desktop branch) — Session 4

### Deploy: mheu.lol now serves current code

Fixed deployment mismatch and deployed all recent features to production.

**Root Cause (identified):**
- Two Vercel projects existed: `project-iwmob` (owns mheu.lol) and `web` (wrong)
- Local repo was linked to `web` project, so deploys went to wrong destination
- mheu.lol was serving 15h-stale code

**Fix Applied:**
1. Deleted `web/.vercel/project.json` (wrong link)
2. Re-linked to `project-iwmob` via `npx vercel link --project project-iwmob`
3. Deployed from repo root: `npx vercel --prod --cwd C:\...\Visual-main`
4. Aliased new deployment to mheu.lol: `npx vercel alias ... mheu.lol`

**Live Bundle Fingerprint:**
- New: `index-DPHBqcGX.js` (was: `index-C3vGtlid.js`)
- All feature strings confirmed: username, Discord, fullscreen, Connections, position/velocity/acceleration/jerk/snap, Activity Feed, Leaderboard

**Live Endpoints Verified:**
- `/api/health` — all env vars present ✓
- `/api/scores` — 200 (empty array, needs users)
- `/api/admin/presets` — 100 presets returned
- `/api/auth?action=lookup-email` — expected POST error
- `/api/oauth?provider=discord` — expected missing-env-var error

**Remaining Manual Steps:**
1. Add Discord env vars to Vercel (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI)
2. Update Discord Developer Portal redirect URI
3. Supabase: Set Site URL, add redirect URLs, update email templates

**Commits:** `888f5ac` (triage docs), new commit pending
**Deployed:** https://mheu.lol (dpl_6FCpVMVELWbvsjguNz2ymGhAyYYV)

---

## 2026-05-09 (fix — Desktop branch) — Session 3

### Fix: Audit critical findings resolved

Implemented fixes for all 4 audit findings from the pre-migration code review.

**HIGH: score_events write logic (api/scores.ts)**
- Writes to score_events when five-score values change
- Compares new calculated scores vs stored values in user_scores
- Handles initial calculation with source_action="initial_calculation"
- Uses descriptive source_action: spotify_weekly_Xm, spotify_today_Xm
- Runs in background (doesn't block response)

**MEDIUM: visibilitychange pause (UserCompetitionTab.tsx)**
- Added useRef for interval tracking
- Pauses 30s polling when tab is hidden (document.visibilitychange)
- Restarts interval + immediate fetch when tab becomes visible
- Proper cleanup on unmount

**LOW: RLS fixes (migration 20260509000010)**
- Added position/velocity/acceleration/jerk/snap columns to user_scores
- Removed overly permissive "Service can manage" policy on user_listening_stats
- Documented score_events SELECT policy decision (API-layer enforcement)

**Commits:** `bcc8cc4`
**Deployed:** https://mheu.lol

---

## 2026-05-09 (feat — Desktop branch) — Session 2

### Feat: 8-part user/scoring/admin fix bundle

Complete implementation of coupled user, scoring, and admin features.

**API Consolidation (20 → 12 functions):**
- Merged `auth/lookup-email.ts` → `auth.ts?action=lookup-email`
- Merged `oauth/discord.ts` + `callback.ts` + `mynetdiary.ts` → `oauth.ts?provider=`
- Merged `admin/tooltips/defaults.ts` + `overrides.ts` → `admin/tooltips.ts?type=`
- Merged `admin/reset-password.ts` + `set-password.ts` → `admin/passwords.ts?action=`
- Merged `user-scores.ts` + `score-events.ts` → `scores.ts?action=`
- Merged `admin/score-visibility.ts` → `admin/leaderboard.ts?type=visibility`

**Database Migrations (6 new):**
1. `20260509000004_add_profile_fks.sql` — FK constraints for nested joins
2. `20260509000005_add_username_column.sql` — Username validation + backfill
3. `20260509000006_score_events.sql` — Social feed events table
4. `20260509000007_user_score_visibility.sql` — Per-user visibility settings
5. `20260509000008_tooltip_tables.sql` — Default + override tooltips
6. `20260509000009_user_listening_stats.sql` — Daily listening cache

**Username Support:**
- 3-20 chars, lowercase/numbers/underscores
- Login by username or email (lookup-email API)
- Signup form with username field

**Account Page (E tab):**
- Editable username with validation
- Connected services panel (Spotify, Discord, MyNet Diary, Apple Health)
- Profile display with avatar, email, dates

**OAuth Wiring:**
- Discord OAuth2 flow (scopes: identify, email)
- MyNet Diary API key flow (no OAuth available)
- Apple Health disabled on web (iOS only)

**Score Derivatives:**
- Position = total listening minutes this week
- Velocity = listening minutes today
- Acceleration = today − yesterday
- Jerk = change in acceleration
- Snap = change in jerk

**Social Feed (U tab):**
- Score events feed with visibility controls
- Admin tabs: ScoreVisibilityTab, TooltipsTab
- Leaderboard with collapsible connections

**Visualizer Presets:**
- 100 cool one-word display names (Prometheus, Xenophage, etc.)
- Updated seed_presets.sql

**Deployed:** https://mheu.lol

---

## 2026-05-09 (feat — Desktop branch)

### Feat: Production deploy verification + Supabase schema completion

Final end-to-end production verification for mheu.lol. All systems operational.

**Database (3 new tables):**
- `users` — Spotify-authenticated user records (spotify_id unique key)
- `user_scores` — competition leaderboard with score, listening_minutes, top_genre
- `visualizer_presets` — admin-customizable preset display names

**Production API fixes:**
- Fixed ESM imports: added `.js` extensions to all local imports in Vercel edge functions
- Fixed env var loading: moved `getSupabase()` calls inside handlers (not module-level)
- Consolidated admin endpoints to stay under Vercel's 12-function limit

**Visualizer controls:**
- Fullscreen toggle working
- Gear icon opens preset/reactivity controls

**Admin presets tab:**
- New `PresetsTab.tsx` component in admin dashboard
- Loads all 100 Butterchurn presets from npm package
- Merges with database overrides for renamed presets
- Edit modal for renaming, reset-to-default option

**User competition page:**
- Rewired `UserCompetitionTab.tsx` to fetch from `/api/scores`
- Removed all mock data arrays (MOCK_LEADERBOARD, MOCK_HISTORY)
- Shows "No users yet — be the first to log in!" empty state
- Connections panel with Spotify connect button

**Spotify login flow:**
- OAuth callback fetches profile from `/v1/me`
- Upserts to both `users` and `user_scores` tables
- `display_name` pulled from live Spotify profile

**Seed script:**
- Created `web/supabase/seed_presets.sql` with all 100 Butterchurn preset names

**Commits:** `cba0b19`, `ccee35c`, `9228b92`, `bd40632`, `047e252`

---

## 2026-05-08 (feat — refactor/consolidate branch)

### Feat: Wire /u leaderboard to live data + admin tabs complete

Final piece of the admin data console. Brings the public `/u` tab off
mock data and lets the admin's Leaderboard tab actually drive what
visitors see.

- Migration `20260508000009_leaderboard_public_read.sql`: adds two
  permissive SELECT policies — anon + authenticated can read profile
  rows AND life_score_derivatives rows when the user has a
  `leaderboard_config` row with `visible = true`. Without this, the /u
  tab's anon read would only return the viewer's own row, which makes
  a leaderboard impossible. Consent-by-admin: opting a user into the
  visible config is the consent record.
- `web/src/components/tabs/UserCompetitionTab.tsx`: on mount, queries
  `leaderboard_config` (visible only, ordered by position) joined with
  profiles, then `life_score_derivatives` keyed on those user_ids.
  Aggregates derivatives across metrics (sum) into the single-row-per-
  user shape the existing table expects. Falls back to MOCK_LEADERBOARD
  with a "MOCK · admin not configured" amber badge when there are no
  visible config rows or the fetch fails.

### Feat: Admin leaderboard tab — drag-reorder + visibility + persist

Fifth and final dashboard tab. HTML5 drag-and-drop reorders slots;
per-row checkbox toggles `visible`; × removes a slot. Save sends the
full slot list to PUT /api/admin/leaderboard which replaces the table
contents (rationale in decisions/admin-data-console.md). Discard
reverts to the last-saved snapshot. Dirty-state indicator + slot/
visible counts in the header. Add-user select only offers users not
already on the board. TabPlaceholder removed — all five tabs are real.

### Feat: Admin life scores tab — list + edit derivatives

Lists `life_score_derivatives` joined with profiles; sortable columns
for each derivative (position/velocity/acceleration/jerk/snap) plus
metric and computed_at. Row click opens an EditDerivativeModal with
five number inputs. Save patches via PATCH
/api/admin/life-scores/:user_id/:metric. Recompute button is disabled
with a tooltip — wires to a future edge function.

### Feat: Admin oauth tab — list + disconnect

Lists `oauth_connections` joined with profiles + auth.users.email.
Provider filter dropdown; expiry rendered red when expired and amber
when within 24 hours. Disconnect uses AdminConfirmDialog; only removes
our row — does NOT call the upstream provider's revoke endpoint.
Documented prominently in the tab header and confirm dialog.

### Feat: Admin passwords tab — reset emails + super-admin force-set

Reset-password emails for any user (calls
`auth.admin.generateLink({type:'recovery'})`). Force-set new password
button is hidden for non-super admins (UI cosmetic) and rejected by the
endpoint with 403 (real defense — gated by hardcoded
`SUPER_ADMIN_EMAIL = stone.gaunce@gmail.com`). Force-set requires
confirm-password match + ≥ 8 chars. Audit-log warning banner at the
top of the tab and inside the force-set modal.

### Feat: Admin data console phase 2 — backend + users tab

Phase-2 of the admin console — backend boundary + first functional
tab. Migrations 7 + 8 (leaderboard_config + audit_log,
profiles.username column folded into 7). Edge functions under
web/api/admin/ — every one validates the caller's Supabase JWT,
checks profiles.is_admin, and writes through a service-role client.
Service role key never touches the browser bundle. Shared helpers
(`_admin.ts` server-side, `adminApi.ts` browser-side); UI primitives
(`AdminTable`, `AdminModal`, `AdminConfirmDialog`, `AdminToolbar`,
`theme.ts`). Users tab supports search/sort/edit/delete with typed-
confirmation. Decision doc
`.claude/memory/decisions/admin-data-console.md` captures the service-
role boundary, audit log semantics, super-admin email gating,
leaderboard replace strategy, and open follow-ups.

### Feat: Admin auth shell — `/admin` route with separate login + role gate

Phase-2 of the admin console. Backend boundary + first functional tab. The
remaining tabs (Passwords, OAuth, Life Scores, Leaderboard) are placeholders
in the dashboard nav for now and ship as follow-up commits.

**Migrations** (applied to remote via `supabase db push`):
- `20260508000007_leaderboard_config.sql`: new `leaderboard_config` table
  with admin-only write + public read of visible rows. Also adds
  `profiles.username text` (unique-when-present partial index) so the Users
  tab can edit username + display_name + is_admin together.
- `20260508000008_audit_log.sql`: `audit_log` table — admin-read, no
  user-level write policy (service role bypasses RLS, so writes only come
  from the edge functions).

**Edge functions** under `web/api/admin/` — every one validates the caller's
Supabase JWT, checks `profiles.is_admin`, and uses the service-role key
(`SUPABASE_SERVICE_ROLE_KEY` — server-only):
- `users.ts` GET (list, joined auth.users + profiles)
- `users/[id].ts` PATCH (update profile fields), DELETE (cascades through
  `auth.admin.deleteUser`)
- `reset-password.ts` POST (sends Supabase recovery email)
- `set-password.ts` POST (super-admin-only — gated by hardcoded
  `SUPER_ADMIN_EMAIL = stone.gaunce@gmail.com`; password value is never
  written to the audit log)
- `oauth.ts` GET (list with email + profile join)
- `oauth/[id].ts` DELETE (removes our row only — does not revoke at provider)
- `life-scores.ts` GET (list with profile join)
- `life-scores/[user_id]/[metric].ts` PATCH (edit derivative values)
- `leaderboard.ts` GET (admin sees all rows incl. hidden), PUT (full replace)

**Shared helpers**:
- `web/api/_admin.ts`: `requireAdmin`, `logAudit`, `methodNotAllowed`
- `web/src/lib/adminApi.ts`: browser fetch wrapper that attaches the
  Supabase access token

**Admin UI primitives** under `web/src/components/admin/`:
- `theme.ts` shared palette + monospace font
- `AdminTable.tsx` sortable, dense, monospace, generic Column<T> API
- `AdminModal.tsx` Esc-to-close, click-outside dismiss
- `AdminConfirmDialog.tsx` optional typed-confirmation for destructive
  operations
- `AdminToolbar.tsx` search + status + actions
- `TabPlaceholder.tsx` placeholder for the not-yet-built tabs

**Dashboard**: `web/src/pages/AdminDashboard.tsx` now hosts a 5-tab nav with
Users tab functional and the other four as placeholders. Users tab supports
filter, sort, edit (username/display_name/is_admin), and delete (with
typed-confirmation that requires typing the user's email or id).

**Decision doc**: `.claude/memory/decisions/admin-data-console.md` covers
the service-role boundary, audit log semantics, super-admin email gating,
leaderboard replace strategy, and open follow-ups (recompute edge function,
provider-side OAuth revoke, server-side rate limiting).

`tsc --noEmit` and `vite build` clean. Repo-root `.gitignore` extended to
catch stray `/supabase/.temp/` if anyone runs `npx supabase` from the wrong
cwd.

### Feat: Admin auth shell — `/admin` route with separate login + role gate

Phase-1 of the admin console: the auth gate, no data tables yet.

- Migration `web/supabase/migrations/20260508000006_add_admin_role.sql`:
  `profiles.is_admin` column + `is_admin(uuid)` SECURITY DEFINER helper (used
  inside RLS to avoid recursing through the table's own self-only policy) +
  additive "Admins can read all ..." SELECT policies on profiles,
  oauth_connections, life_score_samples, life_score_derivatives + service-role-
  only `bootstrap_admin(email)` function for seeding the first admin.
- `web/src/pages/AdminLogin.tsx`: standalone terminal-style page (black bg,
  monospace, red accents — deliberately distinct from the Frutiger Aero login).
  Client-side 5-fail / 15-min lockout via localStorage; the decision doc flags
  this as a stopgap. `?error=access_denied` query param surfaces a banner.
- `web/src/pages/AdminDashboard.tsx`: shell with header, sign-out, and a
  "Phase 2: data tables coming" placeholder. Same terminal aesthetic.
- `web/src/components/AdminProtectedRoute.tsx`: queries `profiles.is_admin` for
  the current session. Unauthed → redirects to `/admin/login`. Authed but not
  admin → `supabase.auth.signOut()` then redirects to
  `/admin/login?error=access_denied`. Otherwise renders children.
- `web/src/App.tsx`: registered `/admin/login` and `/admin` routes (the latter
  wrapped in `AdminProtectedRoute`). Added `STANDALONE_BG_ROUTES` so the
  GroovyBackground and the Butterchurn visualizer never paint behind admin
  pages — the terminal aesthetic owns that screen alone.
- `/admin` is reachable by URL only; nothing in the MHEU shell links to it.
- Decision doc: `.claude/memory/decisions/admin-bootstrap.md` covers the
  rationale, how to seed CB via the Supabase SQL editor, and the rate-limiting
  follow-up.
- Verified live in dev server: bare terminal page on `/admin/login`, unauthed
  `/admin` redirects to `/admin/login`, lockout banner and disabled submit
  trigger when localStorage marks 5 attempts, `?error=access_denied` banner
  renders. `tsc --noEmit` and `vite build` both clean.

### Feat: Port desktop Hub groovy wave background to web pre-auth pages

Brought the 80s-anime/JDM groovy wave from the desktop Hub splash screen
(`legacy/desktop/apps/desktop/src/components/hub/HubApp.tsx` → `WaveCanvas`)
into the web app's `/login`, `/signup`, and root `/` pages.

- New `web/src/components/GroovyBackground.tsx`: 2D-canvas rAF loop, 8 bezier-band
  wave layers with phase-shifted sine + radial vignette overlay, exact palette match
  (`#1a0035 #00897b #c2185b #0d0030 #4a0080 …`). Self-contained; `aria-hidden`,
  `position: fixed; inset: 0; z-index: -1; pointer-events: none`. DPR-scaled (cap 2x)
  for crispness on retina; pauses on `visibilitychange` when tab hidden.
- `web/src/App.tsx`: added `GROOVY_BG_ROUTES = ['/login', '/signup', '/']` and a
  `showGroovyBg = !showVisualizer && GROOVY_BG_ROUTES.includes(...)` guard so the
  wave is mutually exclusive with the Butterchurn viz on `/m /h /e /u`.
- `web/src/pages/Login.tsx` + `web/src/pages/Signup.tsx`: outer wrapper bg flipped
  from `colors.bg` → `'transparent'` so the wave shows through behind the
  translucent form panel.
- Verified live via Vite dev server: canvas mounts only on the three pre-auth
  routes, animation advances, form inputs remain focusable/clickable, no extra
  canvas on MHEU routes. `tsc --noEmit` and `vite build` both clean.

### Feat: MHEU 4-tab shell with viz background behavior

Built the MHEU (Music/Health/Entertainment/User) tab shell for the web app:

**Core Shell (`src/components/MHEUShell.tsx`):**
- 4-tab navigation: M, H, E, U with persistent top nav bar
- Frutiger Aero aesthetic with frosted glass styling
- Visualizer remains mounted across all tabs (prevents audio analysis restart)
- Fog overlay on H/E/U tabs: `backdrop-filter: blur(20px)` + `rgba(0,20,30,0.6)` with 300ms fade transition
- M tab: fullscreen viz, no overlay, no fog

**Tab Components:**
- `MusicTab.tsx`: Empty (viz renders at root level)
- `HealthTab.tsx`: Coming soon placeholder card
- `EntertainmentTab.tsx`: Coming soon placeholder card
- `UserCompetitionTab.tsx`: Full scaffold with:
  - Connection panel (Spotify enabled, Discord/MyNetDiary/Apple coming soon)
  - Score panel (5 stat cards: position/velocity/acceleration/jerk/snap)
  - Leaderboard table (mock data: CB/John/Caden/Jeffrey)
  - History chart (Recharts LineChart with dummy data)

**Routing (`App.tsx`):**
- Integrated react-router-dom with BrowserRouter
- Routes: /m, /h, /e, /u, /login, /signup, /spotify-login, /callback
- Default redirect to /m on localhost, /login otherwise
- VisualizerPage mounted at fixed z-index 0 behind shell

**VisualizerPage Changes:**
- Added `hideUI` prop to suppress all UI controls when running as background
- UI elements wrapped in conditional render block

**Dependencies Added:**
- react-router-dom
- recharts

Commit: `49ebdb9`

---

### Feat: Supabase auth + Life Score schema

Integrated Supabase authentication into the web app and created database schema for Life Score feature:

**Auth setup:**
- Added `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`
- Created `web/src/lib/supabase.ts` client singleton
- Created `web/src/context/AuthContext.tsx` with session management
- Built `web/src/pages/Login.tsx` and `Signup.tsx` (Frutiger Aero style)
- Updated `App.tsx` with protected routes — redirects to /login if no session

**Schema migrations (`web/supabase/migrations/`):**
- `profiles` — id (uuid pk → auth.users), display_name, avatar_url, created_at; trigger auto-creates on signup
- `oauth_connections` — id, user_id, provider enum (spotify/discord/youtube/mynetdiary/apple), access_token_encrypted, refresh_token_encrypted (pgcrypto), expires_at, scope
- `life_score_samples` — id, user_id, source, metric, value, sampled_at; index on (user_id, source, metric, sampled_at desc)
- `life_score_derivatives` — id, user_id, metric, position, velocity, acceleration, jerk, snap, computed_at; one row per user per metric (upserted)

**RLS policies:** All tables enforce user-only access (SELECT/INSERT/UPDATE/DELETE where auth.uid() = user_id/id).

**Decision:** OAuth tokens encrypted with pgcrypto (`pgp_sym_encrypt`/`pgp_sym_decrypt`) — works on all Supabase plans. See `.claude/memory/decisions/oauth-token-storage.md`.

---

## 2026-05-08 (docs — refactor/consolidate branch)

### Research: Tool and MCP server integration survey

Comprehensive evaluation of 30+ tools across 5 categories for potential integration into VISUAL (Electron desktop) and MHEU (web):

- **Audio/DSP**: Evaluated mcp-music-analysis, MATLAB MCP, Essentia.js, Meyda.js. Recommended Meyda.js (MIT, lightweight) for immediate integration.
- **3D/Visual**: Evaluated Blender MCP, Three.js MCP, shadertoy-react, ShaderMate. Recommended shadertoy-react (6KB, MIT) for custom shader support.
- **Data/Charts**: Evaluated AntV, ECharts MCP, Plotly MCP, Clubber.js. Deferred — not aligned with DJ/visualizer focus.
- **OAuth/APIs**: Discord (50 req/sec, viable), YouTube (10K units/day, viable), Apple Health (iOS-only, skip), MyNetDiary (no public API, $40K license, skip).
- **Visualizers**: Evaluated projectM WASM, AlaskaButter, audioMotion-analyzer. Recommended audioMotion-analyzer for spectrum display.

**Specific answers:**
- MyNetDiary API: No public API. Commercial licensing starts at $40,000 USD.
- Apple Health web export: Not possible without iOS app intermediary.
- Discord activity polling rate limit: 50 req/sec global; presence updates 1 per 15 seconds.

**Top 5 recommended adds:** Meyda.js, shadertoy-react, audioMotion-analyzer, Essentia.js (later), projectM WASM (watch).

Decision document: `.claude/memory/decisions/tool-survey.md`

---

### Decision: Reactivity architecture for Tizen TV + Spotify

Investigated three architecture paths for true audio reactivity on Samsung Tizen TV browser with Spotify as audio source:

- **Path A (Pure web)** — KILLED. Spotify Web Playback SDK wraps audio in DRM/Widevine encrypted iframe. AnalyserNode access explicitly blocked (GitHub issue spotify/web-playback-sdk#25).
- **Path B (Desktop host + LAN WebSocket)** — RECOMMENDED. WASAPI loopback captures system audio, FFT analysis runs locally, bands + beat data broadcast over WebSocket to LAN clients. Tizen supports WebSocket. <50ms latency, zero ongoing cost, one-install setup.
- **Path C (Cloud relay)** — Viable fallback. Pusher/Ably relay works cross-network but 60Hz messaging exceeds all free tiers (~$390/mo on Ably) and adds 65-100ms latency degrading beat sync.

Decision document: `.claude/memory/decisions/reactivity-architecture.md`

---

## 2026-04-07 (feat — main branch)

### Feat: support DVR import and long MP4 playback

- **`apps/desktop/electron/main.ts`** — Added `dvr`, `mkv`, `m4v` to the `import-video` dialog's `extensions` array so DVR recordings and additional containers are selectable.
- **`apps/desktop/src/components/cockpit/VideoFiles.tsx`** — Updated the empty-state hint to mention `.dvr`.
- **`apps/desktop/src/components/cockpit/VideoPreview.tsx`** — `<video preload="auto">` → `preload="metadata"`. With `auto`, Chromium attempts to buffer the entire file up-front, which freezes the UI for 10+ minute videos. `metadata` only loads headers; the rest streams on demand from the `file://` URL.
- No file-size or duration caps existed in the import / preview / playback code, so nothing to remove. The src is already a `file://` URL via the existing `toFileURL()` (session 25), so playback streams from disk rather than buffering into memory.

DVR playability is decided by the actual container Chromium sees: MPEG-TS works natively, DVR-MS does not. If a particular `.dvr` file fails to preview, that's reported back rather than silently transcoded.

---

## 2026-04-07 (infra — main branch)

### Chore: drop stale naudiodon references from build scripts

Naudiodon was abandoned in favor of Electron's native `setDisplayMediaRequestHandler({ audio: 'loopback' })` (see `apps/desktop/electron/audio-loopback.ts`). It is not in `dependencies` and not in `node_modules`, but `apps/desktop/package.json` still listed it in `postinstall` and `rebuild:native`, causing every install to attempt rebuilding a missing module.

- **`apps/desktop/package.json`** — Removed `naudiodon` from both `postinstall` and `rebuild:native`. `better-sqlite3` rebuild remains (still a real native dep).

---

## 2026-04-06 (session 25 — main branch)

### Fix: renderer crash + hub autoplay Promise rejection

1. **`SpotifyPlayerAudio.ts`** — Replaced `getUserMedia(chromeMediaSource:'desktop')` with a silent `OscillatorNode` at gain=0 connected to the `AnalyserNode`. Eliminates bad IPC message reason 263 crash. Real WASAPI loopback deferred until naudiodon is compiled (TODO comment left in file).
2. **`HubApp.tsx`** — Changed `try { audio.play() } catch {}` to `audio.play().catch(() => {})` so async Promise rejection from "play() interrupted by pause()" is handled silently instead of surfacing as an unhandled rejection.

---

## 2026-04-06 (session 24 — main branch)

### Feat: WASAPI loopback + Web API control — remove Web Playback SDK

**Motivation:** Web Playback SDK requires Widevine/castlabs electron and EME. Replaced entirely with WASAPI system audio loopback (naudiodon) + Spotify Web API polling.

**Changes:**
1. **`SpotifyPlayer.ts`** — Removed SDK loading, `init()`, `player` object. Now polls `GET /v1/me/player` every 2s to track playback state. Controls via Web API (pause/resume/next/prev).
2. **`SpotifyPlayerControls.ts`** (new) — All Web API playback commands: `playTrackUri`, `pausePlayback`, `resumePlayback`, `skipToNext`, `skipToPrevious`, `getDevices`, `getNowPlaying`.
3. **`SpotifyPlayerAudio.ts`** — Replaced MutationObserver/MediaElementSource with `ScriptProcessorNode` pulling from a PCM queue. Queue fed from `onAudioData` IPC bridge (WASAPI chunks from main).
4. **`electron/audio-loopback.ts`** (new) — `setupLoopbackIpc()` registers `audio:start-loopback` / `audio:stop-loopback`. Uses naudiodon `AudioIO` with WASAPI host API to capture system output as Float32 PCM, streamed to renderer.
5. **`electron/main.ts`** — Removed `components` import and `components.whenReady()` Widevine block. Calls `setupLoopbackIpc()` on app ready.
6. **`preload-cockpit.ts`** — Added `startLoopback`, `stopLoopback`, `onAudioData` to IPC bridge.
7. **`SpotifyBrowser.tsx`** — Removed `isReady` SDK gate. Always shows now-playing if track exists. Shows available devices list if no active device. Play buttons always shown.
8. **`SpotifyNowPlaying.tsx`** — Added `position`/`duration` props + progress bar.
9. **`CockpitApp.tsx`** — Removed `spotifyPlayer.init()` calls. On Spotify connect: starts loopback, sets source to SPOTIFY. On MP3 load: stops loopback, sets source to MP3.
10. **`SpotifyPlayerTypes.ts`** — Removed SDK window globals (`window.Spotify`, `onSpotifyWebPlaybackSDKReady`).
11. **`SpotifyPlayerAPI.ts`** — Removed `playSpotifyUri` (replaced by `SpotifyPlayerControls.playTrackUri`).
12. **`package.json`** — Replaced `github:castlabs/electron-releases` with standard `electron@29.4.6`. Added `naudiodon@^2.0.1` dependency. Added `rebuild:native` script.
13. **`index.html`** — Removed `https://sdk.scdn.co` from CSP `script-src`.

**Note:** `naudiodon` native build requires Visual Studio Build Tools. Run `npm run rebuild:native` after installing MSVC tools.

---

## 2026-04-06 (session 23 — main branch)

### Fix: Widevine components API + Spotify scope refresh

**Root causes fixed:**
1. **Widevine** — Replaced manual `appendSwitch` calls with `components.whenReady()` awaited in `app.whenReady()`. CDM is now registered via Electron's built-in components API before any window is created.
2. **Spotify scopes** — Added missing scopes: `playlist-read-collaborative`, `user-read-playback-state`, `user-modify-playback-state`. These are required for playback state control (403 errors on play/pause/skip).
3. **Scope invalidation** — `checkAndInvalidateScopeChange()` stores current scope string in DB and clears tokens on startup if scope has changed. Prevents stale tokens with wrong scopes from causing 403s silently.

**Files modified**: electron/main.ts, electron/spotify-auth.ts

TypeScript: clean (tsc --noEmit, no output).

## 2026-04-06 (session 22 — main branch)

### Fix: Widevine registration + CSP worker-src for Spotify Web Playback SDK

**Root causes fixed:**
1. **Widevine** — `app.commandLine.appendSwitch('widevine-cdm-path', ...)` and `widevine-cdm-version` added before `app.whenReady()` in `main.ts`. Version read from `manifest.json` if present; falls back to `4.10.2830.0`. castlabs v29 embeds the CDM, so the "No component available" startup warning is expected/non-fatal.
2. **CSP worker-src** — Added `worker-src 'self' blob:;` to the `<meta http-equiv="Content-Security-Policy">` tag in `index.html`. Fixes Tone.js AudioWorklet "Refused to create a worker from blob:" error.
3. **allowRunningInsecureContent** — Set explicitly to `false` in cockpit `webPreferences` (security; was previously omitted).

**Files modified**: electron/main.ts, index.html

TypeScript: clean (tsc --noEmit, no output). App launches.

## 2026-04-05 (session 21 — cbauschek/dev branch)

### Fix: Spotify — 0 tracks, SDK CSP block, sort toggle, source indicator, audio routing

**Root causes fixed:**
1. **0 tracks bug** — `p.tracks?.total` path was correct; now typed as `(p.tracks?.total as number) ?? 0` for explicitness. `fetchPlaylistTracks` uses `limit=50` per API spec.
2. **Artist separator** — Changed from `, ` to ` / ` in both `fetchPlaylistTracks` (API) and `player_state_changed` listener (SDK).
3. **SDK CSP block** — Added `<meta http-equiv="Content-Security-Policy">` to `index.html` explicitly allowing `https://sdk.scdn.co` in `script-src`.
4. **Sort toggle** — Added A→Z / ORIG sort toggle button in `SpotifyBrowser.tsx` toolbar. Uses `#eea91c` text, `#7a0105` border, `#010103` bg per spec.
5. **Source indicator** — `.cockpit-source-indicator` CSS changed from `#27e0e1` to `#eea91c` color; border stays `#7a0105`.
6. **Audio routing** — Extracted to `SpotifyPlayerAudio.ts` (MutationObserver + immediate fallback for SDK's hidden `<audio>` element → `createMediaElementSource` → AnalyserNode → destination).

**File splits (150-line limit):**
- `SpotifyPlayer.ts` (354 lines) → split into:
  - `SpotifyPlayerTypes.ts` (35 lines) — all interfaces
  - `SpotifyPlayerAPI.ts` (66 lines) — `fetchPlaylists`, `fetchPlaylistTracks`, `playSpotifyUri`
  - `SpotifyPlayerAudio.ts` (60 lines) — audio routing module-level singleton
  - `SpotifyPlayer.ts` (136 lines) — core service class
- `SpotifyBrowser.tsx` (164 lines → 125 lines after split) → extracted:
  - `SpotifyNowPlaying.tsx` (31 lines) — now-playing strip component
  - `SpotifyTrackList.tsx` (44 lines) — expandable track list component

**Files created**: SpotifyPlayerTypes.ts, SpotifyPlayerAPI.ts, SpotifyPlayerAudio.ts, SpotifyNowPlaying.tsx, SpotifyTrackList.tsx
**Files modified**: SpotifyPlayer.ts, SpotifyBrowser.tsx, index.html, cockpit.css

TypeScript: clean (tsc --noEmit, no output).

## 2026-04-05 (session 20 — cbauschek/dev branch)

### Fix: Spotify browser shows "Not connected" despite valid OAuth token

**Root cause**: `SpotifyBrowser` guarded the playlist UI on `playerState.isReady`, which is only `true` after the Spotify Web Playback SDK fires `ready`. `isConnected` in SpotifyPlayerState was ALSO only set on `ready`. So even with a valid OAuth token, if the SDK failed to connect (e.g. no Premium account, or still initialising), both flags stayed `false` and the browser showed "Not connected".

**Fix:**
- `SpotifyPlayer.ts`: Added `markTokenValid(hasToken: boolean)` method — sets `isConnected` directly without waiting for SDK `ready`. This decouples "has OAuth token" from "SDK player is ready".
- `CockpitApp.tsx`:
  - Auto-reconnect now calls `spotifyGetAccessToken()` directly (single IPC instead of `spotifyIsConnected()` + `spotifyGetAccessToken()`), then calls `markTokenValid(true)` before `init()` so SpotifyBrowser sees `isConnected` immediately.
  - `handleSpotifyConnected` also calls `markTokenValid(true)` before `init()`.
  - Added `activeSource` state (`'mp3' | 'spotify'`). Set to `'spotify'` on `handleSpotifyConnected`; set to `'mp3'` on `handleLoad`. Analyser routing switched on `activeSource` (not just `isPlaying`).
  - Added `<span className="cockpit-source-indicator">SOURCE: SPOTIFY|MP3</span>` in bottom bar.
  - `sp-badge` on visualiser now shown based on `activeSource === 'spotify'`.
- `SpotifyBrowser.tsx`:
  - Guard changed from `!playerState.isReady` → `!playerState.isConnected` so the browser renders as soon as token is present.
  - Playlist loading `useEffect` triggers on `isConnected` not `isReady`.
  - Shows "Connecting player… / Playback requires Spotify Premium" banner when `isConnected && !isReady`.
  - Now-playing controls, play-playlist button, and track click all gated on `isReady` (SDK required for playback).
  - Tracks without `isReady` get `.sp-track--disabled` (opacity 0.45, default cursor).
- `cockpit.css`:
  - Added `.sp-sdk-status` and `.sp-sdk-status__text/hint` styles (teal/red, compact banner).
  - Added `.cockpit-source-indicator` style (teal, monospace, amber border).
  - Added `.sp-track--disabled` style.
  - Replaced all Spotify green (#1DB954) with app teal (#27e0e1) or amber except `.sp-connected__dot` (stays green per requirement).
  - `.sp-connect-btn` recoloured to dark-red background + amber text (no Spotify branding).
  - `.sp-badge` changed to teal.

**Files modified**: SpotifyPlayer.ts, CockpitApp.tsx, SpotifyBrowser.tsx, cockpit.css

TypeScript: clean (tsc --noEmit, no output).

## 2026-04-05 (session 19 — cbauschek/dev branch)

### Fix: VisualizerPreview — setAnimationSpeed runtime crash
- `VisualizerPreview.tsx`: Removed both calls to `viz.setAnimationSpeed(animationSpeed)` (line 24 useEffect and line 42 init). The method doesn't exist on the npm `butterchurn` package. Added `animSpeedRef` to track `animationSpeed` prop without restarting the init effect. Replaced `viz.render()` with a time-tracking render loop: `viz.render(timestamp, (timestamp - lastTime) * animSpeedRef.current)` so speed multiplies elapsed time.
- `asset-types.d.ts`: Removed false `setAnimationSpeed(speed: number): void` declaration from butterchurn type. Updated `render()` signature to `render(timestamp?: number, elapsedMs?: number): void`.

**Files modified**: VisualizerPreview.tsx, asset-types.d.ts

TypeScript: clean. Vite build: clean. (electron-builder symlink error is pre-existing Windows privilege issue, unrelated.)

## 2026-04-05 (session 18 — cbauschek/dev branch)

### Fix: run.vbs silent launch failure
- `run.vbs`: Removed `npm install --prefer-offline 2>nul &&` from the command chain. The `postinstall` script (`npx @electron/rebuild -f -w better-sqlite3`) was failing silently (non-zero exit code blocked `&&`), preventing `npm run dev` from ever running. Now runs `npm run dev` directly. Path to `apps\desktop` was already correct.

**Files modified**: run.vbs

## 2026-04-05 (session 17 — cbauschek/dev branch)

### Feat: Persistent Spotify auth, media library, and music folder across launches
- `SpotifySettings.tsx`: Fixed auto-reconnect race condition — now calls `spotifyGetAccessToken()` (which triggers token refresh) instead of `spotifyIsConnected()` (which only checks token existence). If refresh fails, UI correctly shows disconnected.
- `electron/main.ts`: Added 4 IPC handlers — `settings:get`, `settings:set`, `settings:pick-music-directory` (opens directory dialog, stores path), `settings:scan-music-directory` (scans for .mp3/.wav/.flac/.ogg/.m4a/.aac/.aiff files, imports to media_library)
- `electron/preload-cockpit.ts`: Exposed `getSetting`, `setSetting`, `pickMusicDirectory`, `scanMusicDirectory` bridges + types
- `dj/AudioLibrary.tsx`: Added music folder section — "Set Music Folder" button opens directory picker, displays current path, auto-scans on mount if folder is set, rescans and reloads library after folder change
- `cockpit.css`: Added `.audio-library__music-dir`, `.audio-library__dir-btn`, `.audio-library__dir-path` styles

**Files modified**: SpotifySettings.tsx, main.ts, preload-cockpit.ts, AudioLibrary.tsx, cockpit.css

TypeScript: clean.

## 2026-04-05 (session 16 — cbauschek/dev branch)

### Fix: Spotify OAuth — one-click login, hardcoded client ID, fix redirect URI
- `electron/spotify-auth.ts`: Hardcoded `SPOTIFY_CLIENT_ID` constant, changed redirect URI from `localhost` to `127.0.0.1`, bound temp HTTP server to `127.0.0.1` explicitly, removed `getSpotifyClientId`/`setSpotifyClientId` (no longer needed), added `getSpotifyUserProfile()` for display name
- `electron/main.ts`: Removed `spotify:get-client-id`/`spotify:set-client-id` IPC handlers, added `spotify:get-user-profile` handler
- `electron/preload-cockpit.ts`: Removed client ID IPC methods, added `spotifyGetUserProfile()` bridge + type
- `src/components/cockpit/SpotifySettings.tsx`: Replaced settings modal (Client ID input + Connect) with inline `SpotifyConnect` component — green pill "Connect to Spotify" button (#1DB954), connected state with green dot + "Connected as {name}", disconnect button
- `src/components/cockpit/CockpitApp.tsx`: Removed settings gear button and modal overlay, embedded `SpotifyConnect` inline in Spotify tab above browser
- `src/components/cockpit/SpotifyBrowser.tsx`: Removed "Open Settings to connect" hint (now redundant)
- `src/styles/cockpit.css`: Replaced settings modal styles with connect button pill styles, connected state indicator, disconnect button

**Files modified**: spotify-auth.ts, main.ts, preload-cockpit.ts, SpotifySettings.tsx, CockpitApp.tsx, SpotifyBrowser.tsx, cockpit.css

TypeScript: clean.

## 2026-04-05 (session 15 — cbauschek/dev branch)

### Feat: Interactive tutorials for Cockpit and Studio
- `CockpitTutorial.tsx` (new): 13-step guided walkthrough (SVG mask cutout overlay) covering grid, video files, video preview, visualizer controls/preview, plugin rack, DJ decks, deck FX, crossfader, BPM/key, bottom bar
- `StudioTutorial.tsx` (new): 12-step guided walkthrough covering tabs, additive synth, oscillator layer, oscilloscope, function input, sampler, sample waveform, beat pads, patch management
- Added `data-tutorial-id` attributes to target elements across Cockpit and Studio components
- Cockpit "?" button in bottom bar (28px circle, amber themed)
- Studio "?" button in bottom bar (28px circle, pink themed)
- localStorage keys: `visual-tutorial-cockpit-viewed`, `visual-tutorial-studio-viewed`

**Files changed**: CockpitApp.tsx, CockpitTutorial.tsx (new), StudioApp.tsx, StudioTutorial.tsx (new), PluginRack.tsx, DJDecks.tsx, DeckChannel.tsx, FunctionSynth.tsx, AdditiveSynth.tsx, SampleWaveform.tsx, BeatPads.tsx, cockpit.css, studio.css

TypeScript: clean.

## 2026-04-05 (session 14 — cbauschek/dev branch)

### Feat: Spotify integration with playlist browser and visualizer sync
- `electron/spotify-auth.ts`: Full OAuth 2.0 PKCE flow — code verifier/challenge, temp HTTP server on :8888, token exchange/refresh, SQLite persistence (plaintext — noted in comment)
- `electron/database.ts`: Added `settings` table, `getSetting`/`setSetting`/`deleteSetting`
- `electron/main.ts`: 6 Spotify IPC handlers (get/set client ID, connect, disconnect, is-connected, get-access-token)
- `electron/preload-cockpit.ts`: 6 Spotify API bridges
- `src/audio/SpotifyPlayer.ts`: Web Playback SDK loader, player init, audio routing (MediaElementSource → AnalyserNode), playback controls, Web API calls (playlists, tracks), pub/sub state
- `src/components/cockpit/SpotifySettings.tsx`: Settings modal — Client ID input, Connect/Disconnect, status indicator
- `src/components/cockpit/SpotifyBrowser.tsx`: Playlist browser — expand-to-tracks, now-playing bar, play/pause/skip controls
- `src/components/cockpit/CockpitApp.tsx`: VIDEO/SPOTIFY tab bar, gear icon, Spotify badge on visualizer, auto-reconnect, analyser switching
- `src/styles/cockpit.css`: ~350 lines Spotify CSS (settings, tabs, badge, browser, now-playing, controls, playlists/tracks)

**Files created**: spotify-auth.ts, SpotifyPlayer.ts, SpotifySettings.tsx, SpotifyBrowser.tsx
**Files modified**: database.ts, main.ts, preload-cockpit.ts, CockpitApp.tsx, cockpit.css

TypeScript: clean (only pre-existing DeckEngine type error).

## 2026-04-05 (session 13b — cbauschek/dev branch)

### Feat: Persistent media library for audio and video files
- **database.ts**: Added `media_library` table. CRUD functions: mediaImport, mediaList, mediaRemove, mediaUpdateMetadata, mediaUpdateLastUsed.
- **main.ts**: 6 IPC handlers (media:import/list/remove/update-metadata/update-last-used/check-file). Broadened load-mp3 dialog to all audio formats.
- **preload-cockpit.ts**: Exposed all media IPC methods.
- **useVideoStore.ts**: Added setVideoFiles(), getVideoFiles(), dbId/missing/metadata fields. Library-loaded files with stored analysis skip re-analysis.
- **VideoFiles.tsx**: Loads video library from DB on mount. Persists imports. Missing files grayed out with warning icon.
- **DeckEngine.ts**: Added filePath field, loadFromPath() for IPC-based loading with cached BPM/key.
- **DeckChannel.tsx**: LOAD uses IPC dialog. Persists audio to library. Stores BPM/key after detection.
- **AudioLibrary.tsx** (new): Collapsible panel showing previously imported audio with BPM/key.
- **DJDecks.tsx**: Integrated AudioLibrary. State getter includes filePath.
- **cockpitStateCollector.ts**: Includes video_media and audio_media refs in project state.
- **cockpit.css**: .vf-item--missing, .audio-library styles (~100 lines).

**Files changed**: database.ts, main.ts, preload-cockpit.ts, useVideoStore.ts, VideoFiles.tsx, DeckEngine.ts, DeckChannel.tsx, AudioLibrary.tsx (new), DJDecks.tsx, cockpitStateCollector.ts, cockpit.css

## 2026-04-05 (session 13a — cbauschek/dev branch)

### Feat: Video analyzer, fullscreen/mute controls, layout verification
- **Layout verified**: CSS grid `1fr minmax(120px,280px) 48px` pins bottom bar at all sizes (1200x700 through 1920x1080). No fix needed.
- **VideoPreview controls**: Added mute/unmute toggle (speaker icons), volume slider (80px, 0-1 range), fullscreen button (expand icon on video element). Video muted by default.
- **videoAnalyzer.ts** (new, ~200 lines): Offscreen canvas analysis at 5 timestamps. Dominant colors (quantized RGB bins, top 5 hex), average brightness (luminance formula), color temperature (R vs B channel comparison), motion intensity (pixel diff between frames), aspect ratio (GCD simplification), audio detection, FPS via requestVideoFrameCallback.
- **useVideoStore.ts**: Extended VideoFileMeta with `analysis?: VideoAnalysis` and `analyzing?: boolean`. Analysis runs automatically on import, persists to media library if dbId present, skips re-analysis for files with stored results.
- **VideoPreview.tsx**: Displays analysis below metadata — color swatches (16px squares), brightness bar, temperature/motion/ratio/audio labels. Shows "Analyzing..." while processing.
- **cockpit.css**: Added `.vp-volume` slider styles, `.vp-analysis` section with swatches, bar indicator.

**Files changed**: VideoPreview.tsx, useVideoStore.ts, videoAnalyzer.ts (new), cockpit.css

## 2026-04-05 (session 12 — cbauschek/dev branch)

### Fix: Responsive layout cleanup for Cockpit and Studio
- Removed hardcoded inline sidebar styles from CockpitApp.tsx
- PluginRack collapse now shrinks sidebar from 260px to 36px with transition
- DJ waveform: 60px → 48px, now shrinkable (min 32px)
- DJ vertical fader: 80px → 50px
- Deck FX panel: repositioned as internal overlay (was clipped by overflow:hidden)
- Studio frame: added box-sizing:border-box (100vw + padding was causing overflow)
- Studio patch slots: fixed width 260px → 100%
- Additive synth layer rows: now shrinkable with scroll instead of pushing waveform off-screen
- Studio containers: overflow:auto → overflow:hidden to prevent unwanted scrollbars

**Files changed**: cockpit.css, CockpitApp.tsx, PluginRack.tsx, studio.css, StudioApp.tsx, AdditiveSynth.tsx

## 2026-04-05 (session 11 — cbauschek/dev branch)

### Fix: Additive synth initial layer produces no audio
- `AdditiveSynth.tsx`: Reset `prevLayerIdsRef.current` in engine init effect so the pre-loaded layer is treated as new after AudioContext re-creation (React strict mode).

### Fix: Sample editor loop toggle doesn't stop looping
- `SampleEngine.ts`: `setLoop()` now sets `sourceNode.loop` and `loopStart/loopEnd` on the live AudioBufferSourceNode.

### Fix: Sample editor reverse + stop doesn't stop playback
- `SampleEngine.ts`: `source.onended` callback now guards with `this.sourceNode === source` to prevent stale callbacks from nullifying the active node reference.

### Feat: XY Lissajous oscilloscope
- `synth/XYScope.tsx`: Canvas-based XY scope, splits analyser into L/R channels, draws Lissajous pattern with fade trail, crosshair guides, 1:1 aspect ratio.

### Feat: Function synth input
- `synth/FunctionSynth.tsx`: Text input for `f(x,y,z)` math expressions. x/y/z = 220/330/440 Hz sine generators. ScriptProcessorNode generates audio, routed through additive synth analyser chain. Play/stop toggle, red border + error label on invalid input.

### Refactor: Studio synth tab layout
- `StudioApp.tsx`: Bottom 45% of synth tab split horizontally — additive synth 65%, XY scope + function input 35%.
- `AdditiveSynth.tsx`: Added `onEngineReady` callback prop, exports `AdditiveAudioRefs` interface.

### Refactor: Sampler transport controls
- `SampleControls.tsx`: Consolidated to Load | Play/Pause (toggle) | Stop in one row. Filename moved after transport buttons.

TypeScript: clean (only pre-existing DJDecks type error).

## 2026-04-05 (session 10 — cbauschek/dev branch)

### Feat: Tooltip system and Hub tutorial walkthrough
- `shared/Tooltip.tsx`: Rewrote — mouse-movement-reset (1500ms without movement triggers tooltip), centered horizontal positioning below target, viewport overflow clamping (bottom→top flip, left/right clamp), 150ms opacity fade-in animation, portal to document.body
- **Cockpit tooltips**: PluginRack (6 plugin descriptions), VisualizerControls (preset, bass/mid/high reactivity), DeckChannel (Load, Cue, Hot Cues, Pitch), DJDecks (Crossfader), VideoFiles (Import)
- **Studio tooltips**: OscillatorLayer (waveform type, frequency, gain, detune), SampleControls (Load, Loop, Reverse), BeatPads (grid), StudioApp (Save, New, Oscilloscope)
- `hub/HubTutorial.tsx`: New 5-step guided tutorial — full-screen SVG mask overlay with element cutout highlighting, step-based navigation (Next/Back/Skip Tutorial), data-tutorial attribute selectors, localStorage flag for viewed state
- `hub/HubApp.tsx`: Added "?" help button (fixed bottom-right, 36px circle, themed), tutorial state, data-tutorial attributes on Cockpit/Studio/Tools/Help elements

TypeScript: clean. Build: clean.

## 2026-04-05 (sessions 8-9 — cbauschek/dev branch)

### Feat: 4-deck DJ mixer in Cockpit
- `dj/DeckEngine.ts`: Per-deck audio graph (AudioBufferSourceNode -> GainNode), play/pause/stop/seek, cue/hot cues, pitch/volume
- `dj/DeckWaveform.tsx`: Canvas waveform with downsampled peaks, position indicator, click-to-seek
- `dj/DeckChannel.tsx`: Single deck UI — load (file input), waveform, play/pause, cue, 4 hot cues, pitch/volume faders
- `dj/DJDecks.tsx`: 4-deck container, crossfader A/B (complementary GainNodes), C/D direct to master, master volume
- `dj/djState.ts`: DJState interface, getDJState()/setDJState(), exposed on window for console
- `CockpitApp.tsx`: Layout restructured to CSS grid — sidebar spans all rows, 2x2 grid row 1, DJ strip row 2 (280px), bottom bar row 3
- `cockpit.css`: Added .cockpit-layout grid rules + ~200 lines DJ styles

### Feat: SQLite save/load with themed in-app dialogs
- `electron/database.ts`: SQLite init at userData/visual.db, WAL mode, projects + project_state tables, CRUD functions
- `hooks/useProjectPersistence.ts`: Shared hook — quick save, save as, load, delete, Ctrl+S/Shift+S/O shortcuts, status text
- `cockpitStateCollector.ts`: Collect/restore DJ decks, UI state, plugins via register pattern
- `studioStateCollector.ts`: Collect/restore session, sampler, beat pads via register pattern
- `shared/SaveDialog.tsx`: Dark overlay, project name input, themed buttons
- `shared/LoadDialog.tsx`: Project list, select, inline delete confirm
- `global.css`: Dialog styles, save flash, project status indicator
- `main.ts`: 4 IPC handlers (project:save/load/list/delete) + better-sqlite3 import
- `preload-cockpit.ts` + `preload-studio.ts`: Added projectSave/Load/List/Delete bridges
- `CockpitApp.tsx`: Registered UI state, persistence hook, dialogs, status in bottom bar
- `StudioApp.tsx`: Registered studio state, replaced native save, dialogs, status in bottom bar

TypeScript: clean.

## 2026-04-05 (session 7 — cbauschek/dev branch)

### Feat: Open-source tool launcher — popup windows from Hub
- `vendor/binary-synth/`: Cloned + pre-built MaxAlyokhin/binary-synth (MIT license, single-file 453KB HTML audio synth)
- `main.ts`: Added `toolRegistry` map, `vendorPath()` helper, `tool:launch` IPC handler with BrowserWindow creation, `toolWindows` Map for tracking + cleanup on Hub close
- `preload-hub.ts`: Exposed `launchTool(toolName)` via contextBridge
- `HubApp.tsx`: Added "TOOLS" section below main buttons with "BINARY SYNTH" button (cyan accent), new `toolsSection`/`toolsLabel` styles

## 2026-04-05 (session 6 — cbauschek/dev branch)

### Fix: Studio wave editor — patch panel no longer clipped
- `studio.css` (`.studio-main-canvas`): Changed to flex-direction column, align-items/justify-content stretch, overflow hidden
- `StudioApp.tsx`: Removed redundant inline flex styles; changed additive synth container from `flex: 0 0 45%` to `flex: 1 1 45%`; overflow hidden → auto; added minHeight 0 to both children

### Feat: Video module — import, preview, metadata (Cockpit grid)
- `useVideoStore.ts` (60 lines): pub/sub shared state for video file list + selection
- `VideoFiles.tsx` (80 lines): IMPORT button via IPC file dialog, scrollable file list (name, resolution, duration, size), click to select, X to remove
- `VideoPreview.tsx` (116 lines): HTML5 video player, play/pause/seek, metadata row (RES, FPS, CODEC, FRAME counter)
- `main.ts`: added `import-video` IPC handler (file dialog + file stats)
- `preload-cockpit.ts`: exposed `importVideo()` via contextBridge
- `CockpitApp.tsx`: replaced placeholder panels with VideoFiles + VideoPreview
- `cockpit.css`: ~180 lines added for video panels (design system colors)

### Feat: Sample editor + beat pads (Studio window)
- `SampleEngine.ts`: Web Audio — load, play/stop, loop, pitch shift (playbackRate), reverse, start/end offsets
- `PadEngine.ts`: 16 pad slots, one-shot triggers via AudioBufferSourceNode, volume/pitch per slot
- `SampleWaveform.tsx`: canvas waveform with draggable start/end markers, dimmed out-of-range regions
- `SampleControls.tsx`: load/play/stop, loop/reverse toggles, editable inputs (st, ms units)
- `SampleEditor.tsx`: container wiring SampleEngine to waveform + controls
- `BeatPads.tsx`: 4x4 grid, click to fire, right-click to assign sample, visual flash on trigger
- `main.ts`: added `studio:open-sample-dialog` + `studio:read-audio-file` IPC handlers
- `preload-studio.ts`: exposed `openSampleDialog()` + `readAudioFile()` via contextBridge
- `StudioApp.tsx`: added SYNTH/SAMPLER tab bar
- `studio.css`: styles for tab bar, sample editor, waveform, controls, beat pad grid

TypeScript: clean across all changes.

## 2026-04-05 (session 5)

### Fix: Plugin rack layout — constrained sidebar, clean panel rows

- `PluginRack.tsx`: 260px fixed width, height 100%, overflow hidden, header flex-shrink 0, chain div (flex 1, overflow-y auto, overflow-x hidden) scrolls independently via onWheel stopPropagation; removed reorder arrows and remove button from slot JSX.
- `PluginPanel.tsx`: width 100% box-sizing border-box, overflow hidden; 40px header height; 8px L/R padding; 4px param gap; label on own line above slider row; number input 52px; param-controls flex with min-width 0 on slider.
- `CockpitApp.tsx`: left sidebar hard-walled at 260px (width/min-width/max-width 260, overflow hidden, position relative).
- TypeScript: clean. Vite build: clean. Committed + pushed (`a4afc7f`).

## 2026-04-05 (session 4)

### Chore: Comment out Display window launch at startup

- `apps/desktop/electron/main.ts`: commented out (not deleted) `createDisplayWindow()` function definition, its call inside `hub:open-cockpit`, the `hub:open-visualizer` handler, the F11 fullscreen shortcut, and five IPC handlers that exclusively served the display window (`visualizer:beat-data`, `visualizer:dial-data`, `visualizer:waveform-data`, `push-to-display`, `display:fullscreen`).
- Each commented block prefixed with: `// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel`
- TypeScript: clean. Vite build: clean. Committed + pushed (`f8c323b`).

## 2026-04-05 (session 3)

### Feat: Full Cockpit layout redesign (8 steps)

**STEP 1 — Archive**: Copied display/Butterchurn window to `src/archive/display-window-original/` (VisualizerApp, DisplayApp, Visualizer). Original files untouched.

**STEP 2 — Main layout**: Rebuilt `CockpitApp.tsx` from scratch — two-column (sidebar + 2x2 grid). Manages shared visualizer state (selectedPreset, blendTime, cycleSpeed, reactivity values).

**STEP 3 — Butterchurn preview**: New `VisualizerPreview.tsx` — Butterchurn canvas fills bottom-right panel, connects to cockpit AnalyserNode, 30s cycle, 2.5s blend, ResizeObserver, fullscreen button on hover via Fullscreen API.

**STEP 4 — Visualizer controls**: New `VisualizerControls.tsx` — preset selector (all butterchurn-presets), bass/mid/high reactivity sliders 0-100, blend time 1-10s, cycle speed 10-120s; all wired to props passed from CockpitApp.

**STEP 5 — Waveform volume slider**: New `WaveformSlider.tsx` — canvas + transparent range input overlay; waveform amplitude scaled by volume; gradient #87150a->#eea91c; bottom bar right section.

**STEP 6 — Plugin rack preload**: `PluginRack.tsx` auto-loads all 6 plugins on mount (Compressor->EQ->Delay->Reverb->Chorus->Distortion), each bypassed + collapsed; ADD PLUGIN hidden when 6 loaded. `PluginPanel.tsx`: collapsed state lifted to PluginRack (controlled prop). `AudioEngine.ts`: removed manual addPlugin calls from constructor; kept side-effect imports for registration.

**STEP 7 — Hub splash**: Removed VISUALIZER button and `openVisualizer` callback from `HubApp.tsx`. Hub now shows only COCKPIT and STUDIO.

**STEP 8 — Borders/cleanup**: Set border-radius: 0 on plugin-rack, plugin-panel, bypass button, add-btn, dropdown, number input. Added `.cockpit-main` (2x2 grid), `.cockpit-panel`, `.cockpit-panel__title` to cockpit.css. Bottom bar height 56px -> 48px. Removed resize dividers (no more .cockpit-divider). Plugin rack overflow: hidden -> visible for wheel scrolling.

TypeScript: clean. Vite build: clean.

## 2026-04-05 (session 2)

### Feat: Cockpit layout rebuild
- Archived LeftPanel, RightPanel, Dial, ToggleSwitch -> `apps/desktop/src/archive/cockpit-left-panel/`
- New `Oscilloscope.tsx`: canvas + ResizeObserver, clearRect every frame, getByteTimeDomainData, stroke #27e0e1 1.5px, max 80 lines
- Rebuilt `CockpitApp.tsx`: three-column layout (left=PluginRack 280px, center=LJVScope+Oscilloscope, right=0px), bottom bar (LOAD/PLAY/PAUSE/STOP/time/vol)
- Resizable dividers: left sidebar (ew-resize, min 180px), center split (ns-resize, min 80px each)
- Rewrote `cockpit.css`: new layout classes, no border-radius, no box-shadow on panels, all borders 1px solid #7a0105, panel bg #010103, bottom bar bg #0a0a0a

## 2026-04-05

### Feat: Reverb, Chorus, Distortion plugins
- `effects/Reverb.ts`: ConvolverNode with OfflineAudioContext-generated impulse response (white noise x exponential decay); roomSize, decay, wet, dry params; bypass sets wet=0/dry=1; rebuilds impulse async on roomSize/decay change
- `effects/Chorus.ts`: DelayNode (20ms fixed center) + OscillatorNode LFO -> depthGain -> delay.delayTime; rate, depth (ms), wet, dry params; LFO started in constructor
- `effects/Distortion.ts`: WaveShaperNode with sigmoid soft-clip curve (4x oversample) + BiquadFilter highpass for tone + output GainNode; amount, tone, output, wet, dry params; Float32Array cast to `Float32Array<ArrayBuffer>` for TS strict compat
- `pluginRegistry.ts`: three side-effect imports added so all new plugins self-register on load

### Feat: Collapse/expand for PluginPanel and PluginRack
- `PluginPanel.tsx`: `collapsed` state (default false); header row fixed at 36px; toggle button shows/hides params section; BYPASS still always visible
- `PluginRack.tsx`: `rackCollapsed` state (default false); toggle in rack header; collapses the entire chain + ADD PLUGIN footer; unit count hidden when collapsed

### Feat: Compressor, EQ, Delay effects + Cockpit plugin rack wiring
- `effects/Compressor.ts`: DynamicsCompressorNode; 5 params (threshold, ratio, attack, release, knee); bypass routes around compressor via GainNode passthrough
- `effects/EQ.ts`: 3 BiquadFilterNodes in series (lowshelf, peaking, highshelf); 7 params; bypass routes around all filters
- `effects/Delay.ts`: DelayNode + feedback GainNode loop + wet/dry GainNodes; 4 params; bypass sets wet=0/dry=1 without disconnecting nodes
- All three self-register in pluginRegistry on import
- `AudioEngine.ts`: disconnects Tone chorus from Tone.getDestination(), inserts PluginChain between chorus and ctx.destination; exposes `getPluginChain()`
- `CockpitApp.tsx`: imports PluginRack + audioEngine singleton; renders `<PluginRack>` between cockpit-body and BottomBar
- `cockpit.css`: grid-template-rows updated from `52px 1fr 52px` to `52px 1fr auto 52px` to accommodate rack row

### Feat: Plugin architecture foundation (src/plugins/)
- `MHEUPlugin.ts`: interface + `ParamDescriptor` type + `MHEUPluginConstructor` type
- `PluginChain.ts`: class that owns an ordered plugin array; `addPlugin/removePlugin/movePlugin/setBypass`; rewires Web Audio connections on every mutation; bypassed plugins are routed around
- `PluginPanel.tsx`: generic React UI — reads `getParams()`, renders label + number input + range slider per param, BYPASS toggle; uses app CSS vars only
- `PluginRack.tsx`: rack container — PluginPanel list, up/down reorder arrows, remove button, ADD PLUGIN dropdown from registry; state stays in sync with PluginChain
- `pluginRegistry.ts`: Map-based registry; `registerPlugin / getRegisteredPlugins`; WAM adapter will also register here

### Fix: Hub splash screen button cleanup
- Removed icons from all three HubButtons; kept text labels only
- Changed `.hub-btn` font-family from `'SD Glitch'` to `'Inter', sans-serif`

### Feat: Cockpit color palette retheme
- Replaced old neon 80s palette with dark-red/gold scheme
- `cockpit.css`: full rewrite of CSS variables and hardcoded colors

### Feat: Additive Synthesizer Panel (Studio window)
- OscillatorLayer.tsx, SynthEngine.ts, WaveformDisplay.tsx, ExportButton.tsx, AdditiveSynth.tsx

### Fix: Butterchurn Visualizer (4 issues)
- Audio reactivity, black screen between presets, window not draggable, scrollbars/fullscreen

## 2026-04-04

### Infrastructure Initialization
- Created CLAUDE.md, .claude/AGENT.md, .claude/SOUL.md, memory directory tree
- Full codebase scan and memory population
