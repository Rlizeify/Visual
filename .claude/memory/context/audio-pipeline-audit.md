# Audio Pipeline Audit — 2026-05-22

Scope: trace every audio path on the M tab from MediaStream capture to consumer.
Goal: identify the right place to attach a shared T3 waveform progress bar.

## 1. Capture entry points

Both live in `web/src/features/visualizer/VisualizerEngine.ts` (singleton, one
instance per page).

### `enableLiveAudio(deviceId?)` — `VisualizerEngine.ts:199`
- Calls `navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:false,
  noiseSuppression:false, autoGainControl:false, deviceId? } })`.
- Auto-detects BlackHole and re-acquires with `{ deviceId: { exact } }` if found.
- Stream → `this.liveStream`.
- Used for system loopback (BlackHole / VB-Cable).

### `enableTabAudio()` — `VisualizerEngine.ts:255`
- Calls `navigator.mediaDevices.getDisplayMedia({ video:true, audio:true })`.
- Video tracks `.stop()`'d immediately (Chromium requires `video:true`).
- Throws if no tab audio track.
- Wires the audio track's `ended` event to `disableLiveAudio()`.
- Stream → `this.liveStream`.

Both call sites share the rest of the chain.

## 2. Audio graph

Singleton AudioContext: created in `VisualizerEngine.initialize()` at line 103.
There is exactly **one** AudioContext on the page.

```
MediaStream
  └─► audioContext.createMediaStreamSource(stream)   // this.liveSource
        └─► createAnalyser()                          // this.liveAnalyser
              fftSize:               4096
              smoothingTimeConstant: 0.65
              (NOT connected to destination — analysis only, no playback)
```

The engine also has a `fakeAnalyser` (line 104) whose `getByteFrequencyData` /
`getByteTimeDomainData` are monkey-patched to copy from an internally-generated
`this.frequencyData` buffer. That buffer is filled either:
- from synthetic Spotify-driven data (`updateMusicData`, line 407), or
- from the live analyser (`updateLiveMusicData`, line 375).

`butterchurn.createVisualizer(...).connectAudio(this.fakeAnalyser)` is how
Butterchurn gets its bins.

## 3. Gear-icon real-time bar

`web/src/features/visualizer/GearMenu.tsx:264-278`.

```
setInterval(100ms while menu open && live audio enabled)
  └─► engine.getCurrentSignalLevel()                  // VisualizerEngine.ts:288
        ├─► new Uint8Array(liveAnalyser.frequencyBinCount)
        ├─► liveAnalyser.getByteFrequencyData(buf)
        └─► returns avg(buf) / 255   ∈ [0,1]
```

Data shape consumed: a single scalar 0..1 per 100ms tick. The bar maps that
scalar to a width % and a color.

## 4. Track metadata + position

- `services/spotify/polling.ts` — module-level `currentMusicData` singleton.
- `pollPlaybackState()` runs every 5s via `setInterval`.
- On track change (`trackId !== prevTrackId`, line 85) it calls
  `fetchAudioAnalysis(trackId)`.
- `getMusicData()` returns the singleton synchronously.
- `getInterpolatedProgress()` returns ms with clock-drift correction.
- `useTrackMetadata` hook (300ms polling) mirrors a subset into React state.

For T3 we need: `trackId`, `progress` (ms), `duration` (ms).
All already exist on `MusicData`. `getInterpolatedProgress()` gives sub-poll
accuracy.

## 5. Spotify audio-analysis / audio-features usage (to be archived)

Single file: `web/src/services/spotify/analysis.ts`.

Endpoints called:
- `GET https://api.spotify.com/v1/audio-analysis/{trackId}` (line 36)
- `GET https://api.spotify.com/v1/audio-features/{trackId}` (line 53, fallback)

Stored in module-level `currentAnalysis: AudioAnalysis | null`.

Consumers:
- `polling.ts:86` — calls `fetchAudioAnalysis` on track change.
- `VisualizerEngine.ts:5,323,436` — `getAnalysis()`, `isBpmFallback()` for the
  synthetic beat scheduler and tempo seeding.

When archived: VisualizerEngine's synthetic path falls back to BPM (default 120
or whatever `musicData.tempo` carries). The live path (`updateLiveMusicData`)
never touched analysis, so it is unaffected.

## 6. Confirmed current Spotify surface (post-cleanup target)

- Track metadata: name, artist, album art (polling.ts).
- Playback state: isPlaying, progress, duration, shuffle (polling.ts).
- Playback commands: `services/spotify/player.ts` (play/pause/shuffle/next).
- Auth: `services/spotify/auth.ts`, `tokens.ts`, `session.ts`.
- **No** more `/v1/audio-analysis` or `/v1/audio-features` after cleanup.

## 7. Decision: data shape for T3

T3 needs:
- `getWaveform(): number[]` — fixed-length array (target 200) of amplitudes.
- `getPosition(): number` — current playback position in seconds.
- `getDuration(): number` — track duration in seconds.

### Chosen: Option B — accumulated waveform.

**Rationale.** The existing `liveAnalyser` is the only AnalyserNode on the live
audio chain, and it already produces a per-frame amplitude when polled. Option A
(rolling window of last N seconds) would be trivial but doesn't read as a
"progress bar"; it's a tape reader. Option B (sample every 100ms, append, reset
on `trackId` change, downsample to a 200-bucket ring buffer) gives a true
song-shape progress bar matching the gradient-fill spec.

Cost of B over A: a `setInterval(100ms)` driving a ring-buffer write, plus a
`trackId` watcher. Both cheap. The same `liveAnalyser` is reused — no second
AudioContext, no second getDisplayMedia.

### Edge cases
- No stream yet → `getWaveform()` returns `[]`. Consumer renders an empty bar.
- Track has no duration (live podcast, etc.) → `getDuration()` returns 0.
  Consumer renders progress as 0%. Waveform still accumulates.
- User pauses mid-track → amplitude samples will be near zero. Buffer keeps
  growing in position. Fine.
- User seeks → not handled v1. The buffer is monotonic by sample index, not by
  track position. Seek will look wrong until the track changes. Flagged for v2.
- User shares a second stream → `enableLiveAudio` / `enableTabAudio` already
  call `disableLiveAudio()` first, which tears down the old `liveAnalyser`.
  Our hook re-binds on the next sample tick (analyser is read via a getter,
  not cached at hook setup).

## 8. File plan (≤150 lines each)

Per priorities.md hygiene rule.

| File | Job |
|------|-----|
| `web/src/audio/liveAnalyser.ts` | Read-only accessor: `getLiveAnalyser()`. Wraps `VisualizerEngine.liveAnalyser` so consumers don't import the engine. |
| `web/src/audio/sampleAmplitude.ts` | Pure: given an AnalyserNode, return one RMS-ish amplitude 0..1. |
| `web/src/audio/waveformBuffer.ts` | Ring buffer (cap 200). `push(v)`, `clear()`, `snapshot(): number[]`. |
| `web/src/audio/positionSource.ts` | Wraps `getInterpolatedProgress()` + `getMusicData()` → seconds + duration + trackId. |
| `web/src/audio/audioSource.ts` | Orchestrator + public hook `useAudioSource()`. Drives the 100ms sampler, resets on trackId change, exposes `getWaveform/getPosition/getDuration` + subscribe. |

Public API consumed by T3 lives in `audioSource.ts`. Others are internal.

## 9. Butterchurn audit (T2 addendum)

### Single-instance check
- `butterchurn` is imported only in `VisualizerEngine.ts`.
- `createVisualizer(...)` is called exactly once, inside `VisualizerEngine.initialize()`.
- `VisualizerEngine` is a module-level singleton (`getVisualizerEngine()`).
- `ButterchurnCanvas` is rendered exactly once from `App.tsx` via `<VisualizerPage>`
  inside a fixed `<div>` that wraps all MHEU routes. Visibility for M vs non-M
  is handled by z-index + `opacity` of the canvas, not by remount.
- **Conclusion:** one Butterchurn instance, shared by M tab and ambient
  background. No consolidation needed.

### Current audio input path
- `visualizer.connectAudio(this.fakeAnalyser)` (`VisualizerEngine.ts:137`).
- `fakeAnalyser` is a real `AnalyserNode` whose `getByteFrequencyData` and
  `getByteTimeDomainData` are monkey-patched (lines 110-125) to copy from
  `this.frequencyData` / `this.timeDomainData` buffers.
- Those buffers are filled every RAF tick by either:
  - `updateLiveMusicData()` — reads live `liveAnalyser`, applies bass/mid/high
    multipliers, writes into the buffers. Only when `liveAudioEnabled`.
  - `updateMusicData()` — when no live audio: reads Spotify polling +
    `getAnalysis()` (which is currently 403'ing → BPM fallback only) and
    synthesises plausible-looking bins from tempo + beat curve.
- So Butterchurn is currently receiving **either** the real live bins (with
  applied multipliers) **or** synthesised noise driven by `setInterval`-polled
  Spotify tempo. With the 403, the synthetic path is essentially "fake bins
  driven by a hard-coded 120 BPM grid" — that's why it looks dead when no
  tab/system audio is shared.

### Plan
- Create a persistent `sharedAnalyser: AnalyserNode` in `initialize()`.
- Connect Butterchurn directly: `visualizer.connectAudio(sharedAnalyser)`.
- `enableLiveAudio` / `enableTabAudio` route the new `MediaStreamAudioSourceNode`
  into the same `sharedAnalyser` (re-wiring `liveSource.connect(sharedAnalyser)`).
- `disableLiveAudio` disconnects the source; `sharedAnalyser` stays.
- Delete `fakeAnalyser`, `frequencyData`, `timeDomainData`, `updateMusicData`,
  `updateLiveMusicData`, `runBeatScheduler`, all beat-tracking state, and the
  `bass/mid/high Reactivity` settings (and their UI sliders). They were
  workarounds for a now-removed pipeline.
- `services/spotify/analysis.ts` → archive (`web/src/archive/spotify-audio-analysis/`).
- `services/spotify/polling.ts` → drop the `fetchAudioAnalysis` import + call,
  drop `setMusicDataTempo`.

### Final graph (all three consumers)

```
MediaStream  ──► createMediaStreamSource ──► sharedAnalyser
                                              │
                                              ├─► Butterchurn (connectAudio)
                                              ├─► GearMenu signal bar  (getCurrentSignalLevel polls)
                                              └─► audio-source / T3   (sample → ring buffer)
```

One stream. One AudioContext. One AnalyserNode. Three consumers.

