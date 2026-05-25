# Active Context

**Last updated**: 2026-05-25 (AC-130 Thermal full theme replaces stub)

## Current State

AC-130 Thermal is now a full sibling theme at parity with Frutiger
Aero and Asian Vibrant. L3Harris fire-control HUD vocabulary: black
void, neon HUD-green wire chrome, scan lines, monospace caps wrapped
in `[ ]` brackets, IR red reserved for FIRE pip, amber for advisory,
grayscale white-hot reserved for the WaveformBar. Persistent corner
HUD overlays (live UTC timestamp + mode + offset, drifting lat/lon +
alt + LOS, compass tape, FIRE/LASER/BORE/SEE status with flicker,
N: OFF DISARM, L1514 RDY timer) via a single shared 30fps-capped
RAF in `Decorations.tsx`. User accent intentionally muted — only
appears in avatar border, active nav tab frame, @username color in
feed rows, and focus rings. WaveformBar is pure grayscale white-hot
oscilloscope with thin green scrubline.

Files (web/src/themes/ac130-thermal/):
- `tokens.css` — 15+ `--ac-*` tokens + B612 Mono Google Fonts import
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
    palette + B612 Mono in `tokens.css`. Stub archived at
    `web/src/archive/ac130-thermal-stub/`.
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
