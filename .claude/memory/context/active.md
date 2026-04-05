# Active Context

**Last updated**: 2026-04-05

## Current Task
Cockpit full layout rebuild — done.

## Status
Done. Build passes clean.

## Codebase Summary
- 4-window Electron app: Hub (launcher), Cockpit (controls), Display (Butterchurn visualizer), Studio (patch editor)
- Display window: `display-main.tsx` → `VisualizerApp.tsx` (Butterchurn WebGL presets)
- Audio: Tone.js MP3 playback + multi-oscillator synth, beat detection, effects chain
- Cross-window audio: cockpit sends waveform + beat data via IPC → display window feeds into ScriptProcessorNode → AnalyserNode → Butterchurn
- Aesthetic: Dark red (#7a0105) borders, hard edges, no border-radius, no box-shadow on panels
- State: React hooks + CustomEvents, no external state library
- Phase 1–2 complete, Phase 3 (Studio) in progress
- Plugin system: `src/plugins/` — MHEUPlugin interface, PluginChain host, PluginPanel/PluginRack UI, pluginRegistry
- Effects: `src/plugins/effects/` — Compressor, EQ (3-band), Delay, Reverb, Chorus, Distortion
- AudioEngine wires PluginChain between Tone.js chorus output and ctx.destination; exposes getPluginChain()

## New Cockpit Layout (as of 2026-04-05)
- Three-column layout: Left sidebar (PluginRack, 280px default, 180px min, resizable), Center (title + LJVScope + Oscilloscope, split), Right (0px, reserved for DJ decks)
- Bottom bar: LOAD FILE / PLAY / PAUSE / STOP / time / duration / MASTER VOL slider
- Dividers: 4px #7a0105, ew-resize (left) and ns-resize (center split)
- Archived: LeftPanel, RightPanel, Dial, ToggleSwitch → apps/desktop/src/archive/cockpit-left-panel/
- New: Oscilloscope.tsx (canvas + ResizeObserver + getByteTimeDomainData, ≤80 lines)
