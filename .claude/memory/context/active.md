# Active Context

**Last updated**: 2026-05-09

## Current State

Web app fully wired to Supabase. Production verified at mheu.lol.

**Desktop app backlog is the next focus area.**

## What's Done

### Web (mheu.lol)
- Supabase auth with Spotify OAuth
- Three production tables: `users`, `user_scores`, `visualizer_presets`
- Admin dashboard with 6 tabs: Users, Passwords, OAuth, Life Scores, Leaderboard, Presets
- Competition page wired to live `/api/scores` endpoint
- Butterchurn visualizer with fullscreen + gear controls
- Groovy wave background on pre-auth pages
- All production endpoints tested and operational

### Desktop (apps/desktop)
- Electron multi-window: Hub, Cockpit, Studio
- SQLite persistence for projects, media library, settings
- DJ 4-deck mixer with crossfader
- Video module with import, preview, analysis
- Plugin rack: Compressor, EQ, Delay, Reverb, Chorus, Distortion
- Additive synth + sample editor + beat pads
- Spotify OAuth with playlist browser (visualizer loopback via getDisplayMedia)

## Up Next (Desktop Backlog)

1. **Fonts**: Implement fonts from `apps/desktop/fonts/` folder across the app (except MHEU title which has custom animation)
2. **Spotify token protection**: Ensure tokens are per-user, never in repo, never in installer
3. **Installer packaging**: Deferred until explicitly requested

## Git State

- Branch: `Desktop`
- Remote: `origin/Desktop` (up to date)
- Production: mheu.lol verified
