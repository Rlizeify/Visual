# Active Context

**Last updated**: 2026-05-09

## Current State

**CRITICAL DEPLOYMENT ISSUE IDENTIFIED**

Two separate Vercel projects exist:
- `project-iwmob` → owns mheu.lol → serves **OLD CODE** (15h stale)
- `web` → owns preview URL → serves **NEW CODE** but has **NO ENV VARS**

All recent work is deploying to the wrong project. mheu.lol is not showing new features.

## Triage Result

| Issue | Root Cause | Resolution |
|-------|------------|------------|
| Signup missing username field | Deploy mismatch | Redeploy |
| Fullscreen/gear buttons broken | Deploy mismatch | Redeploy |
| No mic prompt | Deploy mismatch | Redeploy (gear menu triggers it) |
| Discord OAuth not present | Deploy mismatch | Redeploy |
| Five score readouts not showing | Deploy mismatch | Redeploy |
| No social feed | Deploy mismatch | Redeploy |
| Leaderboard empty | Deploy mismatch + possible data | Redeploy + verify data |
| Account page missing | Deploy mismatch | Redeploy |
| Default Supabase email | Supabase config | Dashboard change |
| Email redirects to localhost | Supabase config | Set Site URL to https://mheu.lol |

## Immediate Action Required

User must choose ONE of:
1. **Move mheu.lol domain** from project-iwmob to web project, then copy env vars
2. **Redeploy to project-iwmob** by relinking local directory

## What's Done (in code, not deployed to mheu.lol)

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
