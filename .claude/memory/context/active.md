# Active Context

**Last updated**: 2026-04-05

## Current Task
DJ decks + save/load system — complete.

## Status
Done. TypeScript compiles clean.

## What Was Completed (sessions 8-9)
1. **DJ Decks** — 4-deck mixer in Cockpit: DeckEngine, DeckChannel, DeckWaveform, DJDecks. A/B through crossfader, C/D independent. getDJState()/setDJState() for console + persistence.
2. **Save/Load System** — SQLite via better-sqlite3. database.ts (CRUD), useProjectPersistence (shared hook), state collectors (cockpit + studio), SaveDialog + LoadDialog (themed), Ctrl+S/Shift+S/O shortcuts, status indicator in bottom bars.

## Codebase Summary
- Multi-window: Hub (launcher + tools), Cockpit (DJ + video + viz + plugins), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db, project:save/load/list/delete IPC
- DJ: 4 decks, crossfader A/B, independent C/D, master output
- Plugin system: 6 effects, MHEUPlugin interface
- Video: useVideoStore, VideoFiles + VideoPreview
- Sampler: SampleEngine + PadEngine, beat pads 4x4
- Tool launcher: Binary Synth popup via tool:launch IPC
- Aesthetic: Dark red borders, hard edges, no border-radius, no box-shadow

## Git State
- Branch: cbauschek/dev (not yet pushed)
- Based on origin/main at commit 8553576
- All changes are local only

## Up Next
1. DJ deck (4 decks, crossfader, hot cues)
2. Save/load system
