---
topic: Spotify Integration
last_compiled: 2026-04-07
status: active
---

# Spotify Integration

## Summary [coverage: high — 4 sources]

Spotify is integrated into Cockpit as a parallel audio source to MP3 playback. Authentication is OAuth 2.0 PKCE with a hardcoded client ID and `127.0.0.1` redirect (not `localhost`), via a temp HTTP server bound to `127.0.0.1`. Tokens are persisted in SQLite (plaintext, in `userData/visual.db`). As of session 24 (2026-04-06), the **Web Playback SDK has been removed entirely** because it requires Widevine/EME and a castlabs Electron build. It is replaced by Spotify Web API polling (`GET /v1/me/player` every 2 seconds) for playback state and Web API commands (`PUT/POST /v1/me/player/*`) for control — playing on the user's existing active Spotify device. System audio is captured via WASAPI loopback (`naudiodon` `AudioIO` in `electron/audio-loopback.ts`) and streamed as Float32 PCM chunks to the renderer, where a `ScriptProcessorNode` dequeues them into the Web Audio graph so the visualizer reacts to Spotify audio. As of session 25, real WASAPI loopback is deferred behind a silent OscillatorNode fallback until naudiodon's native module is compiled with Visual Studio Build Tools.

## Architecture & Components [coverage: high — 4 sources]

Spotify file map:

| File | Purpose | Lines |
|------|---------|-------|
| `audio/SpotifyPlayerTypes.ts` | Interfaces (SpotifyTrack, SpotifyPlaylist, SpotifyPlayerState) | 28 |
| `audio/SpotifyPlayerAPI.ts` | `fetchPlaylists`, `fetchPlaylistTracks` | ~48 |
| `audio/SpotifyPlayerControls.ts` | `playTrackUri`, pause/resume/next/prev, `getDevices`, `getNowPlaying` | ~70 |
| `audio/SpotifyPlayerAudio.ts` | Silent OscillatorNode → AnalyserNode (real loopback deferred) | ~55 |
| `audio/SpotifyPlayer.ts` | Service class (polling, state, controls) | ~100 |
| `components/cockpit/SpotifyNowPlaying.tsx` | Now-playing strip + progress bar | ~35 |
| `components/cockpit/SpotifyTrackList.tsx` | Expandable track list | 44 |
| `components/cockpit/SpotifyBrowser.tsx` | Main browser + devices list | ~115 |
| `electron/audio-loopback.ts` | naudiodon WASAPI loopback IPC | ~65 |
| `electron/spotify-auth.ts` | OAuth PKCE flow, temp HTTP server, token store, scope invalidation |  |
| `components/cockpit/SpotifySettings.tsx` | Inline `SpotifyConnect` pill |  |

IPC bridge in `preload-cockpit.ts` exposes `startLoopback`, `stopLoopback`, `onAudioData`, plus all `spotify*` methods (connect, disconnect, get-access-token, get-user-profile). `CockpitApp.tsx` switches `activeSource` between `'spotify'` and `'mp3'` and starts/stops loopback accordingly.

## Decisions & Rationale [coverage: high — 5 sources]

- **Drop Web Playback SDK entirely (session 24, 2026-04-06).** SDK requires Widevine CDM via castlabs `electron-releases`. Replaced with Web API polling + WASAPI loopback. Standard `electron@^29.4.6` restored. `naudiodon@^2.0.1` added.
- **Hardcode client ID, use `127.0.0.1` redirect (session 16, 2026-04-05).** One-click login. `localhost` was changed to `127.0.0.1` because the Spotify dashboard now requires it. Temp HTTP server bound explicitly to `127.0.0.1`.
- **Decouple "has token" from "SDK ready" (session 20, 2026-04-05).** Added `markTokenValid(hasToken: boolean)` so `isConnected` is set without waiting for SDK. The browser then renders as soon as a token exists. (Now obsolete with SDK removed but the decoupling pattern remains.)
- **Scope invalidation on startup (session 23).** `checkAndInvalidateScopeChange()` stores current scope string in DB and clears tokens on startup if scope changed. Prevents stale tokens from causing silent 403s. Required scopes: `playlist-read-collaborative`, `user-read-playback-state`, `user-modify-playback-state`.
- **Token security model (planned).** DB gitignored; installer excludes `userData`; first-time use prompts OAuth. Per-user, per-machine, no server, scales to public distribution. Disconnect clears the token.

## Patterns & Gotchas [coverage: high — 5 sources]

- **403s on play/pause/skip = missing scopes.** Always include the playback-control scopes.
- **Auto-reconnect race.** `SpotifyPlayer.markTokenValid(true)` must be called *before* `init()` so `SpotifyBrowser` sees `isConnected` immediately.
- **`fetchPlaylistTracks` uses `limit=50` per API spec.** Earlier "0 tracks" bug was a defensive `(p.tracks?.total as number) ?? 0` typing issue.
- **Artist separator is ` / ` not `, `.** Applied in both API and (formerly) SDK paths.
- **Audio routing must extract to its own module.** `SpotifyPlayerAudio.ts` exists because the audio graph needs to be a singleton independent of React lifecycle.
- **CSP gotcha (now obsolete).** SDK previously needed `https://sdk.scdn.co` in `script-src`. With SDK removed, this can stay or go.
- **Promise rejection on hub autoplay.** Use `audio.play().catch(() => {})` not `try/catch` — the rejection from "play() interrupted by pause()" is async (session 25).

## History & Changelog [coverage: high — 9 sources]

- **2026-04-06 (session 25)** — Silent oscillator fallback for renderer crash; hub autoplay Promise rejection silenced.
- **2026-04-06 (session 24)** — WASAPI loopback + Web API control. SDK removed. Standard Electron 29.4.6 restored. naudiodon added. Now-playing bar always shown. Devices list shown if no active device. Progress bar added.
- **2026-04-06 (session 23)** — Widevine `components.whenReady()` API + Spotify scope refresh + scope invalidation.
- **2026-04-06 (session 22)** — Widevine CDM registration + CSP `worker-src` for Tone.js AudioWorklet + `allowRunningInsecureContent: false`.
- **2026-04-05 (session 21)** — 0 tracks fix, `/` separator, SDK CSP, sort toggle, source indicator, audio routing extracted. SpotifyPlayer split into Types/API/Audio/Player files (150-line limit). SpotifyBrowser split into NowPlaying/TrackList.
- **2026-04-05 (session 20)** — `markTokenValid()` decouples connection from SDK ready. `activeSource` state added. Cockpit source indicator added.
- **2026-04-05 (session 17)** — `SpotifySettings` auto-reconnect race fixed (use `getAccessToken` not `isConnected`).
- **2026-04-05 (session 16)** — One-click OAuth: hardcoded client ID, `127.0.0.1` redirect, `getSpotifyUserProfile()` for display name. Settings modal removed in favor of inline pill.
- **2026-04-05 (session 14)** — Initial Spotify integration: full PKCE, `settings` table, 6 IPC handlers, SDK loader, playlist browser, now-playing bar.

## Open Threads [coverage: medium — 2 sources]

- Install Visual Studio Build Tools so naudiodon can compile.
- Run `npm run rebuild:native` after MSVC tools installed.
- Verify visualizer reacts to Spotify audio after real loopback comes online.
- Tune `hostApi` index or enumerate devices manually if WASAPI loopback device detection fails.
- Implement token security model: gitignore DB, exclude `userData` from installer, OAuth prompt on first use.

## Sources

- [[../../../.claude/memory/context/active]]
- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/patterns/index]]
- [[../../../.claude/memory/roadmap/roadmap]]
