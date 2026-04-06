# Active Context

**Last updated**: 2026-04-05

## Current Task
Spotify OAuth — one-click login, hardcoded client ID, fix redirect URI.

## Status
Implementation complete, pending manual verification (`npm run dev`).

## What Was Completed (session 16)
1. **Hardcoded Client ID** — Removed user-facing Client ID input. `SPOTIFY_CLIENT_ID` constant in spotify-auth.ts.
2. **Fixed redirect URI** — Changed from `localhost` to `127.0.0.1:8888`. Server binds to `127.0.0.1` explicitly.
3. **Simplified connect UI** — Green pill "Connect to Spotify" button (#1DB954) replaces settings modal. Connected state shows green dot + display name. Disconnect button.
4. **Removed dead code** — No more get/set client-id IPC, no settings modal overlay, no gear button.
5. **User profile fetch** — New `getSpotifyUserProfile()` in main process, exposed via IPC for display name.

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins + Spotify), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db — projects, project_state, media_library, settings tables
- Media library: persistent catalog of imported audio/video files with metadata
- DJ: 4 decks, crossfader A/B, independent C/D, master output, audio library panel
- Spotify: OAuth PKCE (hardcoded client ID, 127.0.0.1 redirect), Web Playback SDK, playlist browser, visualizer sync
- Plugin system: 6 effects, MHEUPlugin interface
- Video: useVideoStore, VideoFiles + VideoPreview, video analyzer
- Sampler: SampleEngine + PadEngine, beat pads 4x4
- Tool launcher: Binary Synth popup via tool:launch IPC
- Tooltip: shared/Tooltip.tsx (1500ms hover delay, smart positioning, fade-in)

## Git State
- Branch: cbauschek/dev
- All changes are local only

## Up Next
- Manual verification: run `npm run dev`, test full OAuth flow per 12-step verification
- Test auto-reconnect on app reopen (stored refresh token)
- Test disconnect clears tokens and resets UI
- Test visualizer reacts to Spotify audio
