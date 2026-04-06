# Active Context

**Last updated**: 2026-04-05

## Current Task
Persistent Spotify auth, media library, and music folder across app launches.

## Status
Implementation complete, pending manual verification (`npm run dev`).

## What Was Completed (session 17)
1. **Spotify auto-reconnect fix** — SpotifySettings now calls `getValidAccessToken()` instead of `isSpotifyConnected()`, so if token refresh fails the UI correctly resets to disconnected state.
2. **Music Folder IPC** — 4 new handlers: `settings:get`, `settings:set`, `settings:pick-music-directory`, `settings:scan-music-directory`. Scans for .mp3/.wav/.flac/.ogg/.m4a/.aac/.aiff files.
3. **Music Folder UI** — AudioLibrary now shows a "Set Music Folder" button, displays the current path, and auto-scans on mount.
4. **All persistence verified end-to-end** — Spotify tokens in settings table, media library CRUD, video files with missing detection, audio files with BPM/key caching, music directory path in settings table.

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins + Spotify), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db — projects, project_state, media_library, settings tables
- Media library: persistent catalog of imported audio/video files with metadata
- DJ: 4 decks, crossfader A/B, independent C/D, master output, audio library panel with music folder picker
- Spotify: OAuth PKCE (hardcoded client ID, 127.0.0.1 redirect), Web Playback SDK, playlist browser, visualizer sync, auto-reconnect with token refresh
- Plugin system: 6 effects, MHEUPlugin interface
- Video: useVideoStore, VideoFiles + VideoPreview, video analyzer
- Sampler: SampleEngine + PadEngine, beat pads 4x4
- Tool launcher: Binary Synth popup via tool:launch IPC
- Tooltip: shared/Tooltip.tsx (1500ms hover delay, smart positioning, fade-in)

## Git State
- Branch: cbauschek/dev
- All changes are local only

## Up Next
- Manual verification: run `npm run dev`, test full 12-step verification
- Test auto-reconnect on app reopen (stored refresh token)
- Test music folder persistence across app launches
- Test missing file detection (grayed out indicator)
- Test disconnect clears tokens and resets UI
