\# MHEU Priorities



\## Active Right Now

1\. Fix Studio wave editor — patch panel clipped/hidden, not editable

2\. Fix Butterchurn visualizer:

&#x20;  - Connect to app audio context so it reacts to music

&#x20;  - Fix black screen flash between preset transitions

&#x20;  - Make window draggable (titlebar or -webkit-app-region)

&#x20;  - Remove scrollbars, true fullscreen on any display



\## Token Efficiency Rules

\- Read CLAUDE.md and .claude/ memory files before every session

\- Do not speculatively read files. List directory contents only, then read only what you need.

\- Read minimum files before writing. Be surgical.

\- If a file isn't listed in the prompt, don't read it.



\## Coding Rules

\- One job per file

\- Max 150 lines per file (hard limit)

\- All numeric displays: editable text inputs with units

\- Tooltips on non-obvious controls

\- Never delete — always archive to src/archive/

\- File-per-plugin for all effects/plugins

\- No themes/colors until functionality is complete



\## Stack

\- Electron + React + Vite + TypeScript

\- Tone.js audio

\- SQLite

\- Butterchurn (visualizer)

\- LJV (2D oscilloscope, cockpit + studio)



\## Window Layout

\- Hub: splash/launcher

\- Cockpit: DJ, MP3 playback, decks

\- Studio: synthesis, patches, wave editor

\- Visualizer: Butterchurn fullscreen output



\## Aesthetic (apply after functionality)

\- Background: #010103

\- Borders: #7a0105

\- Gradient: #87150a → #eea91c

\- Oscilloscope lines: #27e0e1

\- Primary text: #eea91c

\- Secondary/label text: #87150a

\- Vibe: 80s Miami neon + vintage Audi amber instruments + sci-fi cockpit + JDM anime edge



\## Archive Locations

\- src/archive/visualizer-original/ — old visualizer

\- src/archive/oscilloscopes-original/ — old XY/XYZ scopes

