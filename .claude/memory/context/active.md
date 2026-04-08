# Active Context

**Last updated**: 2026-04-07

## Current Task
Infra cleanup: dropped stale naudiodon references from build scripts.

## Status
Complete. `apps/desktop/package.json` no longer lists naudiodon in `postinstall` / `rebuild:native`. System audio loopback is handled by Electron's native `setDisplayMediaRequestHandler({ audio: 'loopback' })` in `apps/desktop/electron/audio-loopback.ts` — no native module compile required.

## What Was Completed (session 24)
1. **Removed Web Playback SDK** — `SpotifyPlayer.ts` no longer loads SDK script, creates Player object, or calls `init()`. All SDK-related code deleted.
2. **Web API control** — `SpotifyPlayerControls.ts` (new) handles all playback commands via `PUT/POST /v1/me/player/*`. No `device_id` required — plays on user's active Spotify device.
3. **Polling** — `SpotifyPlayer.ts` polls `GET /v1/me/player` every 2s when connected. State (track, position, isPlaying) flows through existing subscribe/listener pattern.
4. **WASAPI loopback** — `electron/audio-loopback.ts` (new) uses `naudiodon` `AudioIO` to capture system audio output as Float32 PCM. Streams chunks to renderer via `win.webContents.send('audio:pcm-data', ...)`.
5. **PCM routing** — `SpotifyPlayerAudio.ts` rewritten: `ScriptProcessorNode` dequeues PCM chunks into Web Audio graph → AnalyserNode → visualizer reacts to Spotify audio.
6. **IPC bridge** — `preload-cockpit.ts` exposes `startLoopback`, `stopLoopback`, `onAudioData` to renderer.
7. **Source switching** — `CockpitApp.tsx`: Spotify connect → starts loopback, `setActiveSource('spotify')`. MP3 load → stops loopback, `setActiveSource('mp3')`.
8. **castlabs removal** — `electron` dep changed to standard `^29.4.6`. `components.whenReady()` Widevine block removed from `main.ts`.
9. **UI updates** — `SpotifyBrowser` shows now-playing bar always (not behind `isReady` gate). `SpotifyNowPlaying` gains progress bar. Devices list shown if no active device.

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins + Spotify), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db — projects, project_state, media_library, settings tables
- Spotify: OAuth PKCE (hardcoded client ID, 127.0.0.1 redirect), Web API polling (no SDK), WASAPI loopback via naudiodon, playlist browser, now-playing bar with progress

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
