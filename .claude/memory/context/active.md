# Active Context

**Last updated**: 2026-04-07

## Current Task
Fix: Spotify API error surfacing + memory correction.

## Status
Complete.
- `SpotifyPlayerAPI.ts` — `fetchPlaylists()` and `fetchPlaylistTracks()` now `console.error` the status + statusText on non-OK responses before returning `[]`. Auth failures (401/403/429) are no longer silent.
- `SpotifyBrowser.tsx` — empty playlist state (when `isConnected`) now shows: "No playlists loaded. Check console for errors or try disconnecting and reconnecting Spotify."
- Corrected misleading session 24 entries below: SpotifyPlayerAudio.ts is **still the silent oscillator stub** — the PCM-dequeue rewrite never happened. Spotify visualizer loopback is **NOT IMPLEMENTED**.

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
| `SpotifyPlayerAudio.ts` | Silent OscillatorNode → AnalyserNode (real loopback deferred) | ~55 |
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
