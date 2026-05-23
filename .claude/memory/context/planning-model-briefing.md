# Planning Model Briefing — 2026-05-23

Source-of-truth snapshot Stone can paste into the Claude.ai web planning
session. Reflects the actual code at commit `3fe0265` on `main` (clean
tree, single remote branch).

## FLAGS FOR STONE

- **The Electron desktop app is retired into `legacy/desktop/`.** Root
  `CLAUDE.md` and `README.md` still describe Visual as a multi-window
  Electron synth and reference `apps/desktop/`. That path no longer
  exists at the repo root. The active product is the **MHEU web app**
  in `/web`, deployed to mheu.lol. All planning conversations referring
  to "the desktop app" are about retired code.
- **No `apps/` directory exists at the repo root.** The roadmap "Up
  Next" item "fonts in `Visual-main\apps\desktop\fonts`" cannot be
  executed as written — those fonts live at
  `legacy/desktop/apps/desktop/fonts/`. Either revive the desktop or
  delete that backlog item.
- **CLAUDE.md and root README describe the wrong product.** They both
  pre-date the legacy migration. The memory refresh updates the
  context/roadmap files but leaves `CLAUDE.md` mostly intact pending
  your call on whether to fully rewrite it for the web product.
- **Spotify Premium is required for click-to-seek** on the M-tab
  waveform bar. Free accounts will silently fail the PUT
  `/v1/me/player/seek` call. Not currently surfaced to users.
- **Keepalive migration not confirmed applied.** Memory says
  `20260522000001_keepalive.sql` is a "manual step." Can't verify
  Supabase state from this repo. Run the verification SQL in
  `.claude/memory/context/supabase-keepalive.md` to confirm.

---

## CURRENT STATE OF VISUAL (desktop, Electron)

**Status: retired into `legacy/desktop/`. Not deployed. No active work.**

- Source tree: `legacy/desktop/apps/desktop/` (288 tracked files).
- Windows: hub, cockpit, display, studio. All Electron 29 + React 18 +
  Vite 5 + Tone.js 15.
- Shipped before retirement: Butterchurn visualizer with reactivity
  fixes; 2D LJV oscilloscope; effects rack (Compressor, EQ, Delay,
  Reverb, Chorus, Distortion); additive synth; sample editor with
  loop/pitch/reverse; 4x4 beat pads; 4-deck DJ mixer with crossfader
  and hot cues; SQLite save/load; binary synth launcher.
- Hub splash launches the four windows. Display was folded into
  Cockpit (Butterchurn rendered in the cockpit preview panel; the
  separate display window code is commented out).
- Pending follow-ups if the desktop is revived: Hitmarker fonts
  (already present in `legacy/desktop/apps/desktop/fonts/`); per-user
  Spotify OAuth token storage in `app.getPath('userData')` with
  installer-excluded userData and gitignored DB.
- Nothing in flight. Nothing broken — the code just isn't on the
  active path.

---

## CURRENT STATE OF MHEU (web, Vercel + Supabase)

**Status: live on https://mheu.lol. All recent work happens here.**

**Routing (from `web/src/App.tsx`):** unauthenticated → `/login` or
`/signup`. Authenticated → `/spotify-login` if no Spotify token, then
`/m`. Admin → `/admin/login` then `/admin`. The four MHEU tabs share
the `MHEUShell` layout (56px nav bar across the top, fog overlay on
H/E/U).

**M tab — Music.** The Butterchurn visualizer is mounted at the App
root (`VisualizerPage` inside a fixed div) and stays mounted across
all MHEU routes; only its z-index and visibility change. On M it is
the full-screen surface. `MusicTab.tsx` itself returns `null` — the
visualizer IS the tab. Gear menu (top right) toggles tab-audio
capture, picks Butterchurn presets, and shows a signal meter. The
waveform progress bar pins to top:56px under the nav.

**H tab — Health.** Stub. Renders a "Coming Soon" glass card and a
note that MyNetDiary / Apple Health connectors will land here.

**E tab — Entertainment.** Two-section page. Top half is a
"Coming Soon" entertainment card. Bottom half is the full
`AccountPage` (avatar upload, display name, accent color picker,
Spotify disconnect, logout). The accent picker writes
`profiles.accent_color` and re-applies CSS variables live.

**U tab — User Competition.** Live. Leaderboard + social feed
(rebuilt 2026-05-23 as T4 — `web/src/features/feed/`). 30s polling
plus a `visibilitychange` + `focus` handler hitting three endpoints
per tick: `/api/scores`, `/api/scores?action=user-scores`,
`/api/scores?action=events`. Server caps the feed at 50 events.

**Admin dashboard at /admin.** Tabs: Users, OAuth, LifeScores,
Leaderboard, Scoring, ScoreVisibility, Passwords, Presets, Tooltips,
Palette. Every write goes through a Vercel function in
`web/api/admin/*` that validates the caller's JWT and `is_admin`
flag through the shared `_admin.ts` helper.

**Audio pipeline (one paragraph).** One MediaStream (tab audio via
`getDisplayMedia({audio:true})` or system loopback via `getUserMedia`)
feeds one `AudioContext` and one shared `AnalyserNode` owned by the
`VisualizerEngine` singleton in `web/src/features/visualizer/`. Three
consumers read from that same analyser: Butterchurn
(`visualizer.connectAudio(sharedAnalyser)`), the gear-icon signal
meter (`getCurrentSignalLevel()`), and `useAudioSource()` in
`web/src/audio/` which feeds a 200-bucket waveform ring buffer to the
M-tab `WaveformProgressBar`. The ring buffer resets on Spotify
trackId change. Capture requires one user gesture per session because
`getDisplayMedia` cannot be auto-restored.

**Spotify usage now (post-T2 archive).** Metadata only: track name,
artist, album art, position, duration, isPlaying, shuffle via 5s
polling in `services/spotify/polling.ts`. Commands: play, pause,
next, previous, shuffle, **and seek** (added in T3) via
`services/spotify/player.ts`. Auth via OAuth code-with-PKCE in
`services/spotify/auth.ts` and refresh in `tokens.ts`. **No
`/v1/audio-analysis` or `/v1/audio-features` — archived to
`web/src/archive/spotify-audio-analysis/` after they started 403'ing
in late 2024. No Web Playback SDK.**

**Supabase schema (22 migrations under `web/supabase/migrations/`).**
Tables include: profiles, users, oauth_connections, life_score_*,
visualizer_presets, leaderboard_config, audit_log, user_scores,
score_events, user_score_visibility, tooltip_*, user_listening_stats,
scoring_field_weights and friends, keepalive, plus all Supabase auth
tables. RLS enabled on every public table; admin access goes through
the `public.is_admin(uuid)` SECURITY DEFINER helper. The most recent
two migrations (`20260522000001_keepalive.sql`,
`20260523000001_user_scores_profiles_fk.sql`) are flagged as
not-yet-verified against production.

**API routes under `web/api/` (Vercel serverless, 12-function Hobby
limit at ceiling).** Helpers (no default export): `_admin.ts`,
`_auth.ts`, `_db.ts`, `_jwt.ts`. Functions: `auth.ts`, `health.ts`,
`oauth.ts`, `scores.ts` (massive — leaderboard, user-scores, events,
recompute), `settings.ts`, `cron/recompute.ts`, and seven endpoints
in `admin/` (leaderboard, oauth, presets, scoring, tooltips, users,
plus an `_admin` helper). The daily cron at `0 0 * * *` runs score
recompute and pings the keepalive table first.

**What's shipped on mheu.lol.** Real-time scoring engine with
soft-cap 0-200 curve; four connectors (Spotify live, Discord
plumbed-not-wired, MyNetDiary stub, AppleHealth stub); admin scoring
panel with per-field weights + effort multipliers; accent color per
user with live recolor; account UI with avatar upload; prestige tiers
at 100/150/180; admin palette tab; T2 audio pipeline; T3 SVG
waveform progress bar with click-to-seek; T4 social feed with
deterministic verb pool, per-user accent borders, magnitude badges,
inline expand, slide-in animation, and server-enforced
`reveal_action` visibility; Supabase keepalive (client + cron).

**What's broken or partial.** Nothing actively broken on `main`. /api/scores
500 from 2026-05-23 was already fixed in commit `a296c88` (separate
profiles fetch + top-level try/catch + structured 500 body). H tab is
stub. Discord connector is plumbed in the scoring engine but Vercel
env vars are not set, so it never returns data. Vercel Deployment
Protection state is unconfirmed.

---

## DEPLOYMENT

Single branch `main` on `origin` (no `Desktop`, no `web-app`, no
`refactor/consolidate`, no `claude/lucid-payne-2538da`). No
submodules — `git ls-files --stage | grep ^160000` is empty.
Repo-root `.vercel/project.json` points at `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR`
("project-iwmob") with `rootDirectory: "web"` and `nodeVersion: "24.x"`.
No `web/.vercel/` drift. Custom domain mheu.lol is owned by that
project. Vercel cron schedule is `0 0 * * *` (daily UTC midnight — the
Hobby tier limit) hitting `/api/cron/recompute`, which also pings the
`public.keepalive` Supabase table to prevent the 7-day auto-pause.
Supabase keepalive verification SQL lives at
`.claude/memory/context/supabase-keepalive.md`. The
`scripts/check-vercel-link.sh` guard plus a pre-commit hook block
deploys from `/web` and prevent `web/.vercel` from being committed.

---

## IMMEDIATE BACKLOG (TOP 10)

1. **Apply Supabase migrations 20260522 + 20260523** to production
   and verify `public.keepalive` is incrementing daily and
   `user_scores.user_id → profiles.id` FK exists. Both files are in
   `web/supabase/migrations/`; running the latter is optional because
   `scores.ts` already works without it (split-query workaround), but
   apply it anyway for cleanliness.
2. **Set Discord OAuth env vars on Vercel** (`DISCORD_CLIENT_ID`,
   `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`). The connector
   code is live; only the env is missing.
3. **Decide on Vercel Deployment Protection.** Currently unknown
   whether mheu.lol is publicly reachable without a Vercel SSO
   bounce. If protection is on, public visitors can't load the site.
4. **Decide the desktop's fate.** Three options: (a) leave
   `legacy/desktop/` parked indefinitely; (b) revive it as the WASAPI
   broadcaster from `decisions/reactivity-architecture.md`,
   broadcasting FFT bands to mheu.lol over WebSocket; (c) delete it.
   The current ambiguity bleeds into every roadmap conversation.
5. **Rewrite root `CLAUDE.md` + `README.md`** to describe the MHEU
   web app as the active product. Optionally cross-link to
   `legacy/desktop/CLAUDE.md` for the desktop history.
6. **Build out the H tab.** Right now it is a "Coming Soon" card.
   The Apple Health and MyNetDiary connectors exist in
   `web/src/scoring/connectors/` as stubs; the H tab is where their
   surfaced UI belongs.
7. **Flesh out the Entertainment half of the E tab.** The Account
   page lives there too; the entertainment placeholder is the larger
   gap. Movies, shows, games consumption tracking per
   `EntertainmentTab.tsx`.
8. **Spotify Premium gating on click-to-seek.** The M-tab waveform
   `seek()` call silently fails on free accounts; surface a tooltip
   or disable the click region when the user is not Premium.
9. **Server-side rate limiting on `/admin/login`.** Currently a
   localStorage counter — trivially bypassed. See
   `decisions/admin-bootstrap.md` for the unresolved follow-up.
10. **Compact the changelog.** `.claude/memory/progress/changelog.md`
    is 1187 lines and violates the 200-line MD cap from MEMORY.md.
    Either roll older sessions into `stale.md` or accept that
    append-only logs are exempt.

---

## KNOWN ISSUES / IN-FLIGHT

- /api/scores 500 (PGRST200, missing FK) — **fixed** in `a296c88`
  via split fetch + structured error handler. Verify in prod after
  next deploy.
- T3 waveform polish addendum from `0e24440`: SVG path waveform with
  Catmull-Rom smoothing, idle line flush to nav bottom, container
  height animates so the bar grows downward without nudging content.
  Currently the renderer is a single SVG `<path>` per frame with a
  3-tap moving average — not the "blocks" or "canvas" you may have
  in mind from the original T3 spec. Memory in MEMORY.md describes
  the older gradient-fill approach; the file source is the truth.
- Discord connector dead-coded until env vars land (item 2).
- Vercel Deployment Protection (item 3).
- 12/12 function ceiling. Anything new must replace an existing
  function or live outside `web/api/` (see `web/src/scoring/`).

---

## CONVENTIONS THE PLANNING MODEL NEEDS TO KNOW

- **Audio pipeline rule.** One stream, one AudioContext, one
  AnalyserNode, multiple consumers. Do not create a second analyser.
  Do not pass raw bins through React state — sample into a ring
  buffer and read via a hook.
- **Line limits.** The 200-line cap applies only to `.md` files
  (CLAUDE.md self-checks at 198). Code files have no hard cap.
- **All colors come from `web/src/styles/tokens.css`.** Don't
  hardcode hex except inside the waveform bar where the gradient
  stops are deliberately literal (`#87150a`, `#eea91c`). New surface
  colors get new CSS variables, not inline hex.
- **Archive working features under `web/src/archive/`. Delete dead
  code.** The bar for archive is "this worked and might come back."
  Failed experiments and broken code get deleted.
- **Spotify usage is metadata + commands only.** No
  `/v1/audio-analysis`. No `/v1/audio-features`. No Web Playback SDK
  in-app. Reactivity comes from real tab/system audio captured via
  `getDisplayMedia` or `getUserMedia`.
- **12-function Vercel Hobby limit.** Adding any API endpoint
  requires consolidating two existing ones first. Helpers prefixed
  with `_` (no default export) are not counted.
- **Daily-only Vercel crons on Hobby.** Anything periodic folds into
  `api/cron/recompute.ts` — that's where keepalive lives.
- **Push to `main` is approved per-task.** No force pushes. Branch
  consolidation is done; `main` is the only remote branch.
- **All admin writes go through `web/api/admin/*` with `requireAdmin`.**
  Service-role key never leaves Vercel. Audit log is append-only.
- **Per-user accent color** is stored on `profiles.accent_color` and
  applied via `applyAccentColor()` to CSS variables on `:root`.
  Other users' accents in the social feed come from
  `event.accent_color` directly, not from CSS vars — this keeps rows
  painting correctly regardless of viewer.
