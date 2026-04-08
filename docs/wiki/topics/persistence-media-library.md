---
topic: Persistence & Media Library
last_compiled: 2026-04-07
status: active
---

# Persistence & Media Library

## Summary [coverage: high — 4 sources]

Visual persists everything to a single SQLite database at `userData/visual.db` using `better-sqlite3` in WAL mode. Four tables: `projects` (saved project metadata), `project_state` (serialized cockpit/studio state), `media_library` (imported audio + video with cached analysis), and `settings` (key-value store, includes Spotify tokens and music folder path). Save/Load is exposed via Ctrl+S / Ctrl+Shift+S / Ctrl+O shortcuts and themed in-app dialogs (no native dialogs). State collection uses a register pattern: components register their state getter/setter with `cockpitStateCollector.ts` or `studioStateCollector.ts`, which orchestrates serialization. Imported audio and video files are persisted with cached metadata (BPM, key, video analysis) so reloading is instant — no re-analysis.

## Architecture & Components [coverage: high — 5 sources]

- `electron/database.ts` — SQLite init, WAL mode, all tables and CRUD: `projects`, `project_state`, `media_library`, `settings`. Functions: `mediaImport`, `mediaList`, `mediaRemove`, `mediaUpdateMetadata`, `mediaUpdateLastUsed`, `getSetting`, `setSetting`, `deleteSetting`
- `electron/main.ts` — IPC handlers: `project:save/load/list/delete`, `media:import/list/remove/update-metadata/update-last-used/check-file`, `settings:get/set/pick-music-directory/scan-music-directory`, `studio:open-sample-dialog/read-audio-file`
- `electron/preload-cockpit.ts` and `preload-studio.ts` — IPC bridges
- `hooks/useProjectPersistence.ts` — shared hook: quick save, save as, load, delete, Ctrl+S/Shift+S/O shortcuts, status text
- `state/cockpitStateCollector.ts` — register pattern for DJ decks, UI state, plugins, video_media, audio_media
- `state/studioStateCollector.ts` — register pattern for session, sampler, beat pads
- `components/shared/SaveDialog.tsx` — themed save dialog (dark overlay, name input)
- `components/shared/LoadDialog.tsx` — themed load dialog (project list, inline delete confirm)
- `components/cockpit/dj/AudioLibrary.tsx` — UI for media library + music folder picker
- `state/useVideoStore.ts` — video file state with `dbId`, `missing`, `metadata`, `analysis` fields; library-loaded files skip re-analysis

## Decisions & Rationale [coverage: high — 4 sources]

- **SQLite over JSON files.** Single-file durability, transactions, queryable. WAL mode for concurrent reads.
- **Register pattern for state collection.** Each window has a collector module; components register their state getters at mount. Decouples persistence from component hierarchy.
- **Themed in-app dialogs, not native.** Maintains visual consistency with the app's aesthetic (dark red + amber).
- **Music folder is a single configurable directory in `settings`.** Auto-scans `.mp3/.wav/.flac/.ogg/.m4a/.aac/.aiff` on mount and after folder change.
- **Cached analysis on media library entries.** BPM/key for audio, dominant colors/brightness/temperature/motion/aspect/audio/FPS for video. Analysis runs once on import; subsequent loads skip it.
- **Token security model (planned).** Gitignore the DB; installer excludes `userData/`; first-time Spotify use prompts OAuth. No server, scales to public distribution.
- **Spotify tokens stored plaintext** in `settings` table — noted in the file's comment. Acceptable because `userData/` is per-user and excluded from distribution.

## Patterns & Gotchas [coverage: medium — 3 sources]

- **`postinstall` script can fail silently.** `npx @electron/rebuild -f -w better-sqlite3` was failing silently in `run.vbs`'s command chain, blocking `npm run dev`. Removed the `&&` chain so dev runs directly.
- **`load-mp3` dialog was broadened** to all audio formats in session 13b — don't assume MP3-only.
- **Library-loaded files must skip re-analysis.** Check `dbId` and stored metadata before running `videoAnalyzer` or BPM detection.
- **Missing files grayed out, not removed.** `useVideoStore` has a `missing` flag; `VideoFiles.tsx` shows them with a warning icon. Don't auto-purge — the file may come back.
- **`cockpitStateCollector` includes refs, not blobs.** `video_media` and `audio_media` reference media library entries by ID, not embedded data.

## History & Changelog [coverage: high — 4 sources]

- **2026-04-06 (session 23)** — `checkAndInvalidateScopeChange()` stores Spotify scope in DB and clears tokens on startup if scope changed.
- **2026-04-05 (session 18)** — `run.vbs` fixed: removed `npm install --prefer-offline` from chain so `postinstall` failure doesn't block dev.
- **2026-04-05 (session 17)** — `settings:get/set/pick-music-directory/scan-music-directory` IPC handlers added. `AudioLibrary` gains music folder UI. SpotifySettings auto-reconnect race fixed.
- **2026-04-05 (session 13b)** — `media_library` table introduced. CRUD functions for media. `useVideoStore` extended with persistence fields. `VideoFiles` loads library on mount. `DeckEngine.loadFromPath()` and `DeckChannel` IPC dialog. `AudioLibrary.tsx` new. `cockpitStateCollector` includes media refs.
- **2026-04-05 (sessions 8-9)** — SQLite save/load core: `database.ts`, `useProjectPersistence`, both state collectors, `SaveDialog`/`LoadDialog`, project IPC handlers, `better-sqlite3` import. Ctrl+S/Shift+S/O shortcuts. Status indicators in bottom bars.

## Open Threads [coverage: medium — 1 source]

- Implement token security model: gitignore `visual.db`, installer excludes `userData/`, OAuth prompt on first Spotify use, disconnect clears tokens.
- Installer packaging is tabled — only when explicitly requested.

## Sources

- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/roadmap/priorities]]
- [[../../../.claude/memory/context/active]]
