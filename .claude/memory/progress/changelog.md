# Changelog

## 2026-04-05

### Fix: Butterchurn Visualizer (4 issues)
- **Audio reactivity**: cockpit now sends `Float32Array` time-domain data via IPC at 30fps alongside beat data. Display window feeds this into a `ScriptProcessorNode` → `AnalyserNode` → `visualizer.connectAudio()`. Files: `useAudioEngine.ts`, `main.ts`, `preload-display.ts`, `VisualizerApp.tsx`
- **Black screen between presets**: blend time changed from 2.0→2.5s; render loop never pauses during transitions
- **Window not draggable**: removed `frame: false` from `createDisplayWindow`; added 32px `-webkit-app-region: drag` div at top; canvas gets `-webkit-app-region: no-drag`
- **Scrollbars / fullscreen**: canvas is now `position: fixed, top:0, left:0, 100vw/100vh`; `display.html` gets `html,body { overflow:hidden; margin:0 }`; `createDisplayWindow` now uses `screen.getPrimaryDisplay().workAreaSize` for initial dimensions


## 2026-04-04

### Infrastructure Initialization
- Created `CLAUDE.md` at project root (63 lines)
- Created `.claude/AGENT.md` — operational behavior
- Created `.claude/SOUL.md` — communication style
- Created `.claude/memory/` directory tree with 6 subdirectories
- Seeded all index and tracking files

### Codebase Scan & Memory Population
- Full codebase analysis: architecture, components, audio system, state management, styles
- Populated `roadmap.md` with 4 phases, 11 milestones, ~40 tasks
- Populated `patterns/index.md` with 6 observed patterns
- Updated `priorities.md` with current priority stack
- Updated `active.md` with codebase summary
