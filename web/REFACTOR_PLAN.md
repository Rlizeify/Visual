# web/ Refactor Plan

**Date**: 2026-04-30
**Branch**: `refactor/consolidate`
**Based on**: `REFACTOR_AUDIT.md`
**Status**: APPROVED — decisions recorded 2026-04-30. No code changed yet.

---

## Rule

**One responsibility per file.** No line-count rule. A file may be long if it
has exactly one job. A file should be split when it has more than one job.

---

## 1. Proposed Folder Structure

```
web/
├── api/                          ← Vercel serverless (unchanged shape)
│   ├── _auth.ts                  NEW — shared getSpotifyId() guard
│   ├── _db.ts                    keep
│   ├── _jwt.ts                   keep
│   ├── auth.ts                   keep (import _auth.ts)
│   ├── settings.ts               keep (import _auth.ts)
│   └── wiki.ts                   DELETE (orphaned — no UI consumer)
│
└── src/
    ├── features/                 NEW — self-contained feature modules
    │   ├── spotify/
    │   │   └── (consumers only — no logic here; logic lives in services/)
    │   ├── visualizer/
    │   │   ├── ButterchurnCanvas.tsx   extracted from VisualizerPage.tsx
    │   │   ├── VisualizerPage.tsx      slimmed page shell (~150 lines target)
    │   │   └── useVizSettings.ts       settings state + persistence hook
    │   └── oscilloscope/
    │       ├── ScopeCanvas.tsx         extracted from VisualizerPage.tsx
    │       ├── OsciPanel.tsx           extracted from VisualizerPage.tsx
    │       ├── types.ts                OsciSettings interface + OSCI_DEFAULTS + OSCI_COLORS
    │       └── storage.ts              loadOsciSettings / saveOsciSettings
    │
    ├── services/                 NEW — all external I/O and side-effect singletons
    │   └── spotify/
    │       ├── auth.ts           PKCE flow (buildAuthUrl, handleCallback, initiateSpotifyLogin)
    │       ├── tokens.ts         token localStorage (getAccessToken, isAuthenticated,
    │       │                       hasRefreshToken, refreshToken, clearAuth)
    │       ├── session.ts        backend JWT bridge (postSessionAuth, decodeSessionPayload,
    │       │                       postServerSettings, fetchUserProfile)
    │       ├── player.ts         playback controls (play, pause, nextTrack, previousTrack,
    │       │                       toggleShuffle)
    │       ├── polling.ts        state machine (startPolling, stopPolling, getMusicData,
    │       │                       getInterpolatedProgress, pollPlaybackState)
    │       ├── analysis.ts       audio analysis (fetchAudioAnalysis, getAnalysis, isBpmFallback)
    │       └── types.ts          MusicData, AudioAnalysis, AudioAnalysisBeat,
    │                               AudioAnalysisSegment, AudioAnalysisSection
    │
    ├── shared/                   NEW — cross-feature utilities
    │   ├── hooks/
    │   │   └── useMouseIdle.ts   idle timer + controlsVisible state (extracted from VisualizerPage)
    │   └── utils/
    │       └── localStorage.ts   generic typed loadFromStorage<T> / saveToStorage helpers
    │
    ├── ui/                       NEW — presentational primitives (no logic, no state)
    │   ├── Slider.tsx            unified OsciSlider + Row → single Slider component
    │   └── Panel.tsx             glassmorphism panel wrapper (panelStyle extracted)
    │
    ├── styles/
    │   ├── tokens.ts             NEW — design tokens as TS constants (colours, font stack)
    │   ├── tokens.css            NEW — CSS custom properties (mirrors tokens.ts)
    │   ├── fonts.css             keep
    │   └── global.css            keep (remove inline hex strings → reference tokens.css vars)
    │
    ├── App.tsx                   slim router (already ~130 lines — update imports only)
    ├── main.tsx                  keep
    └── vite-env.d.ts             keep
```

### What is NOT created
- `state/` — the engine and polling module are already module-level singletons
  (`getVisualizerEngine()`, `getMusicData()`). No new state layer needed until
  a global store is required.
- `features/wiki/` — the wiki backend exists but has no UI. Adding a feature
  shell for dead code creates noise. Delete `api/wiki.ts` instead.

---

## 2. Audit Finding → Fix Mapping

### 2a. VisualizerPage.tsx (796 lines) → 6 files

| Extracted piece | Destination | Lines (approx) |
|----------------|-------------|----------------|
| `ButterchurnCanvas` memo component | `features/visualizer/ButterchurnCanvas.tsx` | ~55 |
| `ScopeCanvas` memo component + RAF draw loop | `features/oscilloscope/ScopeCanvas.tsx` | ~105 |
| `OsciPanel` component | `features/oscilloscope/OsciPanel.tsx` | ~80 |
| `OsciSlider` component | `ui/Slider.tsx` (merged with GearMenu `Row`) | see §2e |
| `OsciSettings` type + defaults + colors + load/save | `features/oscilloscope/types.ts` + `features/oscilloscope/storage.ts` | ~55 |
| `loadVizSettings` / `saveVizSettings` + settings state | `features/visualizer/useVizSettings.ts` | ~40 |
| `useMouseIdle` logic | `shared/hooks/useMouseIdle.ts` | ~20 |
| Page shell (layout, wiring, track metadata, mode toggle) | `features/visualizer/VisualizerPage.tsx` | ~150 |

`VisualizerPage.tsx` becomes a clean orchestrator: mounts the canvases,
renders the HUD, wires controls. No rendering logic, no storage logic.

### 2b. SpotifyWebPlayer.ts (645 lines) → 7 files

| Extracted piece | Destination |
|----------------|-------------|
| PKCE helpers + `buildAuthUrl` + `handleCallback` + `initiateSpotifyLogin` | `services/spotify/auth.ts` |
| `getAccessToken`, `isAuthenticated`, `hasRefreshToken`, `refreshToken`, `clearAuth` | `services/spotify/tokens.ts` |
| `postSessionAuth`, `decodeSessionPayload`, `postServerSettings`, `fetchUserProfile` | `services/spotify/session.ts` |
| `play`, `pause`, `nextTrack`, `previousTrack`, `toggleShuffle` | `services/spotify/player.ts` |
| `startPolling`, `stopPolling`, `pollPlaybackState`, `getMusicData`, `getInterpolatedProgress` | `services/spotify/polling.ts` |
| `fetchAudioAnalysis`, `getAnalysis`, `isBpmFallback` | `services/spotify/analysis.ts` |
| All interfaces/types (`MusicData`, `AudioAnalysis*`) | `services/spotify/types.ts` |
| `generateFrequencyData`, `renderLoop`, module-level `frequencyData`, `rafId` | **DELETE** (see §2d) |

`SpotifyWebPlayer.ts` is **deleted** after all exports are migrated.

App.tsx and VisualizerPage.tsx currently import directly from `SpotifyWebPlayer`.
Their imports are updated to point to the new service files.

### 2c. Duplicated `getSpotifyId()` in API files

**Fix**: create `api/_auth.ts` with a single exported `getSpotifyId(req, res)`.
Both `api/settings.ts` and `api/auth.ts` import from it. The duplicate
in `api/wiki.ts` is deleted along with that file.

```
api/_auth.ts        NEW — single source of truth for auth guard
api/settings.ts     update: import { getSpotifyId } from './_auth'
api/auth.ts         no change (doesn't use getSpotifyId)
api/wiki.ts         DELETE
```

### 2d. Two beat trackers → one survives

**`VisualizerEngine.runBeatScheduler()`** is the authoritative beat tracker.
It runs every RAF frame, drives the Butterchurn frequency data, and correctly
fires the `beatKickFrames` spike that makes the visualizer react to the beat.

**`SpotifyWebPlayer.ts`** contains a second, parallel implementation:
`updateBeatPulse()`, `generateFrequencyData()`, `renderLoop()`, and the
module-level `frequencyData: Uint8Array`. This loop runs alongside the engine's
loop but its output is never consumed — the engine generates its own frequency
data internally and never reads `SpotifyWebPlayer.frequencyData`.

**Action**: Delete from `SpotifyWebPlayer.ts` (and do not migrate to any new file):
- `frequencyData` (Uint8Array, line 284)
- `beatPulse` module variable
- `currentBeatIndex` module variable
- `findCurrentSegment()`
- `updateBeatPulse()`
- `generateFrequencyData()`
- `renderLoop()`
- The `rafId` variable and its RAF start/cancel in `startPolling`/`stopPolling`

`getFrequencyData()` export is also deleted (was only valid because of the above).

The engine's `runBeatScheduler()` stays exactly as-is.

### 2e. OsciSlider vs Row → unified Slider primitive

Both `OsciSlider` (VisualizerPage.tsx:94) and `Row` (GearMenu.tsx:63) are
label + range-slider + number-input + unit-label. They share the same contract
but use different prop names and colour tokens (OsciSlider uses `#27e0e1`;
Row uses `#00dcc8` — these are 1-digit apart in hex, visually identical).

**Fix**: create `ui/Slider.tsx` with the canonical implementation.
Accepts: `label`, `value`, `min`, `max`, `step`, `unit`, `onChange`.
Both callers update their imports.

The colour discrepancy (`#27e0e1` vs `#00dcc8`) is resolved by the token
extraction in §2f — both become `colors.tealPrimary` (CSS: `var(--color-teal-primary)`).
`#27e0e1` is dropped; `#00dcc8` is canonical.

### 2f. Design token extraction

Create **`src/styles/tokens.ts`** (TypeScript constants for use in TSX inline styles)
and **`src/styles/tokens.css`** (CSS custom properties for use in class-based styles).

```ts
// src/styles/tokens.ts
export const colors = {
  tealPrimary: '#00dcc8',   // canonical teal — replaces both #00dcc8 and #27e0e1
                             // #27e0e1 (oscilloscope panel) is dropped; #00dcc8 wins
  bg:          '#010103',   // page background
  panelBg:     'rgba(0, 20, 30, 0.55)',
  panelBorder: 'rgba(0, 220, 200, 0.4)',
  secondary:   'rgba(180, 240, 235, 0.7)',
  error:       'rgba(255, 100, 100, 0.85)',
} as const

export const fonts = {
  ui:    "'HitmarkerText', monospace",
  mono:  'monospace',
} as const

export const panel = {
  background:       colors.panelBg,
  backdropFilter:   'blur(12px)',
  border:           `1px solid ${colors.panelBorder}`,
  borderRadius:     8,
} as const
```

```css
/* src/styles/tokens.css */
:root {
  --color-teal-primary:  #00dcc8;
  --color-bg:            #010103;
  --color-panel-bg:      rgba(0, 20, 30, 0.55);
  --color-panel-border:  rgba(0, 220, 200, 0.4);
  --color-secondary:     rgba(180, 240, 235, 0.7);
  --color-error:         rgba(255, 100, 100, 0.85);
  --font-ui:             'HitmarkerText', monospace;
}
```

`global.css` already defines partial CSS vars (`--primary`, `--secondary`,
`--border`, `--panel-bg`) — `tokens.css` replaces those with the canonical set.
The partial CSS vars in `global.css` are removed to avoid two competing
variable namespaces.

### 2g. Dead code → deleted

| File | Action | Reason |
|------|--------|--------|
| `src/audio/AudioWSClient.ts` | **DELETE** | Not imported by any component or service |
| `api/wiki.ts` | **DELETE** | No UI consumer; feature not planned near-term. No stub. |
| `SpotifyWebPlayer.ts` render loop | **DELETE** | Superseded by VisualizerEngine (detail in §2d) |

---

## 3. File-by-File Migration Table

| Current file | New location(s) | Action | Notes |
|---|---|---|---|
| `src/audio/SpotifyWebPlayer.ts` | (split — see below) | **SPLIT + DELETE** | All exports migrated; file deleted after |
| ↳ PKCE auth functions | `services/spotify/auth.ts` | extract | `buildAuthUrl`, `handleCallback`, `initiateSpotifyLogin` |
| ↳ Token storage functions | `services/spotify/tokens.ts` | extract | `getAccessToken`, `isAuthenticated`, `hasRefreshToken`, `refreshToken`, `clearAuth` |
| ↳ Backend session functions | `services/spotify/session.ts` | extract | `postSessionAuth`, `decodeSessionPayload`, `postServerSettings`, `fetchUserProfile` |
| ↳ Playback control functions | `services/spotify/player.ts` | extract | `play`, `pause`, `nextTrack`, `previousTrack`, `toggleShuffle` |
| ↳ Polling state machine | `services/spotify/polling.ts` | extract | `startPolling`, `stopPolling`, `getMusicData`, `getInterpolatedProgress`, `pollPlaybackState` |
| ↳ Audio analysis | `services/spotify/analysis.ts` | extract | `fetchAudioAnalysis`, `getAnalysis`, `isBpmFallback` |
| ↳ Types | `services/spotify/types.ts` | extract | `MusicData`, `AudioAnalysis*` interfaces |
| ↳ Render loop + frequencyData | *(nowhere)* | **DELETE** | Dead — engine generates its own |
| `src/audio/VisualizerEngine.ts` | `features/visualizer/VisualizerEngine.ts` | **MOVE** | Update imports from SpotifyWebPlayer → new service paths |
| `src/audio/AudioWSClient.ts` | *(nowhere)* | **DELETE** | Not imported anywhere |
| `src/components/VisualizerPage.tsx` | (split — see below) | **SPLIT** | |
| ↳ `ButterchurnCanvas` | `features/visualizer/ButterchurnCanvas.tsx` | extract | |
| ↳ `ScopeCanvas` | `features/oscilloscope/ScopeCanvas.tsx` | extract | |
| ↳ `OsciPanel` | `features/oscilloscope/OsciPanel.tsx` | extract | |
| ↳ `OsciSlider` | `ui/Slider.tsx` | merge with GearMenu `Row` | |
| ↳ `OsciSettings` + defaults + colors | `features/oscilloscope/types.ts` | extract | |
| ↳ `loadOsciSettings` / `saveOsciSettings` | `features/oscilloscope/storage.ts` | extract | |
| ↳ `loadVizSettings` / `saveVizSettings` + viz settings state | `features/visualizer/useVizSettings.ts` | extract | becomes a hook |
| ↳ mouse idle logic | `shared/hooks/useMouseIdle.ts` | extract | |
| ↳ page shell | `features/visualizer/VisualizerPage.tsx` | keep (slimmed) | |
| `src/components/GearMenu.tsx` | `features/visualizer/GearMenu.tsx` | **MOVE** | Update `Row` → `ui/Slider`; update SpotifyWebPlayer imports |
| `src/components/Controls.tsx` | `features/spotify/Controls.tsx` | **MOVE** | Pure Spotify playback UI; update imports |
| `src/components/LoginPage.tsx` | `features/spotify/LoginPage.tsx` | **MOVE** | Update imports from `../audio/SpotifyWebPlayer` → `services/spotify/auth` |
| `src/App.tsx` | `src/App.tsx` | **UPDATE IMPORTS** | Path changes only; routing logic unchanged |
| `src/main.tsx` | `src/main.tsx` | keep | |
| `src/vite-env.d.ts` | `src/vite-env.d.ts` | keep | |
| `src/styles/global.css` | `src/styles/global.css` | **UPDATE** | Remove partial CSS vars; import tokens.css |
| `src/styles/fonts.css` | `src/styles/fonts.css` | keep | |
| `src/styles/tokens.ts` | *(new)* | **CREATE** | TS design token constants |
| `src/styles/tokens.css` | *(new)* | **CREATE** | CSS custom properties |
| `ui/Slider.tsx` | *(new)* | **CREATE** | Merged from `OsciSlider` + `Row` |
| `ui/Panel.tsx` | *(new)* | **CREATE** | Glassmorphism panel style wrapper |
| `shared/hooks/useMouseIdle.ts` | *(new)* | **CREATE** | Extracted from VisualizerPage |
| `shared/utils/localStorage.ts` | *(new)* | **CREATE** | Generic typed storage helpers |
| `features/oscilloscope/types.ts` | *(new)* | **CREATE** | |
| `features/oscilloscope/storage.ts` | *(new)* | **CREATE** | |
| `features/oscilloscope/ScopeCanvas.tsx` | *(new)* | **CREATE** | |
| `features/oscilloscope/OsciPanel.tsx` | *(new)* | **CREATE** | |
| `features/visualizer/VisualizerEngine.ts` | *(moved from audio/)* | **MOVE** | |
| `features/visualizer/ButterchurnCanvas.tsx` | *(new)* | **CREATE** | |
| `features/visualizer/useVizSettings.ts` | *(new)* | **CREATE** | |
| `api/_auth.ts` | *(new)* | **CREATE** | Shared `getSpotifyId()` |
| `api/settings.ts` | `api/settings.ts` | **UPDATE** | Import `getSpotifyId` from `_auth` |
| `api/auth.ts` | `api/auth.ts` | keep | No `getSpotifyId` usage |
| `api/wiki.ts` | *(nowhere)* | **DELETE** | No UI; feature not planned. No stub. |
| `api/_db.ts` | `api/_db.ts` | keep | |
| `api/_jwt.ts` | `api/_jwt.ts` | keep | |

**Summary**: 4 files deleted, 3 files moved, 5 files split, 12 files created,
4 files updated (imports only). The 17-file codebase becomes ~32 files,
each with a single responsibility.

---

## 4. Migration Order

Dependencies flow bottom-up. Each step leaves the app in a working state.

### Step 1 — Tokens (no logic changes)
Create `tokens.ts` + `tokens.css`. Update `global.css`. **No component changes yet.**
Risk: zero. Fully reversible. Unblocks every step that follows.

### Step 2 — Dead code deletion
Delete `AudioWSClient.ts`, `api/wiki.ts`, and the render loop / `frequencyData`
block inside `SpotifyWebPlayer.ts`. Run TypeScript check to confirm no consumers.
Risk: low. Confirms the audit's "not imported" finding.

### Step 3 — Split SpotifyWebPlayer into services/spotify/*
Most files depend on `SpotifyWebPlayer`. Splitting it first makes all subsequent
import updates trivial (each file knows exactly which service to point at).
Do as a single atomic changeset: create all 7 service files, delete the source
file, update all import sites (`App.tsx`, `VisualizerPage.tsx`, `GearMenu.tsx`,
`Controls.tsx`, `LoginPage.tsx`, `VisualizerEngine.ts`) in the same commit.
Risk: medium. Many import sites. Mitigation: TypeScript compiler catches every
missed reference before commit.

### Step 4 — API auth guard extraction
Create `api/_auth.ts`, update `api/settings.ts`, delete `api/wiki.ts`.
Three files, isolated to `api/`. Risk: low.

### Step 5 — UI primitives (Slider, Panel)
Create `ui/Slider.tsx` (merge of `OsciSlider` + `Row`). No callers updated yet.
Risk: zero — new file, nothing imports it yet.

### Step 6 — Extract oscilloscope feature
Move `OsciSettings` types + storage → `features/oscilloscope/`.
Extract `ScopeCanvas` → `features/oscilloscope/ScopeCanvas.tsx`.
Extract `OsciPanel` → `features/oscilloscope/OsciPanel.tsx`.
Update `OsciPanel` to use `ui/Slider` instead of `OsciSlider`.
`VisualizerPage.tsx` imports from new locations.
Risk: low — components are already self-contained memos.

### Step 7 — Extract visualizer internals
Move `VisualizerEngine.ts` → `features/visualizer/`.
Extract `ButterchurnCanvas` → `features/visualizer/ButterchurnCanvas.tsx`.
Extract `useVizSettings` hook → `features/visualizer/useVizSettings.ts`.
Extract `useMouseIdle` → `shared/hooks/useMouseIdle.ts`.
Update `GearMenu.tsx` to use `ui/Slider` instead of `Row`.
Risk: medium — `VisualizerEngine` import path changes in 3 files.

### Step 8 — Slim VisualizerPage
After steps 6–7, `VisualizerPage.tsx` should be ~150 lines of pure wiring.
Move to `features/visualizer/VisualizerPage.tsx`. Update `App.tsx` import.
Risk: low — just a rename after all extractions are done.

### Step 9 — Move remaining components
Move `Controls.tsx` → `features/spotify/Controls.tsx`.
Move `LoginPage.tsx` → `features/spotify/LoginPage.tsx`.
Move `GearMenu.tsx` → `features/visualizer/GearMenu.tsx`.
Update `App.tsx` and `VisualizerPage.tsx` imports.
Risk: low — pure moves, no logic changes.

---

## 5. Risks and Open Questions

### R1 — `window.__musicData` global
`ScopeCanvas` reads `window.__musicData` (set by `VisualizerEngine`) every RAF
frame without React state, intentionally to avoid re-renders. This is a side
channel between two unrelated modules. The refactor preserves this pattern as-is
(it's a deliberate performance choice, not a bug). If the pattern becomes a
problem in future, the right fix is a typed shared ref — but that's out of scope.

### R2 — `#27e0e1` vs `#00dcc8` colour discrepancy ✓ RESOLVED
**Decision**: consolidate to `#00dcc8`. Token name `--color-teal-primary` /
`colors.tealPrimary`. `#27e0e1` (oscilloscope panel) is dropped. No second token.

### R3 — SpotifyWebPlayer circular-ish dependencies
`VisualizerEngine` imports from `SpotifyWebPlayer` (`getAnalysis`, `getMusicData`,
`getInterpolatedProgress`, `isBpmFallback`). After the split, these come from
`services/spotify/analysis.ts` and `services/spotify/polling.ts`. There is no
circular dependency because the engine does not export anything the services
import. Verify with `tsc --noEmit` after Step 3.

### R4 — `api/wiki.ts` — confirm deletion ✓ RESOLVED
**Decision**: delete. Not a planned near-term feature. No stub left behind.
`supabase-schema.sql` preserves the table definition if the feature is ever revisited.

### R5 — Vercel serverless import paths
The `api/` directory uses bare relative imports (`'./_db'`, `'./_jwt'`).
Adding `api/_auth.ts` follows the same convention. No build config changes needed.
Vercel treats each `api/*.ts` file as a route and ignores `api/_*.ts` prefixed
files as helpers — the underscore prefix is the Vercel convention for shared
helpers. Confirmed safe.

### R6 — Migration atomicity
Steps 3, 6, and 7 each touch multiple files at once. A partial commit (some
files updated, others not) breaks the app. Each step must be committed as a
single atomic changeset. Running `tsc --noEmit` before each commit is the gate.

### R7 — GearMenu settings fetch
`GearMenu.tsx` calls `getVisualizerEngine()` directly (not via a prop). After
moving to `features/visualizer/GearMenu.tsx`, the import path changes but the
singleton pattern is preserved. No API change.
