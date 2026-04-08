---
concept: The 150-Line File Limit
last_compiled: 2026-04-07
topics_connected: [plugin-effects, spotify-integration, studio-synth-sampler, ui-design-system]
status: active
---

# The 150-Line File Limit

## Pattern

Visual enforces a hard rule from `priorities.md` and `roadmap.md`: **one job per file, max 150 lines per file.** This single constraint shapes the entire codebase architecture. When a feature outgrows 150 lines, it gets split — not refactored later, not "soon", but now. The pattern surfaces as a constant rhythm of file decomposition events in the changelog: `SpotifyPlayer.ts (354 lines) → 4 files`, `SpotifyBrowser.tsx (164 → 125 lines) + 2 extracted components`, `Oscilloscope.tsx ≤ 80 lines`, plugin files each independently sized, sampler split into Engine + Waveform + Controls + Editor.

The limit forces semantic separation: types in their own file, audio routing in its own module-level singleton, UI components broken by responsibility (now-playing strip, track list, browser shell). It rules out "god files" — there are none in the codebase.

## Instances

- **2026-04-05 (session 21)** in [[../topics/spotify-integration]]: `SpotifyPlayer.ts` (354 lines) split into `SpotifyPlayerTypes.ts` (35), `SpotifyPlayerAPI.ts` (66), `SpotifyPlayerAudio.ts` (60), `SpotifyPlayer.ts` (136). `SpotifyBrowser.tsx` (164 → 125 lines) extracted `SpotifyNowPlaying.tsx` (31) and `SpotifyTrackList.tsx` (44).
- **2026-04-05 (session 5)** in [[../topics/plugin-effects]]: Plugin rack layout enforced 260px hard wall + isolated scroll because the alternative was a single fat panel.
- **Plugin architecture** in [[../topics/plugin-effects]]: File-per-plugin is a hard rule. `MHEUPlugin.ts`, `PluginChain.ts`, `pluginRegistry.ts`, plus one file per effect (Compressor/EQ/Delay/Reverb/Chorus/Distortion).
- **2026-04-05 (session 6)** in [[../topics/studio-synth-sampler]]: Sampler arrived as 6 separate files: `SampleEngine.ts`, `PadEngine.ts`, `SampleWaveform.tsx`, `SampleControls.tsx`, `SampleEditor.tsx`, `BeatPads.tsx`.
- **2026-04-05 (session 2)** in [[../topics/visualizer-butterchurn]]: `Oscilloscope.tsx` written to ≤80 lines from the start.
- **Architecture rules** in [[../topics/project-roadmap]]: "Max 150 lines per file (hard limit)" — explicit, non-negotiable.

## What This Means

The 150-line limit is doing a lot of architectural work for free. It forces:
1. **Single responsibility** without anyone having to argue about SRP — there's no room to violate it.
2. **Testable seams** because each file has one job and a small surface.
3. **Easy archival** — when something gets replaced, only one file moves to `src/archive/`.
4. **No god objects** — `AudioEngine` is a singleton, but it delegates to `PluginChain`, `SynthEngine`, `BeatDetector`, `DeckEngine`, `SpotifyPlayerAudio`, etc., each in its own file.
5. **Predictable diff sizes** — every changelog entry can list affected files concretely because each file is small enough to reason about.

The concept that does the heavy lifting here is **constraint-driven design**: rather than relying on taste or post-hoc cleanup, a hard numeric limit prevents drift. When recommending changes to this codebase, always check: will this push a file over 150 lines? If yes, propose the split *as part of the change*, not after.

## Sources

- [[../topics/plugin-effects]]
- [[../topics/spotify-integration]]
- [[../topics/studio-synth-sampler]]
- [[../topics/visualizer-butterchurn]]
- [[../topics/project-roadmap]]
