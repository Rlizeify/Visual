# Wiki Compile Log

## 2026-04-07

**Topics updated:** agent-workflow, audio-engine, spotify-integration, visualizer-butterchurn, dj-mixer, plugin-effects, studio-synth-sampler, persistence-media-library, window-architecture, ui-design-system, project-roadmap
**New topics:** all 11 (first run)
**Concepts created:** 150-line-file-limit, archive-not-delete, singleton-engines-vs-react-lifecycle
**Sources scanned:** 10
**Sources changed:** 10 (first run — all treated as new)
**Schema:** generated

## 2026-04-07 (incremental)

**Topics updated:** spotify-integration, window-architecture
**New topics:** none
**Concepts created:** none
**Sources scanned:** 10
**Sources changed:** 2 (`.claude/memory/context/active.md`, `.claude/memory/progress/changelog.md`)
**Schema:** unchanged
**Reason:** 2026-04-07 infra chore — naudiodon dropped from build scripts; loopback switched to Electron 29 native `setDisplayMediaRequestHandler({ audio: 'loopback' })`.

## 2026-04-07 (incremental)

**Topics updated:** spotify-integration, persistence-media-library
**New topics:** none
**Concepts created:** none
**Sources scanned:** 10
**Sources changed:** 2 (`.claude/memory/context/active.md`, `.claude/memory/progress/changelog.md`)
**Schema:** unchanged
**Reason:** 2026-04-07 fix commit `1c2a956` — `VideoPreview.toFileURL()` URL-encodes path segments, `vp-error` overlay on failed load, `SpotifyPlayerAPI` logs non-OK responses, `SpotifyBrowser` empty-state hint. Two stale-claim corrections recorded: `SpotifyPlayerAudio` is still the silent oscillator stub (visualizer does not react to Spotify audio) and session-25 "URL-encoding already in place" was wrong.

## 2026-04-07 (incremental)

**Topics updated:** persistence-media-library, window-architecture
**New topics:** none
**Concepts created:** none
**Sources scanned:** 10
**Sources changed:** 2 (`.claude/memory/context/active.md`, `.claude/memory/progress/changelog.md`)
**Schema:** unchanged
**Reason:** 2026-04-07 feat — DVR/MKV/M4V added to `import-video` dialog extensions (`electron/main.ts:385`); `VideoPreview.tsx` switched from `preload="auto"` to `preload="metadata"` so long videos stream from disk rather than pre-buffering the entire file; `VideoFiles.tsx` empty-state hint updated to mention `.dvr`.

## 2026-04-07 (r6 — incremental, stale-claim correction)

**Topics updated:** spotify-integration, audio-engine, window-architecture
**Concepts updated:** singleton-engines-vs-react-lifecycle
**New topics:** none
**Concepts created:** none
**Sources scanned:** 10
**Sources changed:** 0 (no mtime changes since r4) — the wiki was out of sync with source state
**Schema:** unchanged (evolution log entry appended)
**Reason:** Stale-claim correction pass. Session 25b (commit `27138b0`, "video URL-encoding fix, spotify error surfacing, visualizer loopback, memory corrections") actually implemented the visualizer Spotify loopback, but the r4 recompile only picked up the URL-encoding / error-surfacing subset and left four articles still saying the visualizer does not react to Spotify. Corrected text in `spotify-integration.md`, `audio-engine.md`, `singleton-engines-vs-react-lifecycle.md`, and `window-architecture.md` (Open Threads only) to reflect: `SpotifyPlayerAudio.ts` uses renderer-side `getDisplayMedia({ video, audio })` + `MediaStreamAudioSourceNode` into the AnalyserNode (analyser not connected to destination to avoid feedback); a new "Enable Audio Reactivity" toolbar button in `SpotifyBrowser.tsx` is the user-gesture entrypoint because `getDisplayMedia` rejects with `NotAllowedError` when called outside a gesture chain; `CockpitApp.tsx` auto-reconnect path no longer calls `startLoopback()`; `CockpitGrid.tsx` forwards the new `activeSource` prop; `startLoopback()` returns `boolean` and there is a new `isLoopbackRunning()` export. Caveat preserved in the Patterns sections: the Electron loopback hook captures ALL system audio, not Spotify-only.
