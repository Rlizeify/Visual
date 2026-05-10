# Active Context

**Last updated**: 2026-05-09

## Current State

**mheu.lol NOW SERVES CURRENT CODE**

Deployment successful:
- Bundle: `index-DPHBqcGX.js`
- Deployment ID: `dpl_6FCpVMVELWbvsjguNz2ymGhAyYYV`
- All env vars present except Discord OAuth

## What's Live on mheu.lol

All features confirmed in bundle and endpoints working:
- Username field on signup ✓
- Five score readouts (position/velocity/acceleration/jerk/snap) ✓
- Leaderboard + Activity Feed ✓
- Fullscreen + gear controls ✓
- Account page under E tab ✓
- Discord OAuth endpoint exists (needs env vars) ✓

## Remaining Manual Steps

1. **Discord env vars** — Add to Vercel project-iwmob:
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `DISCORD_REDIRECT_URI` = `https://mheu.lol/api/oauth?provider=discord&callback=true`

2. **Discord Developer Portal** — Update redirect URI to:
   `https://mheu.lol/api/oauth?provider=discord&callback=true`

3. **Supabase Dashboard** (per web/docs/supabase-auth-branding.md):
   - Set Site URL to `https://mheu.lol`
   - Add `https://mheu.lol/**` to Redirect URLs
   - Update email templates with MHEU branding

## What's Done

### Desktop (apps/desktop)
- Electron multi-window: Hub, Cockpit, Studio
- SQLite persistence for projects, media library, settings
- DJ 4-deck mixer with crossfader
- Video module with import, preview, analysis
- Plugin rack: Compressor, EQ, Delay, Reverb, Chorus, Distortion
- Additive synth + sample editor + beat pads
- Spotify OAuth with playlist browser (visualizer loopback via getDisplayMedia)

## Recent Work

### Connector System (2026-05-09)
Created modular data connector architecture at `web/api/scoring/connectors/`:
- `types.ts` — Contract interfaces (Connector, ConnectorField, TimeScale, SparsityClass)
- `index.ts` — Registry with auto-discovery pattern
- `spotify.ts` — Fully implemented (7 fields: listening_minutes, unique_artists, etc.)
- `discord.ts`, `mynetdiary.ts`, `applehealth.ts` — Stubs with inactive fields
- `web/docs/adding-a-connector.md` — Documentation with Strava example

Adding a new connector = 1 file + 1 import line. No changes to scoring engine, admin panel, or migrations.

## Up Next (Desktop Backlog)

1. **Fonts**: Implement fonts from `apps/desktop/fonts/` folder across the app (except MHEU title which has custom animation)
2. **Spotify token protection**: Ensure tokens are per-user, never in repo, never in installer
3. **Installer packaging**: Deferred until explicitly requested

## Git State

- Branch: `Desktop`
- Remote: `origin/Desktop` (up to date)
- Production: mheu.lol verified
