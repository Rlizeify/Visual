# web/ Refactor Audit

**Date**: 2026-04-30
**Branch**: `refactor/consolidate`
**Auditor**: Claude Sonnet 4.6

---

## 1. File Count

**17 source files** across `src/` and `api/` (excluding node_modules, dist, public fonts).
**3,259 total lines.**

---

## 2. Top 20 Largest Files (by line count)

Only 17 files exist, so all are listed:

| # | File | Lines |
|---|------|-------|
| 1 | `src/components/VisualizerPage.tsx` | 796 |
| 2 | `src/audio/SpotifyWebPlayer.ts` | 645 |
| 3 | `src/audio/VisualizerEngine.ts` | 540 |
| 4 | `src/components/GearMenu.tsx` | 481 |
| 5 | `src/components/LoginPage.tsx` | 140 |
| 6 | `src/App.tsx` | 130 |
| 7 | `src/audio/AudioWSClient.ts` | 107 |
| 8 | `src/components/Controls.tsx` | 103 |
| 9 | `src/styles/global.css` | 101 |
| 10 | `api/wiki.ts` | 55 |
| 11 | `api/settings.ts` | 45 |
| 12 | `src/vite-env.d.ts` | 35 |
| 13 | `src/styles/fonts.css` | 32 |
| 14 | `api/auth.ts` | 27 |
| 15 | `src/main.tsx` | 10 |
| 16 | `api/_jwt.ts` | 9 |
| 17 | `api/_db.ts` | 3 |

**Problem files**: The top 4 files average 616 lines each and each contain
multiple distinct responsibilities. `VisualizerPage.tsx` at 796 lines is
the most severe — it contains 5 distinct components/concerns.

---

## 3. Current Folder Structure

```
web/
├── api/                          ← Vercel serverless functions
│   ├── _db.ts                    — Supabase client singleton (3 lines)
│   ├── _jwt.ts                   — JWT sign/verify (9 lines)
│   ├── auth.ts                   — POST /api/auth: Spotify token → JWT
│   ├── settings.ts               — GET/POST /api/settings: user settings
│   └── wiki.ts                   — GET/POST /api/wiki: wiki entries (UNUSED in UI)
├── public/
│   └── fonts/HitmarkerText/      — 4 woff2 font files
├── src/
│   ├── audio/
│   │   ├── AudioWSClient.ts      — WS client for desktop companion (NOT IMPORTED anywhere)
│   │   ├── SpotifyWebPlayer.ts   — PKCE auth + polling + audio analysis + playback controls
│   │   └── VisualizerEngine.ts   — Butterchurn singleton + live audio capture + beat scheduler
│   ├── components/
│   │   ├── Controls.tsx          — Playback controls bar (prev/play/next/shuffle)
│   │   ├── GearMenu.tsx          — Settings panel: live audio, presets, reactivity sliders
│   │   ├── LoginPage.tsx         — Spotify login button + QR code
│   │   └── VisualizerPage.tsx    — Main page (GOD COMPONENT — see below)
│   ├── styles/
│   │   ├── fonts.css             — @font-face declarations
│   │   └── global.css            — CSS variables, body defaults, idle orb animation
│   ├── App.tsx                   — Manual router + auth state machine
│   ├── main.tsx                  — Entry point (mounts App)
│   └── vite-env.d.ts             — Vite env type declarations
├── index.html
├── supabase-schema.sql
├── tsconfig.json
├── vite.config.ts
└── vercel.json
```

---

## 4. Duplicated Logic

### 4a. `getSpotifyId()` auth guard — exact duplicate
`api/settings.ts:5-18` and `api/wiki.ts:5-18` contain **byte-for-byte identical**
functions. Reads `Authorization: Bearer` header, calls `verifyToken`, returns
`spotify_id` or 401s. Should be a single shared helper in `api/_auth.ts`.

### 4b. localStorage settings persistence pattern — structural duplicate
`VisualizerPage.tsx` contains two independent load/save pairs with identical
try-catch-JSON structure:
- `loadVizSettings()` / `saveVizSettings()` (lines 19-37) — visualizer settings
- `loadOsciSettings()` / `saveOsciSettings()` (lines 65-92) — oscilloscope settings

Both do: `JSON.parse(localStorage.getItem(KEY))` → validate object → merge
defaults → `JSON.stringify` on write. Same try/catch/silently-ignore pattern.

### 4c. Settings apply logic — two code paths do the same thing
`VisualizerPage.tsx` applies persisted settings to the engine in two places:
- `useEffect` on mount (lines 456-488): fetches `/api/settings`, iterates
  `numKeys`, calls `eng.updateSettings(patch)` and `eng.loadPreset(...)`.
- `handleEngineInit` callback (lines 492-506): reads localStorage, iterates
  same `keys` array, calls `eng.updateSettings(patch)`.

Both iterate the same `['bassReactivity', 'midReactivity', ...]` key list
and call identical engine methods. They exist because server settings arrive
async while engine init is sync — but the result is two near-identical blocks.

### 4d. Beat tracking — dual implementation
`SpotifyWebPlayer.ts` implements beat tracking in `updateBeatPulse()` +
`generateFrequencyData()` (lines 425-506). These generate a `beatPulse` value
and frequency array but their output (`frequencyData`) feeds `window.__musicData`
and is **not used by `VisualizerEngine`** — the engine has its own
`runBeatScheduler()` (lines 308-353) that re-implements the same beat-index
advance + kick detection from the same `AudioAnalysis` object.

Result: two parallel beat trackers running simultaneously, both reading
`getAnalysis()` and `getInterpolatedProgress()`, with slightly different
decay curves.

### 4e. Slider component — structural duplicate
- `OsciSlider` in `VisualizerPage.tsx` (lines 94-153): label + range + number
  input + unit, inline styles in monospace/cyan theme.
- `Row` in `GearMenu.tsx` (lines 63-88): same label + range + number input +
  unit structure, same HitmarkerText/cyan theme.

Different prop names and styling details, but identical logical contract.

### 4f. Design token duplication — no shared source
`#00dcc8` (cyan), `rgba(0, 20, 30, ...)` (panel bg), `'HitmarkerText', monospace`
(font stack), `rgba(0, 220, 200, 0.4)` (border) appear as raw strings in:
- `VisualizerPage.tsx` (7+ occurrences of each)
- `GearMenu.tsx` (6+ occurrences)
- `Controls.tsx` (3+ occurrences)
- `App.tsx` (inline loading screen)
- `LoginPage.tsx` (partial — uses CSS vars for some, raw strings for others)

`global.css` defines some CSS variables (`--primary`, `--secondary`, `--border`,
`--panel-bg`) but components use raw hex strings instead of the variables.

### 4g. Repeated `getAccessToken()` guard pattern
6 functions in `SpotifyWebPlayer.ts` (play, pause, nextTrack, previousTrack,
toggleShuffle, pollPlaybackState) all start with:
```ts
const token = getAccessToken()
if (!token) return
```
This is not a refactor target by itself, but it is a candidate for a
`withAuth(fn)` wrapper if the file is split.

---

## 5. Feature Surface

| Feature | Files |
|---------|-------|
| **Spotify PKCE auth** | `SpotifyWebPlayer.ts`, `App.tsx`, `LoginPage.tsx`, `api/auth.ts` |
| **Spotify polling** | `SpotifyWebPlayer.ts` (startPolling/stopPolling, 5s interval) |
| **Audio analysis** | `SpotifyWebPlayer.ts` (fetchAudioAnalysis, beat pulse, freq data) |
| **Playback controls** | `SpotifyWebPlayer.ts` (play/pause/next/prev/shuffle), `Controls.tsx` |
| **Butterchurn visualizer** | `VisualizerEngine.ts`, `VisualizerPage.tsx` (ButterchurnCanvas) |
| **Lissajous oscilloscope** | `VisualizerPage.tsx` (ScopeCanvas, OsciPanel, OsciSlider) |
| **Live audio input** | `VisualizerEngine.ts` (enableLiveAudio, enableTabAudio), `GearMenu.tsx` |
| **Settings persistence** | `VisualizerPage.tsx` (localStorage), `api/settings.ts` (Supabase) |
| **Session/JWT** | `SpotifyWebPlayer.ts`, `api/auth.ts`, `api/_jwt.ts`, `App.tsx` |
| **User storage** | `api/_db.ts`, `api/auth.ts` (users table), `api/settings.ts` (user_settings) |
| **Manual router** | `App.tsx` (login / callback / visualizer, popstate listener) |
| **Wiki API** | `api/wiki.ts` — backend exists, **no UI consumer** |
| **Desktop WS bridge** | `src/audio/AudioWSClient.ts` — **not imported anywhere in UI** |

### Dead / orphaned code
- `api/wiki.ts`: CRUD backend for `wiki_entries` table. No component imports or
  calls it. Either the UI was deleted or it was never built.
- `src/audio/AudioWSClient.ts`: WebSocket client for the desktop companion app
  (connects to `ws://mheu.local:2222`). Not imported by any component. Likely
  scaffolding for a planned feature.
- `SpotifyWebPlayer.ts` `generateFrequencyData()` + `renderLoop()`: produces
  frequency data into module-level `frequencyData` array and calls
  `requestAnimationFrame(renderLoop)` inside `startPolling()`. However,
  `VisualizerEngine` generates its own frequency data and never reads this
  module-level array. The render loop inside `SpotifyWebPlayer` appears
  unused — the engine runs its own RAF loop.

---

## 6. Structural Problems in VisualizerPage.tsx (796 lines)

This single file contains at minimum 5 distinct responsibilities:

1. **OsciSlider** (lines 94-153) — a generic UI component
2. **OsciPanel** (lines 155-232) — oscilloscope settings panel UI
3. **ButterchurnCanvas** (lines 234-285) — Butterchurn canvas lifecycle
4. **ScopeCanvas** (lines 287-391) — Lissajous canvas + RAF rendering loop
5. **VisualizerPage** (lines 393-796) — page shell: polling, settings sync,
   track metadata, idle state, mouse idle, mode toggle, layout

The OsciSettings type, defaults, storage keys, and load/save functions (lines
40-92) also live here but belong to the oscilloscope feature.

---

## 7. Summary of Issues

| Priority | Issue | Files Affected |
|----------|-------|----------------|
| HIGH | `VisualizerPage.tsx` is a 796-line god component | 1 file |
| HIGH | `SpotifyWebPlayer.ts` mixes auth, polling, analysis, and playback controls | 1 file |
| HIGH | Dual beat tracker running simultaneously | `SpotifyWebPlayer.ts`, `VisualizerEngine.ts` |
| MED | `getSpotifyId()` duplicated verbatim in 2 API files | `settings.ts`, `wiki.ts` |
| MED | localStorage load/save pattern duplicated 2× in VisualizerPage | 1 file |
| MED | Settings apply logic in 2 separate code paths | `VisualizerPage.tsx` |
| MED | Design tokens as raw strings across 4 components | 4 files |
| MED | Duplicate slider component (`OsciSlider` vs `Row`) | 2 files |
| LOW | Dead code: `AudioWSClient.ts` not imported | 1 file |
| LOW | Dead code: `api/wiki.ts` has no UI consumer | 1 file |
| LOW | Dead code: `SpotifyWebPlayer.ts` render loop + `frequencyData` unused | 1 file |
