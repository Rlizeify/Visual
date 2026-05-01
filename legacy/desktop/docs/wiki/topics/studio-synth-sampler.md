---
topic: Studio — Synth & Sampler
last_compiled: 2026-04-07
status: active
---

# Studio — Synth & Sampler

## Summary [coverage: high — 4 sources]

The Studio window is the synthesis and sample-editing workspace. It has a SYNTH/SAMPLER tab bar. The Synth tab features an additive synthesizer (multiple oscillator layers with type/freq/gain/detune per layer) plus an XY Lissajous oscilloscope and a function synth that evaluates `f(x,y,z)` math expressions where x/y/z are 220/330/440 Hz sine generators. The Sampler tab features a sample editor (waveform with draggable start/end markers, loop, pitch shift, reverse) and a 4×4 beat pad grid with right-click sample assignment. All synth state is persisted via `studioStateCollector.ts` to SQLite. The bottom 45% of the synth tab is split horizontally: additive synth 65%, XY scope + function input 35%.

## Architecture & Components [coverage: high — 5 sources]

Synth side:
- `components/synth/AdditiveSynth.tsx` — additive synthesizer container, exports `AdditiveAudioRefs`, `onEngineReady` callback prop
- `components/synth/OscillatorLayer.tsx` — single layer row (waveform type, freq, gain, detune)
- `audio/SynthEngine.ts` — additive engine, oscillator lifecycle
- `components/synth/WaveformDisplay.tsx` — waveform render
- `components/synth/ExportButton.tsx` — export
- `components/synth/XYScope.tsx` — XY Lissajous, L/R split, fade trail, crosshair
- `components/synth/FunctionSynth.tsx` — `f(x,y,z)` text input, ScriptProcessorNode generates audio routed through additive analyser, play/stop, red border on invalid input

Sampler side:
- `audio/SampleEngine.ts` — load, play/stop, loop, pitch shift via `playbackRate`, reverse, start/end offsets
- `audio/PadEngine.ts` — 16 pad slots, one-shot triggers via `AudioBufferSourceNode`
- `components/synth/SampleEditor.tsx` — container wiring SampleEngine to waveform + controls
- `components/synth/SampleWaveform.tsx` — canvas waveform, draggable start/end markers, dimmed out-of-range regions
- `components/synth/SampleControls.tsx` — Load | Play/Pause | Stop, loop/reverse toggles, editable inputs (st, ms units)
- `components/synth/BeatPads.tsx` — 4×4 grid, click to fire, right-click assign sample, visual flash on trigger
- `state/studioStateCollector.ts` — collects/restores session, sampler, beat pads via register pattern

IPC: `studio:open-sample-dialog` and `studio:read-audio-file` registered in `electron/main.ts`, exposed through `preload-studio.ts`.

## Decisions & Rationale [coverage: medium — 3 sources]

- **Tab bar over multi-window split.** SYNTH and SAMPLER are tabs in one Studio window, not separate windows.
- **Additive synth 65% / XY scope + function 35% split.** Bottom 45% of the synth tab is divided horizontally to make room for the XY scope and function input alongside the synth.
- **`onEngineReady` callback for engine refs.** AdditiveSynth exports an `AdditiveAudioRefs` interface so external components (XYScope, FunctionSynth) can tap into the analyser chain.
- **Function synth uses ScriptProcessorNode.** Despite being deprecated, it's the simplest way to evaluate user math expressions per sample. Audio routes through the additive analyser so the scope reflects it.
- **Patch slots fixed → 100% width** in session 12 for responsive layout.

## Patterns & Gotchas [coverage: high — 4 sources]

- **AdditiveSynth strict-mode init bug.** React strict mode creates the AudioContext twice; the pre-loaded layer must be re-treated as new on second init. Fix: reset `prevLayerIdsRef.current` in the engine init effect.
- **Sample editor loop toggle didn't stop.** `SampleEngine.setLoop()` must set `sourceNode.loop` and `loopStart/loopEnd` on the *live* `AudioBufferSourceNode`, not just instance state.
- **`source.onended` staleness.** Reverse + stop didn't stop playback because a stale callback nullified the active node ref. Fix: guard with `this.sourceNode === source` before clearing.
- **Studio overflow regression.** `overflow:auto` was creating unwanted scrollbars; switched to `overflow:hidden`. Studio frame got `box-sizing:border-box` because `100vw + padding` was overflowing.
- **Wave editor patch panel was clipped.** Fixed in session 6: `.studio-main-canvas` set to flex column with stretch alignment, additive synth container `flex: 1 1 45%`, overflow hidden → auto, `minHeight: 0` on both children.

## History & Changelog [coverage: high — 5 sources]

- **2026-04-05 (session 12)** — Studio responsive cleanup: `box-sizing:border-box`, patch slots `260px → 100%`, additive layer rows shrinkable, `overflow:auto → hidden`.
- **2026-04-05 (session 11)** — Multiple fixes: AdditiveSynth strict-mode, `setLoop()` live update, `source.onended` staleness guard. New: `XYScope.tsx`, `FunctionSynth.tsx`. Studio synth tab layout refactored: bottom 45% split 65/35.
- **2026-04-05 (session 11)** — `SampleControls.tsx` consolidated: Load | Play/Pause | Stop in one row, filename after transport.
- **2026-04-05 (session 6)** — Wave editor patch panel clip fix. Sample editor + beat pads added: `SampleEngine.ts`, `PadEngine.ts`, `SampleWaveform.tsx`, `SampleControls.tsx`, `SampleEditor.tsx`, `BeatPads.tsx`. SYNTH/SAMPLER tab bar in `StudioApp.tsx`. IPC handlers `studio:open-sample-dialog` and `studio:read-audio-file`.
- **2026-04-05** — Additive Synthesizer Panel introduced: `OscillatorLayer.tsx`, `SynthEngine.ts`, `WaveformDisplay.tsx`, `ExportButton.tsx`, `AdditiveSynth.tsx`.

## Open Threads [coverage: low — 1 source]

No specific blockers. The Synth and Sampler are stable; recent work has shifted to Spotify and Cockpit.

## Sources

- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/patterns/index]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/roadmap/priorities]]
