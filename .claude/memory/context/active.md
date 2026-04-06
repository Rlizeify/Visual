# Active Context

**Last updated**: 2026-04-05

## Current Task
Spotify fixes — 0 tracks, SDK CSP, sort toggle, source indicator, audio routing — completed.

## Status
Complete. TypeScript clean (tsc --noEmit, no output).

## What Was Completed (session 21)
1. **CSP fix for Spotify SDK** — Added CSP meta tag to `index.html` explicitly whitelisting `https://sdk.scdn.co` in `script-src`. Without this, Electron/Chromium blocks the SDK from loading.
2. **Playlist track count** — Confirmed `p.tracks?.total` is the correct Spotify API path. Fixed to typed cast `(p.tracks?.total as number) ?? 0` for clarity.
3. **fetchPlaylistTracks** — Uses `limit=50` per spec; artist separator changed to ` / ` (was `, `).
4. **Sort toggle** — `SpotifyBrowser` now has A→Z / ORIG toggle button with `#eea91c` text, `#7a0105` border, `#010103` bg.
5. **Source indicator** — `.cockpit-source-indicator` color updated to `#eea91c` (was `#27e0e1`).
6. **Audio routing** — Extracted to `SpotifyPlayerAudio.ts`; uses MutationObserver + immediate check to find SDK's hidden `<audio>` element and route via `createMediaElementSource` → AnalyserNode.
7. **File splits** — All modified Spotify files now ≤150 lines. Created 5 new files.

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins + Spotify), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db — projects, project_state, media_library, settings tables
- Media library: persistent catalog of imported audio/video files with metadata
- DJ: 4 decks, crossfader A/B, independent C/D, master output, audio library panel with music folder picker
- Spotify: OAuth PKCE (hardcoded client ID, 127.0.0.1 redirect), Web Playback SDK (CSP fixed), playlist browser (sort toggle), visualizer sync via SpotifyPlayerAudio, auto-reconnect with token refresh
- Plugin system: 6 effects, MHEUPlugin interface
- Video: useVideoStore, VideoFiles + VideoPreview, video analyzer
- Sampler: SampleEngine + PadEngine, beat pads 4x4
- Tool launcher: Binary Synth popup via tool:launch IPC
- Tooltip: shared/Tooltip.tsx (1500ms hover delay, smart positioning, fade-in)

## Spotify file map
| File | Purpose | Lines |
|------|---------|-------|
| `SpotifyPlayerTypes.ts` | Interfaces (SpotifyTrack, SpotifyPlaylist, SpotifyPlayerState) | 35 |
| `SpotifyPlayerAPI.ts` | fetchPlaylists, fetchPlaylistTracks, playSpotifyUri | 66 |
| `SpotifyPlayerAudio.ts` | Audio routing (MediaElementSource → AnalyserNode) | 60 |
| `SpotifyPlayer.ts` | Service class (SDK, init, state, controls) | 136 |
| `SpotifyNowPlaying.tsx` | Now-playing strip | 31 |
| `SpotifyTrackList.tsx` | Expandable track list | 44 |
| `SpotifyBrowser.tsx` | Main browser + sort toggle | 125 |

## Git State
- Branch: cbauschek/dev
- All changes are local only

## Up Next
- Manual verification: run `npm run dev`, test Spotify SDK loads (check DevTools console for CSP errors)
- Test sort toggle A→Z / ORIG
- Test track list expansion + artist display with ` / ` separator
- Test source indicator shows `SOURCE: SPOTIFY` in #eea91c color
- Test audio routing (visualizer reacts to Spotify playback)
