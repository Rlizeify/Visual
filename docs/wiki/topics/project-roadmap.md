---
topic: Project Roadmap & Priorities
last_compiled: 2026-04-07
status: active
---

# Project Roadmap & Priorities

## Summary [coverage: high — 4 sources]

Visual is a multi-window Electron desktop synthesizer with real-time audio visualization. The bulk of feature work — Electron/React/Vite scaffold, Tone.js audio, SQLite, four-then-three-window architecture, Butterchurn, LJV oscilloscope, plugin/effects system, Cockpit redesign, additive synth, sampler, beat pads, DJ decks, save/load, Spotify, tutorials — is complete. Nothing is currently in progress as of 2026-04-06. The next priority is implementing Hitmarker fonts everywhere except the untouchable MHEU title. After that, Spotify token protection for personal accounts between GitHub and installers. Installer packaging is tabled until explicitly requested. Architecture rules are strict: one job per file, max 150 lines per file, never delete (always archive), file-per-plugin, all numeric displays editable with units, tooltips on non-obvious controls.

## Architecture & Components [coverage: high — 4 sources]

The roadmap covers the entire stack:

- **Electron + React + Vite + TypeScript** scaffold (complete)
- **Tone.js** audio system (complete)
- **SQLite** persistence (complete)
- **Three windows**: Hub (splash + tools + tutorial), Cockpit (DJ + MP3 + visualizer + plugins + Spotify + video), Studio (synth + sampler + beat pads). The fourth — Visualizer/Display — has been folded into Cockpit (code commented out, archived to `src/archive/display-window-original/`).
- **Butterchurn** visualizer integrated with audio reactivity, preset transitions, drag, fullscreen
- **LJV oscilloscope** integrated (2D, in both Cockpit and Studio)
- **Archive system**: `src/archive/visualizer-original/`, `oscilloscopes-original/`, `display-window-original/`, `cockpit-left-panel/`
- **`.claude/`** memory and docs system

## Decisions & Rationale [coverage: high — 4 sources]

**Architecture Rules (hard constraints):**
- One job per file
- Max 150 lines per file (hard limit)
- All numeric displays: editable text inputs with units (Hz, %, dB, BPM, ms)
- Tooltips on non-obvious controls
- Never delete files — always move to `src/archive/`
- File-per-plugin architecture for effects
- No themes/colors until functionality is complete

**Aesthetic (apply after functionality):**
- Background `#010103`, borders `#7a0105`, gradient `#87150a → #eea91c`
- Oscilloscope lines `#27e0e1`, primary text `#eea91c`, secondary text `#87150a`
- Vibe: 80s Miami neon + vintage Audi amber instruments + sci-fi cockpit + JDM anime edge

**Deferred items:**
- 3D oscilloscope (XY, XYZ) — archived, revisit later
- Web Audio Modules (WAM) plugin standard — revisit when effects expand
- noise-craft integration
- loop-drop-app integration
- Installer packaging — tabled until explicitly requested

## Patterns & Gotchas [coverage: medium — 2 sources]

- **Active priority right now (per `priorities.md`):** DJ deck (4 decks, crossfader, hot cues — done) and Save/load system (serialize all feature state via SQLite — done). The priorities file lags behind the changelog.
- **Up Next ordering (per `roadmap.md`):** Fonts → Spotify token protection → Installer.
- **Spotify token protection plan:** DB gitignored (tokens never hit GitHub). Installer excludes `userData/`. First-time Spotify use prompts OAuth. Disconnect clears the token. No server, no allowlist, scales to public distribution. Client ID is safe to ship — it just lets users do the OAuth dance with their own account.

## History & Changelog [coverage: high — 4 sources]

**Completed milestones (per `roadmap.md`):**
- Electron + React + Vite + TypeScript scaffold
- Tone.js audio system
- SQLite integration
- Four windows → three (Display folded into Cockpit)
- Butterchurn integrated + audio reactivity fix + preset transitions + drag + fullscreen
- LJV oscilloscope integrated
- Archive system established
- `.claude/` memory and docs system
- Color palette overhaul (dark red + amber + teal)
- Splash screen cleanup
- Plugin/effects system (Compressor, EQ, Delay, Reverb, Chorus, Distortion)
- Cockpit layout redesign (2x2 grid, Butterchurn in panel, plugin rack sidebar)
- Additive synthesizer (Studio)
- Studio wave editor patch panel fix
- Video module (import, file list, preview player, metadata)
- Sample editor (waveform, loop, pitch shift, reverse)
- Beat pads (4×4)
- DJ decks (4-deck mixer, crossfader, hot cues, pitch faders)
- Save/load system (SQLite, themed dialogs, Ctrl+S/O)
- Tool launcher (Hub TOOLS section, Binary Synth)

## Open Threads [coverage: high — 4 sources]

**In Progress:** Nothing currently in progress.

**Up Next (in order, per `roadmap.md`):**
1. **Hitmarker fonts.** Font folder at `apps/desktop/fonts/18082023_Hitmarker/`. Implement everywhere except the MHEU title (which has a custom font and animation that must not be touched).
2. **Spotify token protection** for personal accounts between GitHub and installers. Plan: gitignore DB, installer excludes `userData/`, first-time OAuth prompt inside Spotify tab if no token exists, disconnect clears token. Per-user, per-machine, no server.
3. **Installer packaging** — tabled, only when explicitly requested.

**Active Right Now (per `priorities.md`, slightly stale):**
1. DJ deck — 4 decks, crossfader, hot cues (already complete)
2. Save/load system — serialize all feature state via SQLite (already complete)

**Blockers:** None.

**Deferred:** 3D oscilloscope, WAM, noise-craft, loop-drop-app.

## Sources

- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/roadmap/priorities]]
- [[../../../.claude/memory/progress/blockers]]
- [[../../../.claude/memory/progress/changelog]]
