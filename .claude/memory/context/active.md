# Active Context

**Last updated**: 2026-04-05

## Current Task
Full Cockpit redesign — complete.

## Status
Done. TypeScript + Vite build passes clean.

## Codebase Summary
- 4-window Electron app: Hub (launcher), Cockpit (controls), Display (Butterchurn — separate window, archived), Studio (patch editor)
- Audio: Tone.js MP3 playback + multi-oscillator synth, beat detection, effects chain
- Cross-window audio: cockpit sends waveform + beat data via IPC → display window
- Aesthetic: Dark red (#7a0105) borders, hard edges, no border-radius, no box-shadow on panels
- State: React hooks + CustomEvents, no external state library
- Phase 1–2 complete, Phase 3 (Studio) in progress
- Plugin system: `src/plugins/` — MHEUPlugin interface, PluginChain host, PluginPanel/PluginRack UI, pluginRegistry

## Cockpit Layout (as of 2026-04-05 — this redesign)
- Two-column: Left sidebar (PluginRack, 240px fixed), Main area (2×2 grid)
- 2×2 grid: VIDEO FILES (TL), VIDEO PREVIEW (TR), VisualizerControls (BL), VisualizerPreview/Butterchurn (BR)
- Bottom bar: 48px, full width — LOAD FILE / PLAY / PAUSE / STOP / time / duration / MASTER VOL / WaveformSlider
- No resize dividers — left sidebar is fixed 240px
- Grid gaps: 1px solid #7a0105 (via CSS gap + background)
- No border-radius anywhere in Cockpit

## Plugin Rack (as of this redesign)
- Auto-preloads all 6 on mount: Compressor, EQ, Delay, Reverb, Chorus, Distortion
- Each starts bypassed + collapsed
- ADD PLUGIN button hidden when all 6 loaded
- AudioEngine no longer manually adds plugins to chain (removed from constructor)
- Collapsed state lifted from PluginPanel into PluginRack

## New Components
- `src/components/cockpit/VisualizerPreview.tsx` — Butterchurn canvas in-panel, fullscreen button on hover, 30s cycle
- `src/components/cockpit/VisualizerControls.tsx` — preset selector + reactivity/blend/cycle sliders
- `src/components/cockpit/WaveformSlider.tsx` — waveform canvas + transparent range input overlay

## Hub Splash
- VISUALIZER button removed — only COCKPIT and STUDIO

## Archive
- `src/archive/display-window-original/` — Display/Butterchurn window (VisualizerApp, DisplayApp, Visualizer)
