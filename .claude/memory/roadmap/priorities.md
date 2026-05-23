# MHEU Priorities

## Active Right Now

1. DJ deck — 4 decks, crossfader, hot cues
2. Save/load system — serialize all feature state via SQLite

## Coding Rules

- One job per file
- No line limit on code files (only .md files cap at 200 lines)
- All numeric displays: editable text inputs with units
- Tooltips on non-obvious controls
- Archive retired working features to src/archive/; delete dead/bad code
- File-per-plugin for all effects/plugins
- No themes/colors until functionality is complete

## Stack

- Electron + React + Vite + TypeScript
- Tone.js audio
- SQLite
- Butterchurn (visualizer)
- LJV (2D oscilloscope, cockpit + studio)

## Window Layout

- Hub: splash/launcher
- Cockpit: DJ, MP3 playback, decks, video module, Butterchurn preview, plugin rack
- Studio: synthesis (additive synth), sample editor, beat pads
- Visualizer: code commented out — Butterchurn runs inside Cockpit

## Aesthetic (apply after functionality)

- Background: #010103
- Borders: #7a0105
- Gradient: #87150a -> #eea91c
- Oscilloscope lines: #27e0e1
- Primary text: #eea91c
- Secondary/label text: #87150a
- Vibe: 80s Miami neon + vintage Audi amber instruments + sci-fi cockpit + JDM anime edge

## Archive Locations

- src/archive/visualizer-original/ — old visualizer
- src/archive/oscilloscopes-original/ — old XY/XYZ scopes
- src/archive/display-window-original/ — old display/Butterchurn window
- src/archive/cockpit-left-panel/ — old left panel with dials
