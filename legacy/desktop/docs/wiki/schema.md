# Wiki Schema

This file defines the structure and conventions for the Visual knowledge base wiki. It is generated on first compile and co-evolved between human and LLM on subsequent runs.

**Human:** You can edit this file to rename topics, merge them, add conventions, or change the article structure. The compiler will respect your changes on the next run.

**Compiler:** Read this file before classifying sources. Follow its conventions. Add new topics here when discovered. Never remove topics without human approval.

## Topics

- agent-workflow: How Claude operates in this project — task decomposition, session management, escalation, communication style
- audio-engine: Tone.js + Web Audio singleton engines, AnalyserNode routing, plugin chain insertion, Spotify PCM bridge
- spotify-integration: OAuth PKCE, Web API polling, WASAPI loopback via naudiodon, browser/now-playing UI
- visualizer-butterchurn: Butterchurn music visualizer + LJV/XY oscilloscopes, canvas perf, fade trails
- dj-mixer: 4-deck DJ mixer with crossfader, hot cues, pitch faders, per-deck audio graph, audio library
- plugin-effects: File-per-plugin effects system (Compressor/EQ/Delay/Reverb/Chorus/Distortion), PluginChain, PluginRack
- studio-synth-sampler: Studio window — additive synth, XY scope, function synth, sample editor, beat pads
- persistence-media-library: SQLite (better-sqlite3 WAL) projects/state/media/settings, save/load, cached analysis
- window-architecture: Electron multi-window (Hub/Cockpit/Studio), IPC patterns, preload bridges, tool launcher
- ui-design-system: CSS variables in :root, dark-red+amber+teal palette, dial vertical-drag, tooltip portal, tutorials, fonts
- project-roadmap: Architecture rules, completed milestones, up-next ordering, deferred items

## Concepts

- 150-line-file-limit: How a hard line cap drives decomposition across the codebase — connects [plugin-effects, spotify-integration, studio-synth-sampler, ui-design-system]
- archive-not-delete: Why deletion is forbidden and how archival changes the cost of architectural change — connects [visualizer-butterchurn, window-architecture, project-roadmap, agent-workflow]
- singleton-engines-vs-react-lifecycle: How module-level audio singletons collide with React strict mode and SDK readiness — connects [audio-engine, spotify-integration, studio-synth-sampler, plugin-effects]

## Article Structure

Each topic article follows the structure defined in `.wiki-compiler.json` `article_sections`:

- **Summary** [coverage] — standalone briefing of the topic
- **Architecture & Components** [coverage] — how the topic fits into the multi-window Electron app, key files, modules
- **Decisions & Rationale** [coverage] — recorded design choices and the reasoning behind them
- **Patterns & Gotchas** [coverage] — recurring observations, footguns, conventions to follow
- **History & Changelog** [coverage] — what changed, when, in which session
- **Open Threads** [coverage] — blockers, in-progress work, roadmap items
- **Sources** — backlinks to all contributing source files

Coverage tags: `[coverage: high — N sources]`, `[coverage: medium — N sources]`, `[coverage: low — N sources]`

## Naming Conventions

- Topic slugs: lowercase-kebab-case (e.g., `audio-engine`, `spotify-integration`)
- Files: `{topic-slug}.md` in `topics/`; `{concept-slug}.md` in `concepts/`
- Dates: YYYY-MM-DD format everywhere
- Links: Obsidian `[[wikilinks]]` with relative paths from `topics/` (sources use `[[../../../.claude/...]]`)
- Sessions are referenced as "session N" matching changelog headings

## Cross-Reference Rules

- Topics that share patterns (e.g., audio singletons appear in audio-engine, spotify, studio) should reference each other via concept articles
- Decisions affecting multiple topics get noted in each relevant topic's Decisions & Rationale section
- Gotchas applying to multiple topics are surfaced as concepts when they recur 3+ times

## Evolution Log

- 2026-04-07: Initial schema generated from 11 topics, 3 concepts. Sources scanned: 10 markdown files in `.claude/`.
- 2026-04-07: Incremental recompile. No schema changes. `spotify-integration` and `window-architecture` updated to reflect naudiodon removal and switch to Electron native loopback.
- 2026-04-07: Incremental recompile. No schema changes. `persistence-media-library` and `window-architecture` updated to cover DVR/MKV/M4V video import support and the `VideoPreview.tsx` `preload="metadata"` fix for long videos.
- 2026-04-07: Incremental recompile. No schema changes. `spotify-integration` and `persistence-media-library` updated for the 2026-04-07 fix commit: Spotify API error surfacing, `SpotifyBrowser` empty-state hint, `VideoPreview.toFileURL()` per-segment URL-encoding + `onError` overlay. Two stale-claim corrections recorded: `SpotifyPlayerAudio` is still silent and session-25 URL-encoding claim was wrong.
- 2026-04-07 (r6): Incremental recompile. No schema changes. Stale-claim correction pass: the previous revision still carried "visualizer Spotify loopback is NOT implemented" and "`SpotifyPlayerAudio.ts` is a silent stub" in `spotify-integration`, `audio-engine`, `singleton-engines-vs-react-lifecycle`, and `window-architecture`'s Open Threads. Session 25b (commit `27138b0`) had actually implemented loopback via renderer-side `getDisplayMedia({ video, audio })` + `MediaStreamAudioSourceNode` + an "Enable Audio Reactivity" user-gesture button in `SpotifyBrowser`; `CockpitApp.tsx` auto-reconnect path no longer triggers `startLoopback()` because the OAuth callback breaks the gesture chain. All four articles rewritten to reflect the real state.
- 2026-04-07 (r7): Incremental recompile. No schema changes. `spotify-integration`, `window-architecture`, and `persistence-media-library` updated for commit `73dc19a`: `REQUIRED_SCOPE_VERSION` bump `'2'`→`'3'` in `electron/spotify-auth.ts:11` (forces re-OAuth on stale-scope tokens), `sp-reconnect-banner` in `SpotifyBrowser.tsx` when `playlists.length > 0 && every trackCount === 0`, `console.warn typeof p.tracks` in `SpotifyPlayerAPI.ts`, `index.html` CSP `file:` added to both `media-src` and `img-src`, and `VideoPreview.toFileURL()` Windows drive-colon restore via `.replace(/^\/([A-Za-z])%3A/, '/$1:')`. Only `active.md` changed in source; no new concepts warranted.
- 2026-04-07 (r8): Incremental recompile. No schema changes. `ui-design-system` and `window-architecture` updated for commit `3c96d40` (Hitmarker Text font bundling). New architectural rule recorded in both topics' Patterns: bundled CSS `url()` paths must resolve inside `apps/desktop/src/` because `vite.config.ts` does not configure `publicDir`; assets traversing out of the source tree are silently dropped from `dist/assets/` even though the CSS still ships. Fix moved the 8 referenced Hitmarker Text faces into `src/styles/fonts/HitmarkerText/` and rewrote `fonts.css` `url()`s to mirror the working `SDGlitch.ttf` pattern. Only `active.md` changed in source; no new concepts. Note: this entry was applied manually after a post-commit hook race left the previous compile in a half-written state — `ui-design-system.md` had been updated to r8 but state/INDEX/log/sibling articles never got synced. The hook now uses a lockfile (`.git/wiki-compile.lock`) to serialize compiles.
