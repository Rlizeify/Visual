# Visual Knowledge Base

Last compiled: 2026-04-07 (r6)
Total topics: 11 | Total concepts: 3 | Total sources: 10

## Topics

| Topic | Also Known As | Sources | Last Updated | Status |
|-------|--------------|---------|-------------|--------|
| [[topics/agent-workflow]] | Claude rules, AGENT.md, SOUL.md, CLAUDE.md, memory system, decisions | 5 | 2026-04-07 | active |
| [[topics/audio-engine]] | AudioEngine, Tone.js, Web Audio, AnalyserNode, singletons, BeatDetector, getDisplayMedia loopback | 5 | 2026-04-07 (r6) | active |
| [[topics/spotify-integration]] | Spotify, OAuth PKCE, Web API, loopback, getDisplayMedia, setDisplayMediaRequestHandler, SpotifyPlayer, Enable Audio Reactivity | 4 | 2026-04-07 (r6) | active |
| [[topics/visualizer-butterchurn]] | Butterchurn, Milkdrop, oscilloscope, LJV, XY scope, visualizer, canvas | 4 | 2026-04-07 | active |
| [[topics/dj-mixer]] | DJ, decks, crossfader, hot cues, pitch fader, DeckEngine, AudioLibrary | 4 | 2026-04-07 | active |
| [[topics/plugin-effects]] | plugins, effects, Compressor, EQ, Delay, Reverb, Chorus, Distortion, PluginRack, PluginChain, MHEUPlugin | 4 | 2026-04-07 | active |
| [[topics/studio-synth-sampler]] | Studio, additive synth, sampler, beat pads, function synth, XY scope, SampleEngine, PadEngine | 4 | 2026-04-07 | active |
| [[topics/persistence-media-library]] | SQLite, better-sqlite3, save/load, media library, settings, project state, video analysis | 4 | 2026-04-07 | active |
| [[topics/window-architecture]] | Electron, multi-window, Hub, Cockpit, Studio, IPC, preload, tool launcher, CSP, Widevine | 4 | 2026-04-07 (r6) | active |
| [[topics/ui-design-system]] | CSS variables, palette, dial, tooltip, tutorial, Hitmarker fonts, MHEU, theme, aesthetic | 4 | 2026-04-07 | active |
| [[topics/project-roadmap]] | roadmap, priorities, milestones, MHEU, architecture rules, deferred | 4 | 2026-04-07 | active |

## Concepts

| Concept | Connects | Last Updated |
|---------|----------|-------------|
| [[concepts/150-line-file-limit]] | plugin-effects, spotify-integration, studio-synth-sampler, ui-design-system, visualizer-butterchurn, project-roadmap | 2026-04-07 |
| [[concepts/archive-not-delete]] | visualizer-butterchurn, window-architecture, project-roadmap, agent-workflow, ui-design-system | 2026-04-07 |
| [[concepts/singleton-engines-vs-react-lifecycle]] | audio-engine, spotify-integration, studio-synth-sampler, plugin-effects, window-architecture | 2026-04-07 (r6) |

## Recent Changes

- 2026-04-07 (r6): Incremental recompile. Updated `spotify-integration`, `audio-engine`, `window-architecture`, and the `singleton-engines-vs-react-lifecycle` concept to reflect session 25b (commit `27138b0`) — visualizer Spotify loopback is now actually implemented. `SpotifyPlayerAudio.ts` silent-oscillator stub removed; replaced with `getDisplayMedia({ video, audio })` capture feeding the AnalyserNode via `MediaStreamAudioSourceNode`. New "Enable Audio Reactivity" button in `SpotifyBrowser` (required user gesture for `getDisplayMedia`); `CockpitApp` auto-reconnect no longer calls `startLoopback()`. Prior wiki claims of "visualizer does not react to Spotify" were stale and have been corrected. No new topics or concepts.
- 2026-04-07: Incremental recompile. Updated `spotify-integration` and `persistence-media-library` to reflect the 2026-04-07 fix commit — `SpotifyPlayerAPI` now logs non-OK status/statusText instead of silently returning `[]`, `SpotifyBrowser` surfaces an empty-playlist hint, `VideoPreview.toFileURL()` URL-encodes each path segment and a `vp-error` overlay shows failed video loads.
- 2026-04-07: Incremental recompile. Updated `persistence-media-library` and `window-architecture` to reflect the 2026-04-07 feat — DVR/MKV/M4V added to `import-video` dialog and `VideoPreview.tsx` switched to `preload="metadata"` so long videos stream from disk instead of buffering. No new topics or concepts.
- 2026-04-07: Incremental recompile. Updated `spotify-integration` and `window-architecture` to reflect 2026-04-07 infra chore — naudiodon references dropped from build scripts; loopback now handled by Electron 29's native `setDisplayMediaRequestHandler({ audio: 'loopback' })`. No new topics or concepts.
- 2026-04-07: Initial compilation. 11 topics created from 10 source files in `.claude/`. 3 concept articles discovered. Schema generated.
