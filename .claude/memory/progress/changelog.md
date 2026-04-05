# Changelog

## 2026-04-05 (session 3)

### Feat: Full Cockpit layout redesign (8 steps)

**STEP 1 — Archive**: Copied display/Butterchurn window to `src/archive/display-window-original/` (VisualizerApp, DisplayApp, Visualizer). Original files untouched.

**STEP 2 — Main layout**: Rebuilt `CockpitApp.tsx` from scratch — two-column (sidebar + 2×2 grid). Manages shared visualizer state (selectedPreset, blendTime, cycleSpeed, reactivity values).

**STEP 3 — Butterchurn preview**: New `VisualizerPreview.tsx` — Butterchurn canvas fills bottom-right panel, connects to cockpit AnalyserNode, 30s cycle, 2.5s blend, ResizeObserver, fullscreen button on hover via Fullscreen API.

**STEP 4 — Visualizer controls**: New `VisualizerControls.tsx` — preset selector (all butterchurn-presets), bass/mid/high reactivity sliders 0–100, blend time 1–10s, cycle speed 10–120s; all wired to props passed from CockpitApp.

**STEP 5 — Waveform volume slider**: New `WaveformSlider.tsx` — canvas + transparent range input overlay; waveform amplitude scaled by volume; gradient #87150a→#eea91c; bottom bar right section.

**STEP 6 — Plugin rack preload**: `PluginRack.tsx` auto-loads all 6 plugins on mount (Compressor→EQ→Delay→Reverb→Chorus→Distortion), each bypassed + collapsed; ADD PLUGIN hidden when 6 loaded. `PluginPanel.tsx`: collapsed state lifted to PluginRack (controlled prop). `AudioEngine.ts`: removed manual addPlugin calls from constructor; kept side-effect imports for registration.

**STEP 7 — Hub splash**: Removed VISUALIZER button and `openVisualizer` callback from `HubApp.tsx`. Hub now shows only COCKPIT and STUDIO.

**STEP 8 — Borders/cleanup**: Set border-radius: 0 on plugin-rack, plugin-panel, bypass button, add-btn, dropdown, number input. Added `.cockpit-main` (2×2 grid), `.cockpit-panel`, `.cockpit-panel__title` to cockpit.css. Bottom bar height 56px → 48px. Removed resize dividers (no more .cockpit-divider). Plugin rack overflow: hidden → visible for wheel scrolling.

TypeScript: clean. Vite build: clean.

## 2026-04-05 (session 2)

### Feat: Cockpit layout rebuild
- Archived LeftPanel, RightPanel, Dial, ToggleSwitch → `apps/desktop/src/archive/cockpit-left-panel/`
- New `Oscilloscope.tsx`: canvas + ResizeObserver, clearRect every frame, getByteTimeDomainData, stroke #27e0e1 1.5px, max 80 lines
- Rebuilt `CockpitApp.tsx`: three-column layout (left=PluginRack 280px, center=LJVScope+Oscilloscope, right=0px), bottom bar (LOAD/PLAY/PAUSE/STOP/time/vol)
- Resizable dividers: left sidebar (ew-resize, min 180px), center split (ns-resize, min 80px each)
- Rewrote `cockpit.css`: new layout classes, no border-radius, no box-shadow on panels, all borders 1px solid #7a0105, panel bg #010103, bottom bar bg #0a0a0a

## 2026-04-05

### Feat: Reverb, Chorus, Distortion plugins
- `effects/Reverb.ts`: ConvolverNode with OfflineAudioContext-generated impulse response (white noise × exponential decay); roomSize, decay, wet, dry params; bypass sets wet=0/dry=1; rebuilds impulse async on roomSize/decay change
- `effects/Chorus.ts`: DelayNode (20ms fixed center) + OscillatorNode LFO → depthGain → delay.delayTime; rate, depth (ms), wet, dry params; LFO started in constructor
- `effects/Distortion.ts`: WaveShaperNode with sigmoid soft-clip curve (4x oversample) + BiquadFilter highpass for tone + output GainNode; amount, tone, output, wet, dry params; Float32Array cast to `Float32Array<ArrayBuffer>` for TS strict compat
- `pluginRegistry.ts`: three side-effect imports added so all new plugins self-register on load

### Feat: Collapse/expand for PluginPanel and PluginRack
- `PluginPanel.tsx`: `collapsed` state (default false); header row fixed at 36px; ▼/▶ toggle button shows/hides params section; BYPASS still always visible
- `PluginRack.tsx`: `rackCollapsed` state (default false); ▼/▶ toggle in rack header; collapses the entire chain + ADD PLUGIN footer; unit count hidden when collapsed



### Feat: Compressor, EQ, Delay effects + Cockpit plugin rack wiring
- `effects/Compressor.ts`: DynamicsCompressorNode; 5 params (threshold, ratio, attack, release, knee); bypass routes around compressor via GainNode passthrough
- `effects/EQ.ts`: 3 BiquadFilterNodes in series (lowshelf, peaking, highshelf); 7 params; bypass routes around all filters
- `effects/Delay.ts`: DelayNode + feedback GainNode loop + wet/dry GainNodes; 4 params; bypass sets wet=0/dry=1 without disconnecting nodes
- All three self-register in pluginRegistry on import
- `AudioEngine.ts`: disconnects Tone chorus from Tone.getDestination(), inserts PluginChain between chorus and ctx.destination; exposes `getPluginChain()`
- `CockpitApp.tsx`: imports PluginRack + audioEngine singleton; renders `<PluginRack>` between cockpit-body and BottomBar
- `cockpit.css`: grid-template-rows updated from `52px 1fr 52px` to `52px 1fr auto 52px` to accommodate rack row

### Feat: Plugin architecture foundation (src/plugins/)
- `MHEUPlugin.ts`: interface + `ParamDescriptor` type + `MHEUPluginConstructor` type — the full contract
- `PluginChain.ts`: class that owns an ordered plugin array; `addPlugin/removePlugin/movePlugin/setBypass`; rewires Web Audio connections on every mutation; bypassed plugins are routed around
- `PluginPanel.tsx`: generic React UI — reads `getParams()`, renders label + number input + range slider per param, BYPASS toggle; uses app CSS vars only
- `PluginRack.tsx`: rack container — PluginPanel list, up/down reorder arrows, remove button, ADD PLUGIN dropdown from registry; state stays in sync with PluginChain
- `pluginRegistry.ts`: Map-based registry; `registerPlugin / getRegisteredPlugins`; WAM adapter will also register here
- `.claude/settings.json`: created project-level settings with `allow: [Edit(*), Write(*), Bash(*)]` to prevent MD permission prompts



### Fix: Hub splash screen button cleanup
- Removed icons (unicode chars ✈ ♪ ◉) from all three HubButtons; kept text labels only
- Changed `.hub-btn` font-family from `'SD Glitch'` to `'Inter', sans-serif` — SD Glitch is now title/logo only
- No layout, color, or spacing changes; only `HubApp.tsx` touched

### Feat: Cockpit color palette retheme
- Replaced old neon 80s palette (amber/blue/pink) with dark-red/gold scheme
- Palette: bg `#010103`, borders `#7a0105`, gradient `#87150a → #eea91c`, data lines `#27e0e1`, primary text `#eea91c`, labels `#87150a`
- `cockpit.css`: full rewrite — CSS variable overrides on `.cockpit-frame` (non-breaking for other windows), all hardcoded hex/rgba values updated, body bg override, night-mode section updated
- `WaveformPanel.tsx`: canvas grid/datum/waveform colors, SVG wave-shape stroke, chip inline styles
- `Dial.tsx`: SVG face/needle/tick/gradient colors
- `CockpitApp.tsx`: LJVScope color + glowColor props
- No layout, sizing, or other window changes

### Feat: Additive Synthesizer Panel (Studio window)
- Replaced `WaveformPanel` wave editor slot in Studio with fully functional additive synth
- `OscillatorLayer.tsx`: per-row controls — waveform type (4 buttons), frequency (number input/Hz), gain (slider), detune (number input/cents), on/off toggle, remove button
- `SynthEngine.ts`: Web Audio API class — addLayer/updateLayer/removeLayer/startAll/stopAll, master GainNode → AnalyserNode → destination, max 6 layers; oscillators recreated on stopAll so they can restart
- `WaveformDisplay.tsx`: rAF canvas, time-domain Float32Array from AnalyserNode, ResizeObserver fills container
- `ExportButton.tsx`: OfflineAudioContext 4s render at 44100Hz, manual 16-bit PCM WAV encoding, blob download
- `AdditiveSynth.tsx`: container; syncs engine via useEffect diff (add/update/remove); PLAY/STOP toggles engine; layer count shown in header
- No new colors or styling beyond functional layout; existing Studio chrome unchanged

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
