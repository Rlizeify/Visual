# Active Context

**Last updated**: 2026-04-07

## Current Task
Fix: enforce Hitmarker Text globally — eliminate competing font declarations.

## Status
Complete.
- Root cause: with Hitmarker Text now actually bundled (prior task), the body default in `fonts.css` was correct but ~140 component declarations were overriding it via three CSS variables (`--font-display: 'Orbitron'`, `--font-ui: 'Rajdhani'`, plus `display.css`'s `--font-display: 'VT323'` and `--font-orbitron`) and a handful of hardcoded font names. Fonts looked inconsistent across windows because the body cascade never won.
- Leverage fix — CSS variables flipped to Hitmarker Text:
  - `src/styles/global.css:34,36` — `--font-display` and `--font-ui` → `'Hitmarker Text', system-ui, sans-serif`. `--font-mono` left as `'Share Tech Mono', monospace` (still used for numeric/data displays).
  - `src/styles/display.css:7,8` — `--font-display` and `--font-orbitron` → Hitmarker. `--font-mono` left alone.
  - That single change cascades through ~140 `var(--font-display|ui|orbitron)` call sites in `cockpit.css`, `studio.css`, `display.css`, `global.css`, `PluginRack.tsx`, `PluginPanel.tsx`.
- Hardcoded font names removed/replaced (the cases where `var(--font-*)` was bypassed):
  - `cockpit.css:366,437` — `'Rajdhani', var(--font-ui)` → `var(--font-ui)` (Rajdhani prefix was overriding the variable).
  - `HubTutorial.tsx`, `CockpitTutorial.tsx`, `StudioTutorial.tsx` — `'Rajdhani', sans-serif` → `'Hitmarker Text', system-ui, sans-serif` in each (`.tut-card__title`, `.tut-card__desc`).
  - `HubApp.tsx:414` — `.hub-btn` `'Inter', sans-serif` → Hitmarker. (Hub launcher buttons.)
  - `Tooltip.tsx:131` — tooltip detail line `'Rajdhani', sans-serif` → Hitmarker.
  - `WaveformPanel.tsx:382` — wave-type label `'Rajdhani, monospace'` → Hitmarker.
- Preserved (per task instructions):
  - `HubApp.tsx:296,315` — `logoText` and `logoBlueBorder` MHEU title `'SD Glitch'`. Untouched.
  - All `'Share Tech Mono', monospace` and `monospace` declarations on numeric/data/code displays (cockpit.css:1519, studio.css:519, HubApp.tsx:333,351,458, all 5 monospace lines per tutorial × 3 files, plus inline `fontFamily: 'monospace'` in `OscillatorLayer`, `AdditiveSynth`, `FunctionSynth`, `XYScope`, `ExportButton`, `VisualizerControls`, `VisualizerPreview`, `WaveformPanel.tsx` numeric labels, `Oscilloscope.tsx`).
- `global.css:3` stale comment "Fonts: Orbitron, Share Tech Mono, Rajdhani — loaded via index.html" updated to reflect Hitmarker Text + Share Tech Mono.
- `index.html` Google Fonts `<link>` tags for Orbitron/Rajdhani/Share Tech Mono left in place — Share Tech Mono is still used and the unused tags are harmless. Removing them is out of scope and could regress something I haven't traced.
- Verification: `grep "'(Rajdhani|Orbitron|VT323|Inter)'"` returns zero hits. `npx tsc --noEmit` clean.

## Previous Task
Fix: Hitmarker Text fonts not bundled by Vite.

## Status
Complete.
- Root cause: `fonts.css` referenced `../../fonts/18082023_Hitmarker/Text/WOFF/...` — that path leaves the Vite source root (`apps/desktop/src/`), so Vite did not copy the woff2/woff files into `dist/assets/`. Confirmed empirically: pre-fix `dist/assets/` contained `SDGlitch-*.ttf` (which lives at `src/styles/fonts/SDGlitch.ttf`, inside the source tree) but **zero** Hitmarker files. Vite has no `publicDir` configured, so anything outside `src/` is invisible to the bundler.
- Fix: copied the 8 referenced files (Regular/Italic/Medium/Bold × woff2+woff) from `apps/desktop/fonts/18082023_Hitmarker/Text/WOFF/` into `apps/desktop/src/styles/fonts/HitmarkerText/`. Updated `fonts.css` `url()` paths from `../../fonts/18082023_Hitmarker/Text/WOFF/` → `./fonts/HitmarkerText/` (mirrors the SDGlitch pattern).
- Verified: `npx vite build` now emits all 8 hashed Hitmarker files into `dist/assets/` (e.g. `HitmarkerText-Regular-APgbd4-k.woff2`). `npx tsc --noEmit` clean.
- Original `apps/desktop/fonts/18082023_Hitmarker/` tree left untouched (still contains the full Condensed/Normal/Wide/VF families if needed later).

## Previous Task
Fix: stale Spotify token + CSP blocking file:// video + Windows drive colon encoding.

## Status
Complete.
- `electron/spotify-auth.ts:11` — bumped `REQUIRED_SCOPE_VERSION` from `'2'` to `'3'`. Existing tokens granted under older scope set are cleared on next launch via `checkAndInvalidateScopeChange()`, forcing re-OAuth with the full `playlist-read-private`/`playlist-read-collaborative` scopes. Symptom on collaborator's machine: `/v1/me/playlists` returned playlists with `tracks` field undefined and `/v1/playlists/{id}/tracks` returned 403.
- `index.html` (only HTML with CSP) — added `file:` to `media-src` and `img-src`. Other HTML files (hub/studio/display) have no `<meta>` CSP and inherit Electron defaults; no main.ts header injection found.
- `src/audio/SpotifyPlayerAPI.ts` — `console.warn` now logs `typeof p.tracks` so undefined / null / `{total:0}` are distinguishable.
- `src/components/cockpit/SpotifyBrowser.tsx` — when `playlists.length > 0` but every playlist has `trackCount === 0`, renders a `sp-reconnect-banner` prompting disconnect/reconnect. Catches stale-scope case in UI.
- `src/components/cockpit/VideoPreview.tsx` — `toFileURL()` now restores Windows drive letter colon after URL-encoding (`/C%3A/` → `/C:/`) via `replace(/^\/([A-Za-z])%3A/, '/$1:')`. Trace: `C:\Users\nikob\Videos\clip.mp4` → `file:///C:/Users/nikob/Videos/clip.mp4`. `<video onError>` was already wired in earlier session.
- `npx tsc --noEmit` clean.

## Previous Task
Feat: Wire Spotify visualizer audio capture via Electron loopback (real implementation).

## Status
Complete — visualizer loopback is **now actually implemented**.
- `SpotifyPlayerAudio.ts` — silent oscillator stub **removed**. Replaced with `getDisplayMedia({ video: true, audio: true })` capture; video tracks stopped/removed immediately, audio track wired into the analyser via `MediaStreamAudioSourceNode`. Analyser is **not** connected to destination (avoids speaker feedback). Wrapped in try/catch — failures (no audio tracks on macOS/Linux, NotAllowedError, etc.) log a warning and return `false` instead of crashing. New exports: `isLoopbackRunning()`; `startLoopback()` now returns `boolean`.
- `SpotifyBrowser.tsx` — added "Enable Audio Reactivity" button in the toolbar. Visible when `activeSource === 'spotify'` and loopback idle; switches to "Audio Reactivity: On" on success or "Audio capture is Windows-only" on failure. Click is the user-gesture entrypoint for `getDisplayMedia`. Component now takes an `activeSource` prop.
- `CockpitGrid.tsx` — forwards `activeSource` to `<SpotifyBrowser>`.
- `CockpitApp.tsx` — auto-reconnect path no longer calls renderer-side `startLoopback()` (would throw NotAllowedError without user gesture). `handleSpotifyConnected` still attempts it best-effort with a comment noting the OAuth callback may not preserve the gesture chain; the button is the reliable fallback.
- Caveat: loopback captures **all** system audio, not just Spotify (inherent to Electron's loopback handler). UI text avoids claiming Spotify-only.
- Correction to earlier note below: previous "Spotify visualizer loopback is NOT IMPLEMENTED" line is **now stale** — loopback is implemented as of this session.

## Previous Task
Fix: Spotify API error surfacing.
- `SpotifyPlayerAPI.ts` — `fetchPlaylists()`/`fetchPlaylistTracks()` `console.error` status + statusText on non-OK responses.
- `SpotifyBrowser.tsx` — empty playlist state (when `isConnected`) shows error hint.

## Previous Task
Fix: VideoPreview `toFileURL()` URL-encoding (real fix this time).

## Status
Complete.
- `VideoPreview.tsx:13` — `toFileURL()` now URL-encodes each path segment via `encodeURIComponent`. Paths containing spaces, `#`, `?`, or other reserved chars now produce valid `file://` URLs (e.g. `clip #1.mp4` → `clip%20%231.mp4`).
- `VideoPreview.tsx` — added `loadError` state and `onError` handler on `<video>` that logs the failed src + `MediaError` to console and renders a visible "Failed to load video" overlay (`vp-error` class) instead of a silent black box.
- Earlier session 25 note claimed encoding was "already in place" — that was wrong; the prior `toFileURL` only normalized slashes. Corrected.

## Previous Task (DVR import + long MP4 playback)
- `electron/main.ts:385` — added `dvr`, `mkv`, `m4v` to import filter.
- `VideoFiles.tsx` — updated empty-state hint to mention dvr.
- `VideoPreview.tsx` — `preload="auto"` → `preload="metadata"` so long videos don't pre-buffer entire file.
- No size/duration limits existed in import or playback paths; nothing to remove.
- DVR playability depends on the actual container — Chromium handles MPEG-TS but not DVR-MS. Verification (manual test) will confirm per-file.

## What Was Completed (session 24)
1. **Removed Web Playback SDK** — `SpotifyPlayer.ts` no longer loads SDK script, creates Player object, or calls `init()`. All SDK-related code deleted.
2. **Web API control** — `SpotifyPlayerControls.ts` (new) handles all playback commands via `PUT/POST /v1/me/player/*`. No `device_id` required — plays on user's active Spotify device.
3. **Polling** — `SpotifyPlayer.ts` polls `GET /v1/me/player` every 2s when connected. State (track, position, isPlaying) flows through existing subscribe/listener pattern.
4. **WASAPI loopback** — `electron/audio-loopback.ts` (new) uses `naudiodon` `AudioIO` to capture system audio output as Float32 PCM. Streams chunks to renderer via `win.webContents.send('audio:pcm-data', ...)`.
5. **PCM routing** — INCOMPLETE / NOT IMPLEMENTED. `SpotifyPlayerAudio.ts` is still the silent oscillator stub from earlier sessions; `getUserMedia({chromeMediaSource:'desktop'})` crashed the renderer and a real WASAPI loopback was deferred until VS Build Tools are installed. The visualizer does **not** react to Spotify audio.
6. **IPC bridge** — `preload-cockpit.ts` exposes `startLoopback`, `stopLoopback`, `onAudioData` to renderer.
7. **Source switching** — `CockpitApp.tsx`: Spotify connect → starts loopback, `setActiveSource('spotify')`. MP3 load → stops loopback, `setActiveSource('mp3')`.
8. **castlabs removal** — `electron` dep changed to standard `^29.4.6`. `components.whenReady()` Widevine block removed from `main.ts`.
9. **UI updates** — `SpotifyBrowser` shows now-playing bar always (not behind `isReady` gate). `SpotifyNowPlaying` gains progress bar. Devices list shown if no active device.

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins + Spotify), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db — projects, project_state, media_library, settings tables
- Spotify: OAuth PKCE (hardcoded client ID, 127.0.0.1 redirect), Web API polling (no SDK), playlist browser, now-playing bar with progress. Visualizer audio loopback is NOT implemented — `SpotifyPlayerAudio.ts` is a silent stub.

## Spotify file map
| File | Purpose | Lines |
|------|---------|-------|
| `SpotifyPlayerTypes.ts` | Interfaces (SpotifyTrack, SpotifyPlaylist, SpotifyPlayerState) | 28 |
| `SpotifyPlayerAPI.ts` | fetchPlaylists, fetchPlaylistTracks | ~48 |
| `SpotifyPlayerControls.ts` | playTrackUri, pause/resume/next/prev, getDevices, getNowPlaying | ~70 |
| `SpotifyPlayerAudio.ts` | getDisplayMedia loopback → MediaStreamAudioSourceNode → AnalyserNode | ~85 |
| `SpotifyPlayer.ts` | Service class (polling, state, controls) | ~100 |
| `SpotifyNowPlaying.tsx` | Now-playing strip + progress bar | ~35 |
| `SpotifyTrackList.tsx` | Expandable track list | 44 |
| `SpotifyBrowser.tsx` | Main browser + devices list | ~115 |
| `electron/audio-loopback.ts` | Electron native displayMedia loopback IPC | ~14 |

## Git State
- Branch: main
- All changes are local only

## Up Next
- Manual test: start app → connect Spotify → verify Electron loopback starts → check visualizer reacts
