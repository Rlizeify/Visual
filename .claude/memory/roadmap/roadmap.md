\# MHEU Roadmap



\## Completed

\- Electron + React + Vite + TypeScript scaffold

\- Tone.js audio system

\- SQLite integration

\- Four windows: Hub (splash), Cockpit (DJ/MP3), Studio (synthesis/patches), Visualizer

\- Butterchurn visualizer integrated (needs audio reactivity fix)

\- LJV oscilloscope integrated (2D, cockpit + studio)

\- Archive system established (src/archive/)

\- .claude/ memory and docs system



\## In Progress

\- Butterchurn audio reactivity (not reacting to music yet)

\- Butterchurn window: black screen between presets, no drag, scrollbars

\- Studio wave editor: patch edit panel hidden/clipped under another element



\## Up Next (in order)

1\. Fix Butterchurn: audio reactivity, preset transition black flash, window draggable, no scrollbars

2\. Fix Studio wave editor: patch panel visible and usable

3\. Color palette overhaul: #010103 bg, #7a0105 borders, #87150a→#eea91c gradient, #27e0e1 osc, #eea91c text

4\. Splash screen: remove icons from buttons, fix font

5\. Video module: import system, then analysis/metadata

6\. DJ deck: 4 decks, crossfader, hot cues

7\. Plugin/effects modules: one file each — compressor, EQ, delay first

8\. Save/load system

9\. Sample editor + beat pads

10\. Installer packaging



\## Deferred

\- 3D oscilloscope (XY, XYZ) — archived, revisit later

\- Web Audio Modules (WAM) plugin standard — revisit when effects modules begin

\- noise-craft integration

\- loop-drop-app integration



\## Architecture Rules

\- One job per file, max 150 lines per file

\- All numeric displays are editable text inputs with units (Hz, %, dB, BPM, ms)

\- Tooltips on everything non-obvious

\- Never delete files — move to src/archive/

\- File-per-plugin architecture for effects

