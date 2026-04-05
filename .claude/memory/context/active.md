# Active Context

**Last updated**: 2026-04-05

## Current Task
Plugin architecture foundation — done.

## Status
Done. Ready for next task. Plugin system wired; no concrete plugins registered yet.

## Codebase Summary
- 4-window Electron app: Hub (launcher), Cockpit (controls), Display (Butterchurn visualizer), Studio (patch editor)
- Display window: `display-main.tsx` → `VisualizerApp.tsx` (Butterchurn WebGL presets)
- Audio: Tone.js MP3 playback + multi-oscillator synth, beat detection, effects chain
- Cross-window audio: cockpit sends waveform + beat data via IPC → display window feeds into ScriptProcessorNode → AnalyserNode → Butterchurn
- Aesthetic: Neon 80s (Orbitron font, glow effects, CRT scanlines)
- State: React hooks + CustomEvents, no external state library
- Phase 1–2 complete, Phase 3 (Studio) in progress
- Plugin system: `src/plugins/` — MHEUPlugin interface, PluginChain host, PluginPanel UI, PluginRack UI, pluginRegistry
