# MHEU Roadmap

## Completed

- Electron + React + Vite + TypeScript scaffold
- Tone.js audio system
- SQLite integration
- Four windows: Hub (splash), Cockpit (DJ/MP3), Studio (synthesis/patches), Visualizer
- Butterchurn visualizer integrated + audio reactivity fix
- LJV oscilloscope integrated (2D, cockpit + studio)
- Archive system established (src/archive/)
- .claude/ memory and docs system
- Butterchurn: audio reactivity, preset transitions, drag, fullscreen — all fixed
- Color palette overhaul (#010103 bg, #7a0105 borders, gradient, etc.)
- Splash screen cleanup (icons removed, font fixed)
- Plugin/effects system: Compressor, EQ, Delay, Reverb, Chorus, Distortion
- Cockpit layout redesign: 2x2 grid, Butterchurn in-panel, plugin rack sidebar
- Additive synthesizer (Studio window)
- Display window folded into Cockpit (code commented out, Butterchurn in preview panel)
- Studio wave editor fix (patch panel no longer clipped)
- Video module: import, file list, preview player, metadata display (Cockpit grid)
- Sample editor: waveform display, loop points, pitch shift, reverse
- Beat pads: 4x4 grid, one-shot triggers, right-click assign, visual flash
- DJ decks: 4-deck mixer, crossfader A/B, independent C/D, hot cues, pitch faders
- Save/load system: SQLite persistence, themed in-app dialogs, Ctrl+S/O shortcuts
- Tool launcher: Hub "TOOLS" section, Binary Synth popup

## In Progress

*Nothing currently in progress.*

## Up Next (in order)

1. Installer packaging (tabled — only when explicitly requested)

## Deferred

- 3D oscilloscope (XY, XYZ) — archived, revisit later
- Web Audio Modules (WAM) plugin standard — revisit when effects modules expand
- noise-craft integration
- loop-drop-app integration

## Architecture Rules

- One job per file, max 150 lines per file
- All numeric displays are editable text inputs with units (Hz, %, dB, BPM, ms)
- Tooltips on everything non-obvious
- Never delete files — move to src/archive/
- File-per-plugin architecture for effects
