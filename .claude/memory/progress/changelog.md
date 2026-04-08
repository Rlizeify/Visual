# Changelog

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
