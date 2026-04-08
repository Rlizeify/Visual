---
topic: Persistence & Media Library
last_compiled: 2026-04-07 (r6)
status: active
---

# Persistence & Media Library

## Summary [coverage: high — 4 sources]

Visual persists everything to a single SQLite database at `userData/visual.db` using `better-sqlite3` in WAL mode. Four tables: `projects` (saved project metadata), `project_state` (serialized cockpit/studio state), `media_library` (imported audio + video with cached analysis), and `settings` (key-value store, includes Spotify tokens and music folder path). Save/Load is exposed via Ctrl+S / Ctrl+Shift+S / Ctrl+O shortcuts and themed in-app dialogs (no native dialogs). State collection uses a register pattern: components register their state getter/setter with `cockpitStateCollector.ts` or `studioStateCollector.ts`, which orchestrates serialization. Imported audio and video files are persisted with cached metadata (BPM, key, video analysis) so reloading is instant — no re-analysis. Video import accepts `mp4`, `webm`, `mov`, `mkv`, `m4v`, and `dvr` containers (the last three added 2026-04-07 for DVR recordings and long-form footage), and long videos stream from disk via `file://` URLs rather than being buffered into memory. On 2026-04-07, `VideoPreview.tsx`'s `toFileURL()` was fixed to URL-encode each path segment via `encodeURIComponent` so paths containing spaces, `#`, `?`, or other reserved characters produce valid `file://` URLs (e.g. `clip #1.mp4` → `clip%20%231.mp4`); the same change added a visible `loadError` overlay + `onError` handler on the `<video>` element so a failed load is no longer a silent black box. A follow-up later the same day fixed a Windows drive-letter regression introduced by per-segment encoding: `encodeURIComponent('C:')` → `C%3A`, which Chromium rejected. `toFileURL()` now post-processes the encoded path with `.replace(/^\/([A-Za-z])%3A/, '/$1:')` so `C:\Users\nikob\Videos\clip.mp4` correctly becomes `file:///C:/Users/nikob/Videos/clip.mp4`. The complementary CSP fix — adding `file:` to `media-src` and `img-src` in `index.html` — landed in the same commit; see `window-architecture`.

## Architecture & Components [coverage: high — 7 sources]

- `electron/database.ts` — SQLite init, WAL mode, all tables and CRUD: `projects`, `project_state`, `media_library`, `settings`. Functions: `mediaImport`, `mediaList`, `mediaRemove`, `mediaUpdateMetadata`, `mediaUpdateLastUsed`, `getSetting`, `setSetting`, `deleteSetting`
- `electron/main.ts` — IPC handlers: `project:save/load/list/delete`, `media:import/list/remove/update-metadata/update-last-used/check-file`, `settings:get/set/pick-music-directory/scan-music-directory`, `studio:open-sample-dialog/read-audio-file`. The `import-video` dialog's extensions array lists `mp4, webm, mov, mkv, m4v, dvr` (line ~385)
- `components/cockpit/VideoPreview.tsx` — HTML `<video>` element uses `preload="metadata"` (not `auto`) so long videos load only headers up-front and stream the rest on demand from the `file://` URL. `preload="auto"` would make Chromium buffer the entire file and freeze the UI on 10+ minute clips. `toFileURL()` (line ~13) URL-encodes each path segment via `encodeURIComponent` and joins with `/`, producing valid `file://` URLs for paths containing spaces or reserved characters. On Windows, after encoding it restores the drive-letter colon via `.replace(/^\/([A-Za-z])%3A/, '/$1:')` — otherwise `C:` would stay `C%3A` and Chromium would reject the URL. A `loadError` state + `onError` handler logs the failing src and `MediaError` to console and renders a `vp-error` overlay labeled "Failed to load video" instead of showing a silent black rectangle.
- `components/cockpit/VideoFiles.tsx` — empty-state hint lists supported extensions including `.dvr`
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

## Patterns & Gotchas [coverage: medium — 4 sources]

- **`postinstall` script can fail silently.** `npx @electron/rebuild -f -w better-sqlite3` was failing silently in `run.vbs`'s command chain, blocking `npm run dev`. Removed the `&&` chain so dev runs directly.
- **`load-mp3` dialog was broadened** to all audio formats in session 13b — don't assume MP3-only.
- **Library-loaded files must skip re-analysis.** Check `dbId` and stored metadata before running `videoAnalyzer` or BPM detection.
- **Missing files grayed out, not removed.** `useVideoStore` has a `missing` flag; `VideoFiles.tsx` shows them with a warning icon. Don't auto-purge — the file may come back.
- **`cockpitStateCollector` includes refs, not blobs.** `video_media` and `audio_media` reference media library entries by ID, not embedded data.
- **Long videos need `preload="metadata"`, not `"auto"`.** With `auto`, Chromium tries to buffer the entire file up-front and freezes the UI on anything past ~10 minutes. `metadata` loads headers only and streams the body on demand. Combined with `toFileURL()`, playback streams from disk rather than into memory. No explicit size or duration cap is enforced in the import / preview / playback code.
- **`file://` URLs must URL-encode each path segment — but restore the Windows drive colon.** Session 25's `toFileURL()` only normalized slashes — a file like `clip #1.mp4` produced an invalid URL and the preview silently failed. The 2026-04-07 fix wraps each segment in `encodeURIComponent`, which then introduced a Windows regression: `encodeURIComponent('C:')` → `C%3A` and Chromium refused `file:///C%3A/...`. Final shape: per-segment encode, then `.replace(/^\/([A-Za-z])%3A/, '/$1:')` to restore the drive-letter colon only. If you touch `toFileURL`, preserve both steps; do not `encodeURI` the whole string (it leaves `#` and `?` unencoded) and do not globally un-encode `%3A` (any colon inside a filename segment must stay encoded).
- **Local video CSP gotcha.** `index.html` had to add `file:` to both `media-src` and `img-src` before the `<video>` element could load `file://` URLs at all. If `VideoPreview` shows a silent error overlay on paths that look correct in the console, suspect CSP before suspecting `toFileURL`. Only `index.html` carries a `<meta>` CSP; other windows inherit Electron defaults.
- **Video load failures must be visible.** The `<video>` element now has an `onError` that logs the src + `MediaError` and toggles `loadError`, which renders a `vp-error` overlay. Silent black rectangles used to mask URL-encoding and container-support bugs for days — always surface the failure.
- **Verify claims against the code before writing "already in place".** Two 2026-04-07 memory corrections in a row (`toFileURL` URL-encoding, `SpotifyPlayerAudio` PCM rewrite) were claims made in prior changelog entries that were never actually implemented. When touching a file, read it; don't trust an earlier session note.
- **DVR container playability depends on Chromium.** MPEG-TS `.dvr` files play natively; DVR-MS does not. Import won't transcode silently — failing files are surfaced, not hidden.

## History & Changelog [coverage: high — 6 sources]

- **2026-04-07 (fix, second pass)** — Windows drive-colon regression from per-segment encoding. `VideoPreview.tsx` `toFileURL()` now appends `.replace(/^\/([A-Za-z])%3A/, '/$1:')` after per-segment `encodeURIComponent` so `C:\Users\nikob\Videos\clip.mp4` produces `file:///C:/Users/nikob/Videos/clip.mp4` instead of `file:///C%3A/Users/nikob/Videos/clip.mp4` (which Chromium rejected). Complementary CSP change in the same commit: `apps/desktop/index.html` `<meta>` CSP gained `file:` in `media-src` and `img-src`. `npx tsc --noEmit` clean.
- **2026-04-07 (fix)** — `VideoPreview.tsx:13` `toFileURL()` now URL-encodes each path segment via `encodeURIComponent`. The prior implementation only normalized slashes, so files with spaces or `#`/`?` in the name silently failed to load. Same commit added `loadError` state, an `onError` handler on the `<video>` element logging the failing src + `MediaError`, and a visible `vp-error` overlay. The session 25 note claiming URL-encoding was "already in place" was wrong and has been corrected in `active.md`.
- **2026-04-07 (feat)** — DVR import + long MP4 playback. `electron/main.ts:385` — `import-video` dialog extensions array gains `dvr`, `mkv`, `m4v`. `VideoFiles.tsx` — empty-state hint updated to mention `.dvr`. `VideoPreview.tsx:159` — `preload="auto"` → `preload="metadata"` so long videos don't pre-buffer the entire file. Streaming via `toFileURL()` was already in place from session 25. No size/duration caps existed in import or playback; none were added or removed.
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
