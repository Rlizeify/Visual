# Changelog

## 2026-04-05 (sessions 8-9 — cbauschek/dev branch)

### Feat: 4-deck DJ mixer in Cockpit
- `dj/DeckEngine.ts`: Per-deck audio graph (AudioBufferSourceNode -> GainNode), play/pause/stop/seek, cue/hot cues, pitch/volume
- `dj/DeckWaveform.tsx`: Canvas waveform with downsampled peaks, position indicator, click-to-seek
- `dj/DeckChannel.tsx`: Single deck UI — load (file input), waveform, play/pause, cue, 4 hot cues, pitch/volume faders
- `dj/DJDecks.tsx`: 4-deck container, crossfader A/B (complementary GainNodes), C/D direct to master, master volume
- `dj/djState.ts`: DJState interface, getDJState()/setDJState(), exposed on window for console
- `CockpitApp.tsx`: Layout restructured to CSS grid — sidebar spans all rows, 2x2 grid row 1, DJ strip row 2 (280px), bottom bar row 3
- `cockpit.css`: Added .cockpit-layout grid rules + ~200 lines DJ styles

### Feat: SQLite save/load with themed in-app dialogs
- `electron/database.ts`: SQLite init at userData/visual.db, WAL mode, projects + project_state tables, CRUD functions
- `hooks/useProjectPersistence.ts`: Shared hook — quick save, save as, load, delete, Ctrl+S/Shift+S/O shortcuts, status text
- `cockpitStateCollector.ts`: Collect/restore DJ decks, UI state, plugins via register pattern
- `studioStateCollector.ts`: Collect/restore session, sampler, beat pads via register pattern
- `shared/SaveDialog.tsx`: Dark overlay, project name input, themed buttons
- `shared/LoadDialog.tsx`: Project list, select, inline delete confirm
- `global.css`: Dialog styles, save flash, project status indicator
- `main.ts`: 4 IPC handlers (project:save/load/list/delete) + better-sqlite3 import
- `preload-cockpit.ts` + `preload-studio.ts`: Added projectSave/Load/List/Delete bridges
- `CockpitApp.tsx`: Registered UI state, persistence hook, dialogs, status in bottom bar
- `StudioApp.tsx`: Registered studio state, replaced native save, dialogs, status in bottom bar

TypeScript: clean.

## 2026-04-05 (session 7 — cbauschek/dev branch)

### Feat: Open-source tool launcher — popup windows from Hub
- `vendor/binary-synth/`: Cloned + pre-built MaxAlyokhin/binary-synth (MIT license, single-file 453KB HTML audio synth)
- `main.ts`: Added `toolRegistry` map, `vendorPath()` helper, `tool:launch` IPC handler with BrowserWindow creation, `toolWindows` Map for tracking + cleanup on Hub close
- `preload-hub.ts`: Exposed `launchTool(toolName)` via contextBridge
- `HubApp.tsx`: Added "TOOLS" section below main buttons with "BINARY SYNTH" button (cyan accent), new `toolsSection`/`toolsLabel` styles

## 2026-04-05 (session 6 — cbauschek/dev branch)

### Fix: Studio wave editor — patch panel no longer clipped
- `studio.css` (`.studio-main-canvas`): Changed to flex-direction column, align-items/justify-content stretch, overflow hidden
- `StudioApp.tsx`: Removed redundant inline flex styles; changed additive synth container from `flex: 0 0 45%` to `flex: 1 1 45%`; overflow hidden → auto; added minHeight 0 to both children

### Feat: Video module — import, preview, metadata (Cockpit grid)
- `useVideoStore.ts` (60 lines): pub/sub shared state for video file list + selection
- `VideoFiles.tsx` (80 lines): IMPORT button via IPC file dialog, scrollable file list (name, resolution, duration, size), click to select, X to remove
- `VideoPreview.tsx` (116 lines): HTML5 video player, play/pause/seek, metadata row (RES, FPS, CODEC, FRAME counter)
- `main.ts`: added `import-video` IPC handler (file dialog + file stats)
- `preload-cockpit.ts`: exposed `importVideo()` via contextBridge
- `CockpitApp.tsx`: replaced placeholder panels with VideoFiles + VideoPreview
- `cockpit.css`: ~180 lines added for video panels (design system colors)

### Feat: Sample editor + beat pads (Studio window)
- `SampleEngine.ts`: Web Audio — load, play/stop, loop, pitch shift (playbackRate), reverse, start/end offsets
- `PadEngine.ts`: 16 pad slots, one-shot triggers via AudioBufferSourceNode, volume/pitch per slot
- `SampleWaveform.tsx`: canvas waveform with draggable start/end markers, dimmed out-of-range regions
- `SampleControls.tsx`: load/play/stop, loop/reverse toggles, editable inputs (st, ms units)
- `SampleEditor.tsx`: container wiring SampleEngine to waveform + controls
- `BeatPads.tsx`: 4x4 grid, click to fire, right-click to assign sample, visual flash on trigger
- `main.ts`: added `studio:open-sample-dialog` + `studio:read-audio-file` IPC handlers
- `preload-studio.ts`: exposed `openSampleDialog()` + `readAudioFile()` via contextBridge
- `StudioApp.tsx`: added SYNTH/SAMPLER tab bar
- `studio.css`: styles for tab bar, sample editor, waveform, controls, beat pad grid

TypeScript: clean across all changes.

## 2026-04-05 (session 5)

### Fix: Plugin rack layout — constrained sidebar, clean panel rows

- `PluginRack.tsx`: 260px fixed width, height 100%, overflow hidden, header flex-shrink 0, chain div (flex 1, overflow-y auto, overflow-x hidden) scrolls independently via onWheel stopPropagation; removed reorder arrows and remove button from slot JSX.
- `PluginPanel.tsx`: width 100% box-sizing border-box, overflow hidden; 40px header height; 8px L/R padding; 4px param gap; label on own line above slider row; number input 52px; param-controls flex with min-width 0 on slider.
- `CockpitApp.tsx`: left sidebar hard-walled at 260px (width/min-width/max-width 260, overflow hidden, position relative).
- TypeScript: clean. Vite build: clean. Committed + pushed (`a4afc7f`).

## 2026-04-05 (session 4)

### Chore: Comment out Display window launch at startup

- `apps/desktop/electron/main.ts`: commented out (not deleted) `createDisplayWindow()` function definition, its call inside `hub:open-cockpit`, the `hub:open-visualizer` handler, the F11 fullscreen shortcut, and five IPC handlers that exclusively served the display window (`visualizer:beat-data`, `visualizer:dial-data`, `visualizer:waveform-data`, `push-to-display`, `display:fullscreen`).
- Each commented block prefixed with: `// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel`
- TypeScript: clean. Vite build: clean. Committed + pushed (`f8c323b`).

## 2026-04-05 (session 3)

### Feat: Full Cockpit layout redesign (8 steps)

**STEP 1 — Archive**: Copied display/Butterchurn window to `src/archive/display-window-original/` (VisualizerApp, DisplayApp, Visualizer). Original files untouched.

**STEP 2 — Main layout**: Rebuilt `CockpitApp.tsx` from scratch — two-column (sidebar + 2x2 grid). Manages shared visualizer state (selectedPreset, blendTime, cycleSpeed, reactivity values).

**STEP 3 — Butterchurn preview**: New `VisualizerPreview.tsx` — Butterchurn canvas fills bottom-right panel, connects to cockpit AnalyserNode, 30s cycle, 2.5s blend, ResizeObserver, fullscreen button on hover via Fullscreen API.

**STEP 4 — Visualizer controls**: New `VisualizerControls.tsx` — preset selector (all butterchurn-presets), bass/mid/high reactivity sliders 0-100, blend time 1-10s, cycle speed 10-120s; all wired to props passed from CockpitApp.

**STEP 5 — Waveform volume slider**: New `WaveformSlider.tsx` — canvas + transparent range input overlay; waveform amplitude scaled by volume; gradient #87150a->#eea91c; bottom bar right section.

**STEP 6 — Plugin rack preload**: `PluginRack.tsx` auto-loads all 6 plugins on mount (Compressor->EQ->Delay->Reverb->Chorus->Distortion), each bypassed + collapsed; ADD PLUGIN hidden when 6 loaded. `PluginPanel.tsx`: collapsed state lifted to PluginRack (controlled prop). `AudioEngine.ts`: removed manual addPlugin calls from constructor; kept side-effect imports for registration.

**STEP 7 — Hub splash**: Removed VISUALIZER button and `openVisualizer` callback from `HubApp.tsx`. Hub now shows only COCKPIT and STUDIO.

**STEP 8 — Borders/cleanup**: Set border-radius: 0 on plugin-rack, plugin-panel, bypass button, add-btn, dropdown, number input. Added `.cockpit-main` (2x2 grid), `.cockpit-panel`, `.cockpit-panel__title` to cockpit.css. Bottom bar height 56px -> 48px. Removed resize dividers (no more .cockpit-divider). Plugin rack overflow: hidden -> visible for wheel scrolling.

TypeScript: clean. Vite build: clean.

## 2026-04-05 (session 2)

### Feat: Cockpit layout rebuild
- Archived LeftPanel, RightPanel, Dial, ToggleSwitch -> `apps/desktop/src/archive/cockpit-left-panel/`
- New `Oscilloscope.tsx`: canvas + ResizeObserver, clearRect every frame, getByteTimeDomainData, stroke #27e0e1 1.5px, max 80 lines
- Rebuilt `CockpitApp.tsx`: three-column layout (left=PluginRack 280px, center=LJVScope+Oscilloscope, right=0px), bottom bar (LOAD/PLAY/PAUSE/STOP/time/vol)
- Resizable dividers: left sidebar (ew-resize, min 180px), center split (ns-resize, min 80px each)
- Rewrote `cockpit.css`: new layout classes, no border-radius, no box-shadow on panels, all borders 1px solid #7a0105, panel bg #010103, bottom bar bg #0a0a0a

## 2026-04-05

### Feat: Reverb, Chorus, Distortion plugins
- `effects/Reverb.ts`: ConvolverNode with OfflineAudioContext-generated impulse response (white noise x exponential decay); roomSize, decay, wet, dry params; bypass sets wet=0/dry=1; rebuilds impulse async on roomSize/decay change
- `effects/Chorus.ts`: DelayNode (20ms fixed center) + OscillatorNode LFO -> depthGain -> delay.delayTime; rate, depth (ms), wet, dry params; LFO started in constructor
- `effects/Distortion.ts`: WaveShaperNode with sigmoid soft-clip curve (4x oversample) + BiquadFilter highpass for tone + output GainNode; amount, tone, output, wet, dry params; Float32Array cast to `Float32Array<ArrayBuffer>` for TS strict compat
- `pluginRegistry.ts`: three side-effect imports added so all new plugins self-register on load

### Feat: Collapse/expand for PluginPanel and PluginRack
- `PluginPanel.tsx`: `collapsed` state (default false); header row fixed at 36px; toggle button shows/hides params section; BYPASS still always visible
- `PluginRack.tsx`: `rackCollapsed` state (default false); toggle in rack header; collapses the entire chain + ADD PLUGIN footer; unit count hidden when collapsed

### Feat: Compressor, EQ, Delay effects + Cockpit plugin rack wiring
- `effects/Compressor.ts`: DynamicsCompressorNode; 5 params (threshold, ratio, attack, release, knee); bypass routes around compressor via GainNode passthrough
- `effects/EQ.ts`: 3 BiquadFilterNodes in series (lowshelf, peaking, highshelf); 7 params; bypass routes around all filters
- `effects/Delay.ts`: DelayNode + feedback GainNode loop + wet/dry GainNodes; 4 params; bypass sets wet=0/dry=1 without disconnecting nodes
- All three self-register in pluginRegistry on import
- `AudioEngine.ts`: disconnects Tone chorus from Tone.getDestination(), inserts PluginChain between chorus and ctx.destination; exposes `getPluginChain()`
- `CockpitApp.tsx`: imports PluginRack + audioEngine singleton; renders `<PluginRack>` between cockpit-body and BottomBar
- `cockpit.css`: grid-template-rows updated from `52px 1fr 52px` to `52px 1fr auto 52px` to accommodate rack row

### Feat: Plugin architecture foundation (src/plugins/)
- `MHEUPlugin.ts`: interface + `ParamDescriptor` type + `MHEUPluginConstructor` type
- `PluginChain.ts`: class that owns an ordered plugin array; `addPlugin/removePlugin/movePlugin/setBypass`; rewires Web Audio connections on every mutation; bypassed plugins are routed around
- `PluginPanel.tsx`: generic React UI — reads `getParams()`, renders label + number input + range slider per param, BYPASS toggle; uses app CSS vars only
- `PluginRack.tsx`: rack container — PluginPanel list, up/down reorder arrows, remove button, ADD PLUGIN dropdown from registry; state stays in sync with PluginChain
- `pluginRegistry.ts`: Map-based registry; `registerPlugin / getRegisteredPlugins`; WAM adapter will also register here

### Fix: Hub splash screen button cleanup
- Removed icons from all three HubButtons; kept text labels only
- Changed `.hub-btn` font-family from `'SD Glitch'` to `'Inter', sans-serif`

### Feat: Cockpit color palette retheme
- Replaced old neon 80s palette with dark-red/gold scheme
- `cockpit.css`: full rewrite of CSS variables and hardcoded colors

### Feat: Additive Synthesizer Panel (Studio window)
- OscillatorLayer.tsx, SynthEngine.ts, WaveformDisplay.tsx, ExportButton.tsx, AdditiveSynth.tsx

### Fix: Butterchurn Visualizer (4 issues)
- Audio reactivity, black screen between presets, window not draggable, scrollbars/fullscreen

## 2026-04-04

### Infrastructure Initialization
- Created CLAUDE.md, .claude/AGENT.md, .claude/SOUL.md, memory directory tree
- Full codebase scan and memory population
