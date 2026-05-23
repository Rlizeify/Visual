# 2026-05-22 — Route all audio consumers through one tab-audio AnalyserNode

**Context.** The M-tab Butterchurn visualizer, the gear-icon signal meter, and
the upcoming T3 waveform progress bar all need amplitude / frequency data from
"what's currently playing." Three options were on the table.

| Option | What it provides | Why it lost |
|---|---|---|
| A. Spotify `/v1/audio-analysis` | Pre-computed beats, segments, timbre, tempo for each track. | Spotify has been returning **HTTP 403** on this endpoint since late 2024 for the vast majority of client apps. The `/v1/audio-features` fallback now 403s too. The pipeline was effectively dead — Butterchurn was running on a hardcoded 120 BPM grid. |
| B. Synthetic waveform from `progress_ms` + tempo | No browser permissions, works offline. | It's fake. The bar would tell the user nothing about what they're actually hearing, and any track without analysis (most of them now) defaults to a flat sine. Bad UX masquerading as a feature. |
| **C. Real tab audio via `getDisplayMedia({audio:true})`** ✅ | Real-time bins, real RMS, real beats. Same source for every consumer. | One user-gesture per session (Chrome's "Share tab audio" dialog), Chromium-only for tab audio. Acceptable. |

**Decision.** Route a single `MediaStreamAudioSourceNode` (from `getUserMedia`
for system loopback **or** `getDisplayMedia` for tab audio) into a persistent
`AnalyserNode` owned by `VisualizerEngine`. Butterchurn, the signal meter, and
the audio-source hook (T3) all read from that one node.

```
MediaStream → MediaStreamAudioSourceNode → sharedAnalyser
                                            ├─► Butterchurn (connectAudio)
                                            ├─► GearMenu signal bar
                                            └─► useAudioSource() → T3
```

**Why Butterchurn was also migrated.** It was previously connected to a
"fake" `AnalyserNode` whose `getByteFrequencyData` / `getByteTimeDomainData`
methods were monkey-patched to copy from buffers that the synthetic Spotify
path filled each frame. With the 403s, those buffers were essentially noise on
a 120 BPM grid. Pointing Butterchurn at the real shared analyser makes the
visualizer react to the music the user is actually hearing — same source as
the signal meter and T3 — and lets us delete the synthetic pipeline entirely.

**Trade-offs accepted.**
- User must hit the gear menu and click "CAPTURE TAB AUDIO" once per session.
  `getDisplayMedia` requires a fresh user gesture; we cannot auto-restore it.
- Loses fine-grained beat / segment data Spotify used to provide. Reactivity
  is now purely audio-driven (RMS / FFT) rather than analysis-driven. For
  this product (visual reactivity > beat-accurate sync) that's the right
  trade.
- Bass/mid/high reactivity sliders dropped — they multiplied bins in the
  synthetic pipeline and don't translate to a direct `connectAudio`. Can be
  added back as `BiquadFilterNode`s in the source chain if user demand returns.

**Filed under T2.** T3 (waveform progress bar across the M-tab top) consumes
`useAudioSource()` from `web/src/audio/audioSource.ts`.
