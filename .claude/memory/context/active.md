# Active Context

**Last updated**: 2026-05-30 (Scores snapshot fix — FK + UNIQUE + upsert — and preset auto-naming pool)

## Current State

### Scores pipeline: snapshot writes work now

**Root causes (live DB diagnosis):**
- `user_scores.user_id` lacked UNIQUE → `onConflict:'user_id'` silently
  no-opped. Only the legacy `handleUpsertScore` ghost row existed
  (NULL user_id, spotify_user_id='stone.gaunce'). 80 score_events
  written across 5 sessions, ALL `initial_calculation` because no
  snapshot ever materialized.
- Migration 20260523000001 (user_scores → profiles FK) was
  phantom-applied: recorded in `supabase_migrations.schema_migrations`
  but the FK was never created. Admin LifeScores 500ed on the nested
  `profiles(...)` join.

**Fix:** migration 20260530000002 drops the ghost, ALTER COLUMN
spotify_user_id DROP NOT NULL, ADD UNIQUE (user_id), ADD FK to
profiles.id, NOTIFY pgrst reload. Code: `scores.ts` +
`cron/recompute.ts` stop writing `spotify_user_id` placeholder and
check the upsert error. `handleRecomputeAll` now returns real
`events_written`. Stone's snapshot row backfilled via SQL (position
5.98); derivatives populate after next cron / curl.

**Verified live:** FK + UNIQUE both present; nested join resolves;
Stone's row queryable. Cron firing confirmed via position_history at
2026-05-30 00:19 UTC. Audit:
`.claude/memory/progress/scores-snapshot-broken-audit.md`.

### Preset auto-naming pool

New `presetNamePool.ts` (443 single-word MHEU names) + `autoNames.ts`
(FNV-1a hash + linear probing). `usePresetNames.getDisplayName`
resolves curated DB > auto-pool > original. Raw Butterchurn names no
longer leak into the gear menu after the 5× library expansion. 4
overlaps with curated names excluded → effective pool 439 > ~400
uncurated keys. Audit:
`.claude/memory/progress/preset-auto-naming-audit.md`.

### Prior current state — Permissions broadening + OAuth UNION view + Butterchurn library expansion + audio-gated auto-shuffle (earlier 2026-05-30)

### A. Permissions config broadened (Part A)

`.claude/settings.json` now allow-lists Edit/Write across `.claude/`,
all root markdown/meta files (CLAUDE/AGENT/SOUL/README/CHANGELOG/
ROADMAP/LICENSE/.gitignore), `web/docs/`, `web/supabase/migrations/`,
`web/public/`, and `web/src/archive/`. Explicit deny list covers all
`.env*` variants and `web/.vercel/`. CLAUDE.md "Pre-authorized Edits"
section updated to reflect categories. Pattern docs at
`.claude/memory/patterns/permissions-config.md` (full rewrite) and
decision log at `.claude/memory/decisions/md-permissions.md` (note
prepended) explain prefix-only matching, per-tool grain, deny-wins
behavior, and expansion principle.

### B. OAuth admin tab now sees live tokens (Part B.2)

The admin OAuth tab used to query the legacy `oauth_connections`
table — which is empty since the live tokens moved to per-provider
tables (`spotify_tokens`, `obsession_strava_tokens`). New VIEW
`public.oauth_connections_unified` (security_invoker = true) UNION
ALL's the two real token tables with synthetic IDs
(`${provider}:${user_id}`). Migration
`20260530000001_oauth_connections_unified_view.sql` applied via
`supabase db push`. `web/api/admin/oauth.ts` rewritten to query the
view, manually join profiles + auth.users for email/username, and
route DELETE to the right per-provider table via `providerTable`
map. `web/src/components/admin/OAuthTab.tsx` URL-encodes the
synthetic `:` id and explains in the note that disconnect only
removes our row, not the upstream grant. NB: name collision avoided
— `oauth_connections` is an existing table, so the view is suffixed
`_unified`.

### C. Butterchurn preset library expanded ~5x (Part B.3)

`butterchurn-presets@2.4.7` ships 5 sub-bundles. The engine used to
import only the main bundle (~100 presets). Now `VisualizerEngine.ts`
imports all five and merges via `mergePresets()`. Main wins on
collision so curated names stay stable. Library jumps from ~100 to
~500. New sub-path module declarations in `web/src/vite-env.d.ts`.
"PRESETS: {count}" displayed subtle in each of the three theme
GearMenu headers (Frutiger Aero, Asian Vibrant, AC-130 Thermal).

### D. Audio-gated auto-shuffle (Part B.4)

`VisualizerEngine.ts`: cycleSpeed semantic re-grounded.
- `cycleSpeed = 0` → auto-shuffle OFF.
- `cycleSpeed > 0` → random advance every N seconds with a 5-deep
  recently-played history excluding current + recents.
- Audio gate: separate 500ms signal poll tracks `lastNonSilentMs`.
  Cycle tick skips advancing if silent > 10s. Resumes next tick
  after audio returns.
- Manual `loadPreset()` resets silence tracker + restarts the cycle
  countdown.
- Default `cycleSpeed` raised from 15 → 45 in `useVizSettings.ts`
  and engine defaults.

All three theme GearMenus replaced the prior CYCLE SPD slider with
an AUTO-SHUFFLE select (OFF / 15s / 30s / 45s / 90s / 3 min).
Persistence via existing `useVizSettings` localStorage flow.

Files:
- `web/src/features/visualizer/VisualizerEngine.ts` (rewritten —
  multi-pack merge, shuffle history, silence gate)
- `web/src/features/visualizer/useVizSettings.ts` (default 45)
- `web/src/features/visualizer/GearMenu.tsx` (preset count + select)
- `web/src/themes/asian-vibrant/components/GearMenu.tsx` (preset
  count + select)
- `web/src/themes/ac130-thermal/components/GearMenu.tsx` (preset
  count + select)
- `web/src/vite-env.d.ts` (4 sub-path module decls)
- `web/api/admin/oauth.ts` (view + provider-routed DELETE)
- `web/src/components/admin/OAuthTab.tsx` (URL-encode + note)
- `web/supabase/migrations/20260530000001_oauth_connections_unified_view.sql`

Verify: `tsc --noEmit` clean, `vite build` clean (237 modules,
5.14s). Migration applied via `supabase db push` from `web/`.

Audit: `.claude/memory/progress/preset-and-oauth-audit.md`.

### Prior current state — Manifesto markdown + server-side Spotify ingestion (2026-05-26)

Two shipped pieces:

### A. Manifesto wired to user-editable markdown

`Amor.tsx` no longer hard-codes the AMOR CANTUS AVIUM text. New
`web/public/manifesto.md` holds the prose; the component fetches
it at runtime, parses with a 30-line custom parser (no markdown
lib), and session-caches via module-scope `cachedManifesto` +
`pendingFetch`. Loading / error states styled in AC-130 phosphor
(`--ac-font-mono`, uppercase, letter-spaced). Header words still
stack vertically — split-on-whitespace render. Parser rules:
`# Heading` → title, line wrapped in `*...*` → italic subtitle,
all other non-empty lines → paragraphs; inline `*word*` → `<em>`.

Stone can now edit the manifesto by changing one file
(`web/public/manifesto.md`) and redeploying — no JSX, no rebuild
of Amor.tsx required.

Files: `web/public/manifesto.md` (NEW),
`web/src/features/obsession/pages/Amor.tsx` (rewritten — inline
constants and old emphasis helper removed, fetch + parser + state
machine added).

Pattern: `.claude/memory/patterns/index.md` "User-Editable Content
via public/ Markdown".

### B. Server-side Spotify ingestion — scores fix

**Root cause** of Stone's `/u` showing position 0 and all
derivatives "—" despite daily listening: the Vercel cron at
`/api/cron/recompute` never called Spotify. It re-aggregated
whatever was already in `spotify_play_history` /
`user_listening_stats` and re-scored. The only path that ever
ingested fresh recently-played data was the React UTab's
`POST /api/scores?action=recompute` with the user's access token
in the body — triggered only when the user opened `/u`
foreground. Stone rarely opens `/u` → empty ingestion tables →
position 0 → stdev 0 → null z-scores. Audit at
`.claude/memory/progress/scores-broken-audit.md` walked
candidates A-E and confirmed C.

Secondary bug: the OAuth scope list in
`web/src/services/spotify/auth.ts` was missing
`user-read-recently-played`. Even the client-triggered path was
silently 403'ing on `/v1/me/player/recently-played`.

**Fix shape**:
- New `web/api/_spotify-ingestion.ts` (underscore prefix →
  helper, not counted toward Vercel 12-function ceiling). Exports
  `refreshSpotifyAccessToken`, `ensureFreshAccessToken`,
  `syncRecentlyPlayed`, `forEachLinkedUser`. PKCE refresh
  (client_id only, no client_secret). Idempotent upserts on
  `(user_id, track_id, played_at)`. Daily aggregates use
  `max(existing, new)` so re-syncs never reduce counts.
  150ms throttle per user (~400 rpm, well under Spotify's ~180
  rpm cap). Per-user errors caught + logged, never abort the
  loop. Revoked refresh_tokens delete the `spotify_tokens` row.
- `web/api/cron/recompute.ts` rewritten to iterate
  `spotify_tokens` (not `oauth_connections`) via
  `forEachLinkedUser` and call ingestion + scoring per user.
  Day / week / month scales computed; week drives score events.
  `pingKeepalive` still fires first.
- `web/api/scores.ts` now imports `syncRecentlyPlayed` (replaces
  the inline `syncSpotifyData` it had) and exposes
  `?action=recompute-all`, gated by
  `Authorization: Bearer ${CRON_SECRET}`. Lets Stone fire the
  full pipeline on-demand from a terminal without waiting for
  the daily cron.
- `services/spotify/auth.ts` SCOPES gains
  `user-read-recently-played`.

**Manual steps required** (Stone, after deploy):
1. Confirm Vercel env vars: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, optionally
   `SPOTIFY_CLIENT_ID` (hardcoded fallback matches browser PKCE
   client_id).
2. Disconnect + reconnect Spotify in the profile dropdown to
   grant the new `user-read-recently-played` scope. The Supabase
   `spotify_tokens` row retains whatever scope set was authorized
   at link time — existing rows must be re-issued.
3. Fire once to populate initial data:
   `curl -X POST https://mheu.lol/api/scores?action=recompute-all -H "Authorization: Bearer $CRON_SECRET"`
4. Daily cron at `0 0 * * *` UTC keeps it warm thereafter.

Files: `web/api/_spotify-ingestion.ts` (NEW),
`web/api/cron/recompute.ts` (full rewrite),
`web/api/scores.ts` (helper import + `handleRecomputeAll`),
`web/src/services/spotify/auth.ts` (scope add).

Audit: `.claude/memory/progress/scores-broken-audit.md`.
Decision: `.claude/memory/decisions/scoring-server-ingestion.md`.

Build clean (`vite build` 3.79s, 229 modules). `tsc --noEmit`
clean.

### Prior current state — OBSESSION polish (2026-05-26)

OBSESSION polish pass shipped earlier same day: settings scroll
fix (`.obs-root` own scroll container), bird image path code-
swapped to PNG (PNG asset still pending Stone re-export),
manifesto refactor to top-of-file constants — now SUPERSEDED by
the markdown wiring above. Files:
`web/src/features/obsession/obsession.css`,
`web/src/features/obsession/components/BirdButton.tsx`,
`web/src/features/obsession/pages/Amor.tsx`.

### Prior current state — OBSESSION feature ship (2026-05-25)

OBSESSION shipped. A hidden, per-user, AC-130-locked self-discipline
surface accessible only by typing `obsession` (9-key egg, 3s window,
skips inputs). Five surfaces under `/obsession/*`: Landing, Meditations
(7-min disciplined write with autosave + tab-resume), Training
(Strava OAuth + MyNetDiary CSV ingest + conflict pill), Lifts
(sessions with W/P/V/F stop reasons + 0/1/2 intensity + shorthand),
Amor (manifesto), Settings (duration/limit/conflict policy + export).

Architecture:
- 11 `obsession_*` Supabase tables with RLS `auth.uid() = user_id`
  (migration `20260525120000_obsession_tables.sql`, applied).
- `useObsessionEgg()` mounted in `AppRoutes` listens window-level for
  the 9-key sequence. Skips inputs, modifier keys, and signed-out users.
- `ThemeOverrideProvider id="ac130-thermal"` sets
  `document.documentElement.dataset.theme` on mount, restores on
  unmount. Does NOT call `setTheme()` — user's theme preference is
  preserved.
- Routes mounted at `App.tsx` as `<Route path="/obsession/*"
  element={<ObsessionRoutes />} />`. Skipped by the Spotify
  routing gate via `isObsessionRoute` early-return so the egg
  doesn't bounce to `/spotify-login`.
- Strava handshake + sync folded into existing `web/api/oauth.ts`
  (`?provider=strava`, `?action=strava-sync`) — function count
  stays at 12/12.
- 7-min discipline: draft row stores `started_at`; elapsed derived
  from wall time every tick so backgrounded tabs snap correctly.
  Body autosaves every 5s. Lock-in promotes draft to
  `obsession_meditations`, then deletes draft.
- Lift shorthand: groups sets by `exercise_name + weight`, renders
  `BENCH 135#10W,10W / 155#8F,7F↑` with per-character color
  classes for W/P/V/F/↑.
- Export: JSON envelope per surface + per-table CSV + full bundle.
  Hand-rolled CSV parser + writer (no papaparse, no jszip deps).

Files (web/src/features/obsession/):
- `ObsessionRoutes.tsx` — wraps Routes in ThemeOverrideProvider
- `ObsessionLayout.tsx` — `.obs-root` shell + HudCorners outlet
- `ThemeOverrideProvider.tsx` — DOM-only theme override
- `useObsessionEgg.ts` — 9-key listener
- `obsession.css` — all `.obs-*` surface styles
- `components/HudCorners.tsx` — 4 corner plates with live tick
- `lib/{types,localDate,dayCount,quotes,preferences,meditations,
  lifts,training,export}.ts`
- `pages/{Landing,Meditations,MeditationsWrite,Training,Lifts,
  LiftsLog,Amor,Settings}.tsx`

Modified:
- `web/src/App.tsx` — egg hook + isObsessionRoute exemption + route mount
- `web/api/oauth.ts` — Strava OAuth start/callback/sync handlers

Build clean (`vite build` 3.34s). `tsc --noEmit` clean. Bundle
1.56 MB (gzip 370 kB) — warning but non-blocking.

Decision: `.claude/memory/decisions/obsession-architecture.md`.
Pattern: `.claude/memory/patterns/obsession-feature-pattern.md`.
Build plan: `.claude/memory/progress/obsession-build-audit.md`.

### Prior current state — AC-130 phosphor palette + stub font (2026-05-25)

AC-130 Thermal is now a full sibling theme at parity with Frutiger
Aero and Asian Vibrant. L3Harris fire-control HUD vocabulary: black
void, white-phosphor wire chrome, scan lines, monospace caps wrapped
in `[ ]` brackets, IR red reserved for FIRE pip, amber for advisory,
grayscale white-hot reserved for the WaveformBar. Persistent corner
HUD overlays (live UTC timestamp + mode + offset, drifting lat/lon +
alt + LOS, compass tape, FIRE/LASER/BORE/SEE status with flicker,
N: OFF DISARM, L1514 RDY timer) via a single shared 30fps-capped
RAF in `Decorations.tsx`. User accent intentionally muted — only
appears in avatar border, active nav tab frame, @username color in
feed rows, and focus rings. WaveformBar is pure grayscale white-hot
oscilloscope with thin white phosphor scrubline.

Color + font palette restored to original stub: `--ac-phosphor`
family (white #FFFFFF + rgba(255,255,255,*) tiers) replaces the
prior `--ac-hud-green` family (#00FF41). Font reverted from B612
Mono back to **HitmarkerText** (loaded globally via
`web/src/styles/fonts.css`, no Google Fonts dependency).

Files (web/src/themes/ac130-thermal/):
- `tokens.css` — 15+ `--ac-*` tokens, HitmarkerText (no @import)
- `theme.css` — 5 surface classes (`.ac-hud-frame`, `.ac-wire-button`,
  `.ac-bracket-tab`, `.ac-hud-text`, `.ac-thermal-bar`)
- `shell.tsx` — pass-through
- `index.ts` — manifest wiring all 11 components
- `components/Decorations.tsx` — shared RAF + 4-corner HUD overlays
- `components/DashboardShell.tsx`
- `components/NavBar.tsx`
- `components/ProfileDropdown.tsx` — "DEBRIEF" panel
- `components/MTab.tsx` — null (visualizer at App root)
- `components/HTabPlaceholder.tsx`
- `components/ETabPlaceholder.tsx`
- `components/UTab.tsx` — re-export of UserCompetitionTab
- `components/PlaybackControls.tsx` — "[ AUDIO STATION ]"
- `components/GearMenu.tsx` — "[ AMMO BAY / SETTINGS ]" drawer
- `components/WaveformBar.tsx` — grayscale white-hot
- `components/SocialFeedRow.tsx` — HUD log entry format

Stub archived at `web/src/archive/ac130-thermal-stub/`.

References: `web/public/reference/AC130-reference.JPEG` +
`ac130-reference-2.jpg`.

Design language: `.claude/memory/decisions/ac130-thermal-design-language.md`.
Build audit: `.claude/memory/progress/ac130-thermal-build-audit.md`.

Build clean (`vite build` 4.01s, 204 modules). `tsc --noEmit` clean.

### Prior current state — Spotify boot-sequence fix (2026-05-25)

Boot-sequence regression from `aff02d1` (Spotify token persistence)
is fixed. Refreshing on `/m` with a linked Spotify now goes
LoadingScreen → /m with no `/spotify-login` flash.

Root cause: `setUserAndHydrate` was fire-and-forget. Three different
effects in App.tsx read `mem` synchronously before hydration
finished, and the MHEU-route protector fired during the first
render with `session` still null. Race chain pushed users through
`/login` → `/spotify-login` even when their tokens row existed.

Fix shape:
- New `SpotifyHydration` state machine in `AppRoutes`:
  `idle | loading | linked | not-linked | error`.
- Derived `booting` flag combines `authLoading`, callback in-flight,
  and `spotifyHydration === 'loading'`. While `booting`, LoadingScreen
  is on screen and ALL routing effects bail at the top.
- A single post-boot effect makes every routing decision (replaces
  three racing effects).
- `setUserAndHydrate` now returns `HydrationOutcome`
  (`linked|not-linked|error`) and races an 8s timeout so a dead
  Supabase can't block boot indefinitely.
- `/callback` and the silent-refresh path explicitly promote state
  to `'linked'` after writing tokens so the gate lets them through.
- `refresh_invalid` event now demotes state to `'not-linked'` so a
  revoked token bounces the user to `/spotify-login` cleanly.
- Splash backstop: signed-in users on `/login` `/signup` `/` always
  splash; on `/spotify-login` they splash only when `spotifyLinked`.

Files: `web/src/App.tsx` (state machine + single gate effect),
`web/src/services/spotify/tokenStore.ts` (return outcome + 8s
timeout).

Audit: `.claude/memory/progress/spotify-login-redirect-bug.md`.
Decision: `.claude/memory/decisions/boot-sequence-contract.md`.

Build clean (`vite build` 3.46s, 192 modules). `tsc --noEmit` clean.

### Prior current state — accent paired tokens + glass overlays + feed overflow + AV polish (2026-05-25)

Cross-theme polish pass shipped. Three audit items addressed:

1. **User accent now paints all chrome surfaces.** Hardcoded teal in
   `VisualizerPage` (album-art placeholder border, fullscreen button
   border/color) replaced with `--accent-color*` tokens. `panelStyle`
   border switched to `var(--accent-color-border)`.
2. **Paired accent tokens** (`--user-accent` solid + `--user-accent-
   glass` at 0.15α) emitted by `applyAccentColor()` alongside the
   existing 5-variant API. Fallback values in `tokens.css` and per-
   theme `tokens.css`. Glass surfaces (`.glass-card`,
   `.glass-card-subtle`, `.stat-card`, `--aero-nav-bg`, `--aero-fog-
   bg`, GearMenu panel, Controls bar, VisualizerPage panel) now
   layer the accent wash over the dark frost base via
   `linear-gradient(0deg, var(--user-accent-glass), var(--user-
   accent-glass)), <base>`. Asian Vibrant theme-identity surfaces
   (lacquer band, paper cards, gold trim, dragon, branches, sun,
   hanko stamps) intentionally stay theme-default.
3. **U-tab activity feed overflow** — both themes constrain the
   inner feed list to `max-height: calc(100vh - 320px); overflow-y:
   auto` so the section header and first rows stay above the fold.

Asian Vibrant follow-up:
- Top-left cherry branch moved to `top: 60px` (below 56px MHEU nav)
  and shrunk to 280×220. Bottom-right shrunk to 240×200. No more
  overlap with nav/content on desktop.
- Dragon first-flight delay changed from `Math.min(wait, 12_000)`
  to `30_000 + Math.random() * 15_000` (30-45s window). Subsequent
  flights still use the full 60-90s/120-180s cadence.

Audit: `.claude/memory/progress/accent-and-overflow-audit.md`.
Decision: `.claude/memory/decisions/accent-color-paired-tokens.md`.

Build clean (`vite build` 3.55s, 192 modules). `tsc --noEmit` clean.

### Prior current state — Asian Vibrant dragon flies head-first (2026-05-24)

Follow-up `8fd404b` reverses dragon flight: enters from right edge,
exits left, so the left-facing illustration leads with its head.
`spineY` wave sign flipped to travel head→tail; pitch angle negated
so the leading head tips with the vertical sine. No `scaleX(-1)` —
asymmetric mane/claws/eye keep their orientation.

Asian Vibrant polish pass shipped. Four bugs Stone flagged are
fixed at root, and the theme now matches the supplied reference
imagery (dense pink-cream paper, deep crimson sun, illustrated
dragon, cherry-blossom branches):

- **Viewport background** — `RicePaperBackdrop` now uses explicit
  `100vw × 100vh` + `inset:0` + `pointer-events:none`, noise SVG uses
  `stitchTiles="stitch"` to defeat the feTurbulence tile gap, and
  `theme.css` scopes `body`/`#root` paint via
  `:root[data-theme='asian-vibrant']`. `DashboardShell` content lane
  is now `100vw / minHeight:100vh / overflow:visible`.
- **Dragon** — full rebuild as illustrated SVG: head with eye (sclera
  + pupil + gold highlight), two curving gold horns, mouth open with
  teeth + red tongue, long curving whiskers with gold tips; flowing
  3-layer gold mane behind the head; 11 cream body segments with red
  underside banding + diamond scale overlay + dorsal fin tufts on
  alternating segments; front + back legs with 3-toed gold claws;
  tapered tail with red+gold flame tuft. Body undulation driven by
  per-segment transforms from a single RAF (spineY / spineAngle
  helpers). Same 60-90s desktop / 120-180s mobile cadence.
- **Palette + decorative density** — tokens deepened (`--av-crimson`
  is now `#A0001C`, new `--av-gold-leaf #FFD700`, `--av-pink-*`
  range, `--av-indigo`, `--av-cinnabar`, `--av-peach`,
  `--av-paper-pink`); paper grain mesh now has 4 colored radial
  washes; added new layers `SunDisk` (deep crimson upper-right),
  `DistantClouds` (3 wispy ink-wash bands + crisp wave strokes near
  top), `BackgroundCalligraphy` (giant faint 龍 watermark bottom-
  right), `CornerBranches` (gnarled top-left + bottom-right cherry
  branches with blossom clusters); mountains expanded from 2 to 4
  layered ridges with pine + pagoda silhouettes; kanji columns
  3→3 mobile / 4→6 desktop; petals 4→8 mobile / 8→18 desktop with
  three-stop pink hue range.
- **Dropdown shadow** — `.av-scroll-panel` retired in favor of
  split `.av-scroll-panel-outer` (carries shadow + rolled gradient
  edges, `overflow:hidden`) + `.av-scroll-panel-inner` (scrolls).
  `ProfileDropdown` wraps content accordingly. Shadow stays glued
  to the panel edge; content scrolls underneath.

The "one crimson moment per region" budget from the previous
rebuild doctrine is **deprecated**. The polish pass embraces
saturation + density.

Audit: `.claude/memory/progress/asian-vibrant-polish-audit.md`.

Build clean (`vite build` 4.12s, 192 modules). `tsc --noEmit` clean.

### Prior current state — self-healing loading screen (2026-05-24)

Self-healing loading screen shipped. New
`web/src/components/LoadingScreen.tsx` replaces both inline splash
blocks in `App.tsx`. Stages: 0-5s normal, 5-15s "taking longer"
message, 15-30s help card (Try again / Clear cache & reload / Sign
out & reload), 30s+ auto-clear-cache + reload with loop protection
via `sessionStorage.mheu_auto_recovered_at` (2-min TTL). Hardcoded
brand-color hex fallbacks alongside every CSS var so the splash
renders even if `tokens.css` fails. Old inline JSX archived at
`web/src/archive/loading-screen-v1/`. Companion change (PART 1.5):
`tokenStore.migrateFromLocalStorage` now wraps every step (parseInt,
`new Date(...).toISOString()`, persist, legacy-key clear) in nested
try/catch — addresses Stone's `mheu_token_expiry="Infinity"` hang
at the root cause. Build clean, tsc clean. Audit:
`.claude/memory/progress/loading-screen-audit.md`. Decision:
`.claude/memory/decisions/loading-screen-self-healing.md`.

### Prior current state — Spotify token persistence (2026-05-24)

Spotify OAuth tokens now persist to Supabase, not just browser
localStorage. New `public.spotify_tokens` table (self-only RLS, per-
user PK, updated_at trigger). New `services/spotify/tokenStore.ts`
owns an in-memory cache + Supabase persistence + one-time legacy
localStorage migration (dormant after 2026-06-23). `tokens.ts` is now
a thin adapter — existing call sites unchanged. "Disconnect Spotify"
button added to both ProfileDropdowns. Top-of-page banner surfaces
save / refresh-invalid failures non-blockingly. Migration
`20260524000002_add_spotify_tokens_table.sql` needs to be applied to
production Supabase. Audit:
`.claude/memory/progress/spotify-token-persistence-audit.md`.
Decision: `.claude/memory/decisions/spotify-token-persistence.md`.

### Prior current state — Asian Vibrant rebuild (2026-05-24)

Previously rebuilt as "monk's scriptorium" (commit `9bfc7e7`).
Polish pass above OVERRIDES the restrained budgets from that
rebuild. `ThemeErrorBoundary` from earlier in the day still in place
as a safety net.

Admin escape hatch:
```sql
UPDATE profiles SET theme_id = 'frutiger-aero' WHERE id = '<user-uuid>';
```

**No queued engineering task.** Next is AC-130 Thermal — currently
still a stub "coming soon".

## Active Product

MHEU web app at https://mheu.lol. Source tree `/web`. Electron
desktop is parked in `legacy/desktop/`.

## What's Live on mheu.lol

- Real-time scoring engine (soft-cap 0–200), 4 connectors, prestige
  tiers.
- M tab: Butterchurn + waveform progress bar (SVG path, click to
  seek) + Controls + GearMenu (tab-audio capture + signal meter).
- H tab: stub.
- E tab: stub ("Entertainment coming soon").
- U tab: leaderboard + social feed (T4 module under
  `web/src/features/feed/`).
- **NEW: profile icon top-left of nav (persistent across all tabs).**
  Click opens dropdown with avatar upload, accent color picker,
  reveal-action toggles per score type, theme switcher (Frutiger Aero
  / Asian Vibrant / AC-130 Thermal), sign-out.
- /admin: 10 tabs (Users, OAuth, LifeScores, Leaderboard, Scoring,
  ScoreVisibility, Passwords, Presets, Tooltips, Palette).
- Supabase keepalive (client + cron) preventing 7-day auto-pause.

## Function Budget (Hobby tier: 12)

At ceiling. Anything new replaces or folds into an existing
function. Helpers prefixed with `_` (no default export) are not
counted.

## Manual Steps Required

1. ~~Apply keepalive migration~~ — done (manually via dashboard)
2. ~~Apply user_scores FK migration~~ — done
3. ~~Apply profiles.theme_id migration~~ — done
4. ~~Apply spotify_tokens migration~~ — done
5. Set Discord OAuth env vars on Vercel:
   `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
   `DISCORD_REDIRECT_URI`.
6. Decide Vercel Deployment Protection state.

## Supabase CLI (set up 2026-05-25)

- **Installed**: `supabase` v2.101.0 (global via npm)
- **Authenticated**: yes
- **Linked**: `web/` → project `dbfsddgsawjufmqqwwha` (MHEU)
- **Migration state**: fully synced (24 migrations, all applied)
- **Workflow**: from `/web`, run `supabase db push` to apply new
  migrations. No more manual dashboard SQL.

## Theme System Quick Map

- Registry: `web/src/themes/registry.ts`
- Contract: `web/src/themes/types.ts` (`ThemeManifest`, `ThemeSurfaces`)
- Context: `web/src/themes/ThemeContext.tsx` (`useTheme()`)
- Themes:
  - `web/src/themes/frutiger-aero/` — full, default.
  - `web/src/themes/asian-vibrant/` — full. Decorative layers in
    `components/Decorations.tsx`, brush icons in `BrushIcons.tsx`,
    surface classes in `theme.css`, palette + fonts in `tokens.css`.
  - `web/src/themes/ac130-thermal/` — full. HUD overlays in
    `components/Decorations.tsx`, surface classes in `theme.css`,
    white-phosphor palette + HitmarkerText font in `tokens.css`.
    Stub archived at `web/src/archive/ac130-thermal-stub/`.
- VisualizerPage wires PlaybackControls/WaveformBar/GearMenu through
  `useTheme().components`.
- Decisions:
  - `.claude/memory/decisions/theme-system-architecture.md`
  - `.claude/memory/decisions/asian-vibrant-design-language.md`
  - `.claude/memory/decisions/ac130-thermal-design-language.md`
- How-to: `.claude/memory/patterns/theme-system.md`
- Audit: `.claude/memory/progress/asian-vibrant-audit.md`

## Git State

- Local: `main` advancing past `1896e70`.
- Remote: only `origin/main`.
- Vercel: `prj_NTA1v4ALsLHqJ5ZLE1Jf0PjBKpxR` ("project-iwmob"),
  root dir `web`, deploying from `main`. mheu.lol live.

## Untracked but Present

- `/Visual/` — old nested-clone folder. Gitignored. Preserved on
  disk; never tracked.
