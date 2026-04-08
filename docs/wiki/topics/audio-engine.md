---
topic: Audio Engine
last_compiled: 2026-04-07 (r6)
status: active
---

# Audio Engine

## Summary [coverage: high — 5 sources]

Visual's audio layer is built on Tone.js 15 plus raw Web Audio. Audio engines (`AudioEngine.ts`, `SynthEngine.ts`, `BeatDetector.ts`) are module-level singletons — never instantiated per component — and accessed via the `useAudioEngine` hook. The Cockpit AnalyserNode is the central feed point: visualizer, oscilloscope, DJ decks, plugin effects chain, and Spotify (via PCM loopback) all converge here. The plugin chain is wired between Tone.js's chorus output and `ctx.destination`, exposed by `audioEngine.getPluginChain()`. Source switching (`activeSource: 'mp3' | 'spotify'`) routes the analyser correctly between MP3 playback and the Spotify loopback path. OscillatorNodes are treated as one-shot — `stopAll()` tears down and recreates them so future `startAll()` calls work.

## Architecture & Components [coverage: high — 5 sources]

Key files:
- `audio/AudioEngine.ts` — main singleton, owns Tone.js graph and the inserted PluginChain
- `audio/SynthEngine.ts` — additive synthesizer engine, oscillator lifecycle
- `audio/BeatDetector.ts` — beat detection singleton
- `audio/SpotifyPlayer.ts` — Spotify service (Web API polling, state)
- `audio/SpotifyPlayerAudio.ts` — Web Audio routing for Spotify. Since 2026-04-07 (session 25b) uses renderer-side `getDisplayMedia({ video: true, audio: true })`: the video track is stopped and removed immediately and the audio track is piped into the Cockpit AnalyserNode through a `MediaStreamAudioSourceNode`. The analyser is **not** connected to `ctx.destination` to avoid a system-audio feedback loop. Exports `startLoopback(): Promise<boolean>`, `stopLoopback()`, `isLoopbackRunning()`.
- `electron/audio-loopback.ts` — main-process hook that calls `setDisplayMediaRequestHandler({ audio: 'loopback' })` so renderer-side `getDisplayMedia` returns a system-loopback stream with no native module. (Earlier naudiodon `AudioIO` WASAPI capture was abandoned 2026-04-07 — see `spotify-integration`.)
- `dj/DeckEngine.ts` — per-deck audio graph (`AudioBufferSourceNode → GainNode`), play/pause/seek/cue/hot cues/pitch/volume
- `synth/SampleEngine.ts` — sample playback, loop, pitch shift via `playbackRate`, reverse, start/end offsets
- `synth/PadEngine.ts` — 16 pad slots, one-shot triggers via `AudioBufferSourceNode`
- `plugins/PluginChain.ts` — ordered plugin array, rewires Web Audio connections on every mutation, bypassed plugins are routed around

## Decisions & Rationale [coverage: medium — 2 sources]

- **Singleton audio engines.** Never instantiated per-component to prevent multiple AudioContexts and stale references. The hook (`useAudioEngine`) is the canonical access point.
- **Plugin chain insertion point.** AudioEngine disconnects Tone's chorus from `Tone.getDestination()`, inserts the `PluginChain` between chorus and `ctx.destination`. This keeps Tone's high-level graph intact while allowing arbitrary user effects.
- **Spotify silent oscillator fallback (2026-04-06, session 25).** Replacing `getUserMedia({chromeMediaSource:'desktop'})` with a silent `OscillatorNode` (gain=0) connected to the AnalyserNode eliminated the renderer "bad IPC message reason 263" crash. This was a deliberately silent stub — visualizer did not react to Spotify audio. Superseded 2026-04-07 (see next item).
- **`getDisplayMedia` + `MediaStreamAudioSourceNode` for Spotify loopback (2026-04-07, session 25b).** The silent stub was removed. `SpotifyPlayerAudio.ts` now calls `getDisplayMedia({ video: true, audio: true })`, stops/removes the video track, and wires the audio track to the Cockpit AnalyserNode through a `MediaStreamAudioSourceNode`. Relies on Electron 29's `setDisplayMediaRequestHandler({ audio: 'loopback' })` from session 24 to return a system-loopback stream. Chosen over the session-24 plan of a custom PCM queue / `ScriptProcessorNode` because it reuses existing Web Audio primitives and does not need IPC buffering. Analyser is not connected to `ctx.destination` (would feedback).

## Patterns & Gotchas [coverage: high — 5 sources]

- **OscillatorNode is one-shot.** Cannot be restarted after `stop()`. `stopAll()` must tear down and recreate all oscillator nodes to enable future `startAll()` calls. Keep config separate from node lifecycle so state survives recreation.
- **Pre-allocate everything in animation loops.** Canvas-based rendering hits perf cliffs when allocating arrays per frame. Use ring buffers and pre-allocated particle pools. Never allocate in `requestAnimationFrame` callbacks.
- **`onended` callback staleness.** `SampleEngine.ts` had a bug where stale callbacks nullified the active node reference; the fix is to guard with `this.sourceNode === source` before clearing.
- **AudioWorklet CSP.** Tone.js needs `worker-src 'self' blob:` in the CSP `<meta>` tag in `index.html` or it throws "Refused to create a worker from blob:".
- **React strict mode + AudioContext.** AdditiveSynth had to reset `prevLayerIdsRef.current` in the engine init effect so the pre-loaded layer is treated as new after AudioContext re-creation.
- **Singleton enforcement.** Never create a second instance of any audio engine. Always go through the existing singleton or the hook.

## History & Changelog [coverage: high — 6 sources]

- **2026-04-07 (session 25b)** — `SpotifyPlayerAudio.ts` silent-oscillator stub removed; replaced with `getDisplayMedia({ video, audio })` capture and `MediaStreamAudioSourceNode` into AnalyserNode. File grew from ~55 to ~85 lines. `startLoopback()` returns `boolean`; new `isLoopbackRunning()`.
- **2026-04-07 (infra)** — `naudiodon` removed from `apps/desktop/package.json` build scripts. Loopback now sits on Electron 29's native `setDisplayMediaRequestHandler({ audio: 'loopback' })` — no native module compile.
- **2026-04-06 (session 25)** — Silent OscillatorNode replaces `getUserMedia` in `SpotifyPlayerAudio.ts` to fix renderer crash. Real loopback deferred (landed 2026-04-07, above).
- **2026-04-06 (session 24)** — `electron/audio-loopback.ts` (new) — originally implemented with naudiodon `AudioIO` (WASAPI host API) plus a planned `ScriptProcessorNode` PCM dequeue in `SpotifyPlayerAudio.ts`. The PCM dequeue was never landed; naudiodon was superseded 2026-04-07 by the Electron native hook.
- **2026-04-05 (session 11)** — `SampleEngine.setLoop()` now sets `sourceNode.loop` and `loopStart/loopEnd` on the live source. `source.onended` guarded against stale callbacks. AdditiveSynth strict-mode init bug fixed.
- **2026-04-05 (sessions 8-9)** — `DeckEngine.ts` introduced: per-deck `AudioBufferSourceNode → GainNode`, transport, cue, hot cues, pitch, volume.
- **2026-04-05 (session 6)** — `SampleEngine.ts` and `PadEngine.ts` introduced.
- **2026-04-05** — Plugin chain inserted between Tone chorus and destination via `AudioEngine.getPluginChain()`.

## Open Threads [coverage: low — 1 source]

- Manual test on Windows: start app → connect Spotify → play a track → click "Enable Audio Reactivity" in `SpotifyBrowser` toolbar → verify the visualizer reacts. (The button click is required; `getDisplayMedia` throws `NotAllowedError` without a user gesture.)
- macOS/Linux behavior of the loopback path is unverified — `getDisplayMedia` with `audio: true` may return zero audio tracks; `SpotifyPlayerAudio.startLoopback()` returns `false` in that case and the button label flips to "Audio capture is Windows-only".
- naudiodon + MSVC Build Tools are no longer required (the native-compile branch was abandoned 2026-04-07). Nothing to install for loopback anymore.

## Sources

- [[../../../.claude/memory/patterns/index]]
- [[../../../.claude/memory/context/active]]
- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/roadmap/priorities]]
