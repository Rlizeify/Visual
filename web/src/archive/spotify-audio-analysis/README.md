# Archived: Spotify audio-analysis client

Archived 2026-05-22 as part of T2 (audio pipeline rewrite).

## What this was

`analysis.ts` called Spotify's `/v1/audio-analysis/{trackId}` and
`/v1/audio-features/{trackId}` endpoints to fetch beat grids, segment-level
loudness, tempo, and timbre vectors. The visualizer used those to drive a
synthetic AnalyserNode connected to Butterchurn (sharper beat reactivity, real
tempo for the BPM fallback).

## Why it was retired

Spotify began returning HTTP 403 on `/v1/audio-analysis` (and 403 on
`/v1/audio-features` for most clients) following their late-2024 API surface
restrictions. The fallback meant Butterchurn was effectively running on a
hardcoded 120 BPM grid with no real audio data, which looked dead.

We replaced the synthetic pipeline with a real shared AnalyserNode fed by
`getUserMedia` (system loopback) or `getDisplayMedia` (tab audio). Butterchurn,
the gear-icon signal bar, and the T3 waveform progress bar all read from that
same analyser.

See `.claude/memory/decisions/audio-source-routing.md` for the full rationale.

## If we ever bring this back

- Update the import path: it used to be `services/spotify/analysis.ts`.
- Re-add the call in `services/spotify/polling.ts:85` (track-change handler).
- Re-import `getAnalysis()` / `isBpmFallback()` in `VisualizerEngine` (no
  longer present — the synthetic pipeline was deleted).
- Confirm Spotify has lifted the 403. Last checked 2026-05-22.
