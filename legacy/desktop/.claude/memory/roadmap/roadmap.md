# MHEU Roadmap

## Completed

* Electron + React + Vite + TypeScript scaffold
* Tone.js audio system
* SQLite integration
* Four windows: Hub (splash), Cockpit (DJ/MP3), Studio (synthesis/patches), Visualizer
* Butterchurn visualizer integrated + audio reactivity fix
* LJV oscilloscope integrated (2D, cockpit + studio)
* Archive system established (src/archive/)
* .claude/ memory and docs system
* Butterchurn: audio reactivity, preset transitions, drag, fullscreen — all fixed
* Color palette overhaul (#010103 bg, #7a0105 borders, gradient, etc.)
* Splash screen cleanup (icons removed, font fixed)
* Plugin/effects system: Compressor, EQ, Delay, Reverb, Chorus, Distortion
* Cockpit layout redesign: 2x2 grid, Butterchurn in-panel, plugin rack sidebar
* Additive synthesizer (Studio window)
* Display window folded into Cockpit (code commented out, Butterchurn in preview panel)
* Studio wave editor fix (patch panel no longer clipped)
* Video module: import, file list, preview player, metadata display (Cockpit grid)
* Sample editor: waveform display, loop points, pitch shift, reverse
* Beat pads: 4x4 grid, one-shot triggers, right-click assign, visual flash
* DJ decks: 4-deck mixer, crossfader A/B, independent C/D, hot cues, pitch faders
* Save/load system: SQLite persistence, themed in-app dialogs, Ctrl+S/O shortcuts
* Tool launcher: Hub "TOOLS" section, Binary Synth popup

## In Progress

*Nothing currently in progress.*

## Up Next (in order)

1. There is a font folder now located at Visual-main\\apps\\desktop\\fonts. On the title screen "MHEU" Has a custom font and animation that is not to be touched. Everywhere else we're going to use the fonts in this folder that need to be implemented.
2. We are going to add Spotify token protection for personal accounts between GitHub and installers. 

   1. The DB gets wiped on fresh install, and tokens never ship in the repo. That's already half the solution. The other half is making sure the OAuth tokens are stored in a location that is:
   2. 
   3. Per-user on the machine (Electron's app.getPath('userData') already does this — it writes to C:\\Users\\{username}\\AppData\\Roaming\\visual-desktop\\ which is never in the repo)
   4. Never included in any installer package you build
   5. 
   6. So the actual solution is:
   7. 
   8. Gitignore the DB (tokens never hit GitHub — your friends clone a clean repo)
   9. Installer excludes userData (anyone who downloads an installer gets no pre-baked tokens)
   10. First-time Spotify use prompts OAuth — not a full app gate, just a "Connect Spotify" flow inside the Spotify tab if no token exists
   11. Disconnect clears the token so the next person on that machine starts fresh
   12. 
   13. No server needed. No allowlist. Scales to public distribution. Your client ID is safe to ship — it just lets people do the OAuth dance with their own Spotify account.
3. Installer packaging (tabled — only when explicitly requested)

## Deferred

* 3D oscilloscope (XY, XYZ) — archived, revisit later
* Web Audio Modules (WAM) plugin standard — revisit when effects modules expand
* noise-craft integration
* loop-drop-app integration

## Architecture Rules

* One job per file, max 150 lines per file
* All numeric displays are editable text inputs with units (Hz, %, dB, BPM, ms)
* Tooltips on everything non-obvious
* Never delete files — move to src/archive/
* File-per-plugin architecture for effects

