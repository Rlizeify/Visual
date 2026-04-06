# Active Context

**Last updated**: 2026-04-05

## Current Task
Interactive tutorials for Cockpit and Studio windows.

## Status
Implementation complete, pending manual verification (`npm run dev`).

## What Was Completed (session 14)
1. **Settings table** — Added `settings` table to SQLite (key/value), with get/set/delete helpers
2. **Spotify OAuth PKCE** — Full flow in `spotify-auth.ts`: code verifier/challenge, temp HTTP server on :8888 for callback, token exchange/refresh, token persistence in SQLite
3. **IPC handlers** — 6 Spotify channels in main.ts + preload-cockpit.ts (get/set client ID, connect, disconnect, is-connected, get-access-token)
4. **SpotifyPlayer service** — Web Playback SDK loader, player init, audio routing (MediaElementSource → AnalyserNode → destination), playback controls, Web API calls, pub/sub state
5. **SpotifySettings panel** — Modal with Client ID input, Connect/Disconnect, green status dot
6. **SpotifyBrowser panel** — Playlist list, expand-to-tracks, now-playing bar with album art, play/pause/skip controls
7. **CockpitApp integration** — VIDEO/SPOTIFY tab bar in top-left panel, gear icon in bottom bar, "♫ Spotify" badge on visualizer, auto-reconnect on mount, analyser switching
8. **CSS** — ~350 lines: settings modal, tab bar, badge, browser, now-playing, controls, playlist/track lists

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins + Spotify), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db — projects, project_state, media_library, settings tables
- Media library: persistent catalog of imported audio/video files with metadata
- DJ: 4 decks, crossfader A/B, independent C/D, master output, audio library panel
- Spotify: OAuth PKCE, Web Playback SDK, playlist browser, visualizer sync
- Plugin system: 6 effects, MHEUPlugin interface
- Video: useVideoStore, VideoFiles + VideoPreview, video analyzer
- Sampler: SampleEngine + PadEngine, beat pads 4x4
- Tool launcher: Binary Synth popup via tool:launch IPC
- Tooltip: shared/Tooltip.tsx (1500ms hover delay, smart positioning, fade-in)

## Git State
- Branch: cbauschek/dev
- All changes are local only

## Up Next
- Manual verification with Spotify Premium account (12-step verification from spec)
- Test auto-reconnect on app reopen (stored refresh token)
- Test visualizer reacts to Spotify audio
- Test DJ decks remain independent while Spotify plays
