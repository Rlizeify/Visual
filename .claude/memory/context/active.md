# Active Context

**Last updated**: 2026-04-05

## Current Task
Responsive layout cleanup — Cockpit and Studio at all window sizes.

## Status
Edits complete, pending manual verification at target resolutions.

## What Was Completed (session 12)
1. **Cockpit sidebar** — Removed hardcoded inline styles (width/minWidth/maxWidth) from CockpitApp.tsx. Width now driven by PluginRack CSS (260px open, 36px collapsed via transition).
2. **PluginRack collapse** — Added `plugin-rack--collapsed` class that shrinks rack to 36px and hides title text. Grid `auto 1fr` column naturally reclaims space for main content.
3. **DJ waveform** — Reduced from 60px to 48px, changed from flex-shrink:0 to flex-shrink:1 with min-height:32px so it can compress at small windows.
4. **DJ vertical fader** — Reduced from 80px to 50px to fit in minmax(180px,280px) DJ strip.
5. **Deck FX panel** — Changed from `bottom:100%` (above deck, clipped by overflow:hidden) to `top:0` overlay inside deck with max-height:100%.
6. **Studio frame** — Added `box-sizing: border-box` to prevent 100vw + padding overflow.
7. **Studio patch slots** — Changed from `width:260px` to `width:100%` to fill sidebar column.
8. **Additive synth layers** — Changed from `flexShrink:0` to `flex: 0 1 auto` so layers scroll instead of pushing waveform off-screen.
9. **Studio overflow** — Changed additive synth and beat pads containers from `overflow:auto` to `overflow:hidden` to prevent scrollbars.
10. **cockpit-left** — Added `position: relative` to CSS class.

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db, project:save/load/list/delete IPC
- DJ: 4 decks, crossfader A/B, independent C/D, master output
- Plugin system: 6 effects, MHEUPlugin interface
- Video: useVideoStore, VideoFiles + VideoPreview
- Sampler: SampleEngine + PadEngine, beat pads 4x4
- Tool launcher: Binary Synth popup via tool:launch IPC
- Tooltip: shared/Tooltip.tsx (1500ms hover delay, smart positioning, fade-in)

## Git State
- Branch: cbauschek/dev
- All changes are local only

## Up Next
- Manual verification at 1200x700, 1440x900, 1920x1080, 1280x720
- Run `npm run dev` and test all verification steps
