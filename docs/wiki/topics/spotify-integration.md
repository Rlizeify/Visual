---
topic: Spotify Integration
last_compiled: 2026-04-07
status: active
---

# Spotify Integration

## Summary [coverage: high — 4 sources]

Spotify is integrated into Cockpit as a parallel audio source to MP3 playback. Authentication is OAuth 2.0 PKCE with a hardcoded client ID and `127.0.0.1` redirect (not `localhost`), via a temp HTTP server bound to `127.0.0.1`. Tokens are persisted in SQLite (plaintext, in `userData/visual.db`). As of session 24 (2026-04-06), the **Web Playback SDK has been removed entirely** because it requires Widevine/EME and a castlabs Electron build. It is replaced by Spotify Web API polling (`GET /v1/me/player` every 2 seconds) for playback state and Web API commands (`PUT/POST /v1/me/player/*`) for control — playing on the user's existing active Spotify device. The earlier naudiodon WASAPI approach was abandoned; on 2026-04-07 its references were removed from `apps/desktop/package.json` (`postinstall` and `rebuild:native`) because installs were repeatedly trying to rebuild a module that wasn't in `node_modules`. **Visualizer audio reactivity to Spotify is NOT implemented.** `electron/audio-loopback.ts` provides an Electron native `setDisplayMediaRequestHandler({ audio: 'loopback' })` IPC hook and `preload-cockpit.ts` exposes `startLoopback`/`stopLoopback`/`onAudioData`, but `SpotifyPlayerAudio.ts` is still a silent `OscillatorNode → AnalyserNode` stub from session 25 — the PCM-dequeue rewrite planned in session 24 was never landed. The visualizer does not react to Spotify audio. On 2026-04-07, `SpotifyPlayerAPI.ts` was updated to `console.error` status + statusText on non-OK responses so auth failures (401/403/429) are no longer silent, and `SpotifyBrowser.tsx` now surfaces an explicit empty-playlist hint telling the user to check the console.

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
| `electron/audio-loopback.ts` | Electron native `setDisplayMediaRequestHandler({ audio: 'loopback' })` IPC | ~14 |
| `electron/spotify-auth.ts` | OAuth PKCE flow, temp HTTP server, token store, scope invalidation |  |
| `components/cockpit/SpotifySettings.tsx` | Inline `SpotifyConnect` pill |  |

IPC bridge in `preload-cockpit.ts` exposes `startLoopback`, `stopLoopback`, `onAudioData`, plus all `spotify*` methods (connect, disconnect, get-access-token, get-user-profile). `CockpitApp.tsx` switches `activeSource` between `'spotify'` and `'mp3'` and starts/stops loopback accordingly.

## Decisions & Rationale [coverage: high — 5 sources]

- **Surface API errors, never fail silently (2026-04-07).** `fetchPlaylists()` and `fetchPlaylistTracks()` now `console.error` `response.status` + `statusText` before returning `[]`, and `SpotifyBrowser`'s empty state (when `isConnected`) tells the user: "No playlists loaded. Check console for errors or try disconnecting and reconnecting Spotify." The previous behavior silently swallowed 401/403/429 responses, which made token/scope/rate-limit issues undiagnosable from the UI.
- **Drop naudiodon in favor of Electron native loopback hook (2026-04-07).** naudiodon required MSVC Build Tools and a native compile step, and kept failing rebuild attempts during install. Electron 29's `setDisplayMediaRequestHandler({ audio: 'loopback' })` captures system audio output with no native dependency. naudiodon was removed from `package.json` `postinstall` and `rebuild:native` on 2026-04-07; `better-sqlite3` rebuild remains. Note: only the main-process plumbing is in place — the renderer-side PCM consumption was never written, so visualizer reactivity is still unwired.
- **Drop Web Playback SDK entirely (session 24, 2026-04-06).** SDK requires Widevine CDM via castlabs `electron-releases`. Replaced with Web API polling + system-audio loopback. Standard `electron@^29.4.6` restored.
- **Hardcode client ID, use `127.0.0.1` redirect (session 16, 2026-04-05).** One-click login. `localhost` was changed to `127.0.0.1` because the Spotify dashboard now requires it. Temp HTTP server bound explicitly to `127.0.0.1`.
- **Decouple "has token" from "SDK ready" (session 20, 2026-04-05).** Added `markTokenValid(hasToken: boolean)` so `isConnected` is set without waiting for SDK. The browser then renders as soon as a token exists. (Now obsolete with SDK removed but the decoupling pattern remains.)
- **Scope invalidation on startup (session 23).** `checkAndInvalidateScopeChange()` stores current scope string in DB and clears tokens on startup if scope changed. Prevents stale tokens from causing silent 403s. Required scopes: `playlist-read-collaborative`, `user-read-playback-state`, `user-modify-playback-state`.
- **Token security model (planned).** DB gitignored; installer excludes `userData`; first-time use prompts OAuth. Per-user, per-machine, no server, scales to public distribution. Disconnect clears the token.

## Patterns & Gotchas [coverage: high — 5 sources]

- **Silent `[]` from `fetchPlaylists` = auth/scope/rate-limit failure.** The function now logs `response.status` + `statusText` — check the console before assuming an empty account. Don't treat an empty return as "no data".
- **`SpotifyPlayerAudio.ts` is still a silent stub.** It contains an `OscillatorNode` at gain=0 → `AnalyserNode`. No PCM dequeue. The visualizer sees silence when Spotify is the active source. Don't claim in docs or commit messages that the loopback is "wired through to the visualizer" — the plumbing is partial.
- **403s on play/pause/skip = missing scopes.** Always include the playback-control scopes.
- **Auto-reconnect race.** `SpotifyPlayer.markTokenValid(true)` must be called *before* `init()` so `SpotifyBrowser` sees `isConnected` immediately.
- **`fetchPlaylistTracks` uses `limit=50` per API spec.** Earlier "0 tracks" bug was a defensive `(p.tracks?.total as number) ?? 0` typing issue.
- **Artist separator is ` / ` not `, `.** Applied in both API and (formerly) SDK paths.
- **Audio routing must extract to its own module.** `SpotifyPlayerAudio.ts` exists because the audio graph needs to be a singleton independent of React lifecycle.
- **CSP gotcha (now obsolete).** SDK previously needed `https://sdk.scdn.co` in `script-src`. With SDK removed, this can stay or go.
- **Promise rejection on hub autoplay.** Use `audio.play().catch(() => {})` not `try/catch` — the rejection from "play() interrupted by pause()" is async (session 25).

## History & Changelog [coverage: high — 10 sources]

- **2026-04-07 (fix)** — `SpotifyPlayerAPI.ts` logs status + statusText on non-OK responses before returning `[]`. `SpotifyBrowser.tsx` empty state (when `isConnected`) now tells the user to check the console or disconnect/reconnect. Also: memory corrected — `SpotifyPlayerAudio.ts` is still the silent oscillator stub, visualizer loopback is NOT implemented. Prior session-24 notes claiming a PCM-dequeue rewrite were wrong.
- **2026-04-07 (infra)** — Removed `naudiodon` from `apps/desktop/package.json` `postinstall` and `rebuild:native`. `electron/audio-loopback.ts` uses Electron's native `setDisplayMediaRequestHandler({ audio: 'loopback' })`. No native module compile required. Renderer-side consumption remains unimplemented.
- **2026-04-06 (session 25)** — Silent oscillator fallback for renderer crash; hub autoplay Promise rejection silenced.
- **2026-04-06 (session 24)** — System-audio loopback + Web API control. SDK removed. Standard Electron 29.4.6 restored. Now-playing bar always shown. Devices list shown if no active device. Progress bar added. (naudiodon was the initial loopback implementation; superseded 2026-04-07 by Electron native.)
- **2026-04-06 (session 23)** — Widevine `components.whenReady()` API + Spotify scope refresh + scope invalidation.
- **2026-04-06 (session 22)** — Widevine CDM registration + CSP `worker-src` for Tone.js AudioWorklet + `allowRunningInsecureContent: false`.
- **2026-04-05 (session 21)** — 0 tracks fix, `/` separator, SDK CSP, sort toggle, source indicator, audio routing extracted. SpotifyPlayer split into Types/API/Audio/Player files (150-line limit). SpotifyBrowser split into NowPlaying/TrackList.
- **2026-04-05 (session 20)** — `markTokenValid()` decouples connection from SDK ready. `activeSource` state added. Cockpit source indicator added.
- **2026-04-05 (session 17)** — `SpotifySettings` auto-reconnect race fixed (use `getAccessToken` not `isConnected`).
- **2026-04-05 (session 16)** — One-click OAuth: hardcoded client ID, `127.0.0.1` redirect, `getSpotifyUserProfile()` for display name. Settings modal removed in favor of inline pill.
- **2026-04-05 (session 14)** — Initial Spotify integration: full PKCE, `settings` table, 6 IPC handlers, SDK loader, playlist browser, now-playing bar.

## Open Threads [coverage: medium — 2 sources]

- **Implement renderer-side loopback consumption.** Main-process IPC and `startLoopback`/`stopLoopback`/`onAudioData` bridges exist. `SpotifyPlayerAudio.ts` needs to be rewritten from the silent oscillator stub into a `ScriptProcessorNode` (or `AudioWorklet`) that pulls PCM chunks from the IPC queue and feeds the `AnalyserNode`. Until that lands, the visualizer does not react when Spotify is the active source.
- Manual test after the above: connect Spotify → verify loopback starts → visualizer reacts.
- Implement token security model: gitignore DB, exclude `userData` from installer, OAuth prompt on first use.

## Sources

- [[../../../.claude/memory/context/active]]
- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/patterns/index]]
- [[../../../.claude/memory/roadmap/roadmap]]
