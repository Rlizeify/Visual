# Active Context

**Last updated**: 2026-04-05

## Current Task
Studio synth/sampler fixes + XY oscilloscope — complete.

## Status
Done. TypeScript compiles clean (only pre-existing DJDecks type error).

## What Was Completed (session 11)
1. **Additive synth initial layer fix** — Reset `prevLayerIdsRef` in engine init effect so the pre-loaded layer gets properly added to the audio graph on mount (was broken under React strict mode re-mount).
2. **Sample editor loop toggle fix** — `SampleEngine.setLoop()` now updates the live `sourceNode.loop` property mid-playback instead of only updating state.
3. **Sample editor reverse+stop fix** — Added guard in `source.onended` callback to only clear `this.sourceNode` if it's still the active source, preventing stale callbacks from clobbering the new node reference.
4. **Sampler button cleanup** — Consolidated transport: Load | Play/Pause toggle | Stop in one row, filename moved after buttons.
5. **Additive synth narrowed** — Panel now takes ~65% width, freeing right side for oscilloscope.
6. **XY Oscilloscope** — New `XYScope.tsx`: Lissajous pattern (left=X, right=Y), 1:1 aspect ratio canvas, fade trail, connected to additive synth analyser.
7. **Function synth** — New `FunctionSynth.tsx`: text input for `f(x,y,z)` math expressions, x/y/z = 220/330/440 Hz generators, ScriptProcessorNode output routed through additive synth chain, play/stop toggle, red border on invalid input.

## Codebase Summary
- Multi-window: Hub (launcher + tools + tutorial), Cockpit (DJ + video + viz + plugins), Studio (synth + sampler)
- Persistence: SQLite at userData/visual.db, project:save/load/list/delete IPC
- DJ: 4 decks, crossfader A/B, independent C/D, master output
- Plugin system: 6 effects, MHEUPlugin interface
- Video: useVideoStore, VideoFiles + VideoPreview
- Sampler: SampleEngine + PadEngine, beat pads 4x4
- Tool launcher: Binary Synth popup via tool:launch IPC
- Tooltip: shared/Tooltip.tsx (1500ms hover delay, smart positioning, fade-in)
- Tutorial: hub/HubTutorial.tsx (5-step walkthrough, SVG mask highlighting)
- Aesthetic: Dark red borders, hard edges, no border-radius, no box-shadow

## Git State
- Branch: cbauschek/dev
- All changes are local only

## Up Next
- Cockpit and Studio tutorials (future prompts)
- Verification: run `npm run dev`, test all 10 verification steps
