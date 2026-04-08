---
topic: Window Architecture & IPC
last_compiled: 2026-04-07 (r8)
status: active
---

# Window Architecture & IPC

## Summary [coverage: high — 4 sources]

Visual is an Electron 29 multi-window app. The original four-window layout (Hub, Cockpit, Display, Studio) has collapsed to three: **Hub** (splash + launcher + tools + tutorial), **Cockpit** (DJ + MP3 + visualizer + plugins + Spotify + video), and **Studio** (additive synth + sampler + beat pads). The standalone Display window has been folded into Cockpit's bottom-right panel — its code in `electron/main.ts` is commented out (not deleted) and prefixed with a `// DISPLAY WINDOW —` marker. IPC flows one-way: Cockpit → Display only (back when Display existed); Studio is isolated and doesn't talk to either. New cross-window features require new IPC channels in `main.ts` plus the relevant preload script. Tools (like Binary Synth) launch as additional BrowserWindows tracked in a `toolWindows` Map and cleaned up when Hub closes.

## Architecture & Components [coverage: high — 5 sources]

- `electron/main.ts` — main process, window factories (`createHubWindow`, `createCockpitWindow`, `createStudioWindow`, ~~`createDisplayWindow`~~), all IPC handlers, `toolRegistry`, `vendorPath()` helper, `tool:launch` handler with `toolWindows` Map. `import-video` dialog (~line 385) lists `mp4, webm, mov, mkv, m4v, dvr`
- `electron/preload-hub.ts` — exposes `launchTool(toolName)` and project bridges
- `electron/preload-cockpit.ts` — exposes Spotify, media, settings, project, audio loopback, video import bridges
- `electron/preload-studio.ts` — exposes project + sample dialog bridges
- `electron/spotify-auth.ts` — temp HTTP server on `127.0.0.1:8888` for OAuth callback
- `electron/audio-loopback.ts` — `setupLoopbackIpc()` registers the loopback IPC and wires Electron 29's `setDisplayMediaRequestHandler({ audio: 'loopback' })` so the renderer receives system audio output without any native module. (The earlier naudiodon WASAPI implementation was replaced 2026-04-07; `package.json` no longer lists naudiodon in `postinstall` / `rebuild:native`.)
- `vendor/binary-synth/` — bundled MIT-licensed open-source tool launched as a popup window
- `apps/desktop/run.vbs` — silent launcher; runs `npm run dev` directly (no `npm install` chain — that broke session 18)
- `apps/desktop/index.html` — CSP `<meta>` tag with `worker-src 'self' blob:` for AudioWorklet, `script-src` allows local, and (as of 2026-04-07) `file:` in both `media-src` and `img-src` so `VideoPreview.tsx` can load local video files via `file://` URLs. Note: `index.html` is the **only** HTML file with a `<meta>` CSP; hub/studio/display HTMLs have no explicit CSP and inherit Electron's defaults, and `main.ts` injects no CSP headers either.
- `apps/desktop/vite.config.ts` — multi-entry build (`main`/`display`/`hub`/`studio` HTMLs), `vite-plugin-electron` for `electron/main.ts` + 4 preload entries (each → `dist-electron/`), `vite-plugin-electron-renderer`. **No `publicDir` is set**, so Vite only bundles assets reachable from inside `apps/desktop/src/`. Anything `url()`-referenced from outside the source tree (e.g. `apps/desktop/fonts/...`) is silently dropped from `dist/assets/` even though the CSS file ships fine. See `ui-design-system` Patterns for the font-bundling consequence and the working pattern.

## Decisions & Rationale [coverage: high — 4 sources]

- **Fold Display window into Cockpit panel.** Reduces window count, simplifies IPC. Display window code commented out (not deleted) in `electron/main.ts` for archival.
- **Standard `electron@^29.4.6`, drop castlabs.** Session 24 (2026-04-06) — castlabs `electron-releases` was needed for Widevine/EME (Spotify Web Playback SDK). With SDK removed, standard Electron is enough.
- **One-way Cockpit → Display IPC.** Display never sends back. Studio is isolated. Any feature needing reverse or cross-window sync requires new IPC channels.
- **Tool launcher is a BrowserWindow popup.** Vendored open-source tools launch via `tool:launch` IPC, tracked in `toolWindows` Map, cleaned up on Hub close.
- **CSP must allow `worker-src 'self' blob:`** for Tone.js AudioWorklet. Added to `index.html` `<meta http-equiv="Content-Security-Policy">`.
- **CSP must allow `file:` in `media-src` and `img-src` (2026-04-07).** `VideoPreview.tsx` loads local videos via `file://` URLs produced by `toFileURL()`. Without `file:` in `media-src`, the `<video>` element is blocked by CSP and renders a silent error; without `file:` in `img-src` the same goes for any poster/thumbnail. Only `index.html` needed the change — other window HTMLs have no `<meta>` CSP.
- **`allowRunningInsecureContent: false`** explicitly set in cockpit `webPreferences` (security; was previously omitted).
- **`127.0.0.1` over `localhost`** for OAuth redirect — Spotify dashboard requires it.

## Patterns & Gotchas [coverage: high — 4 sources]

- **IPC is one-way Cockpit → Display.** Always was. Adding Display → Cockpit feedback or Studio sync requires new IPC channels in `main.ts` and the appropriate preload.
- **Renderer crash "bad IPC message reason 263"** — caused by `getUserMedia({chromeMediaSource:'desktop'})` in renderer. Fix: silent OscillatorNode fallback (session 25).
- **Hub autoplay Promise rejection.** Use `audio.play().catch(() => {})` not `try/catch` — the rejection from "play() interrupted by pause()" is async.
- **`run.vbs` silent failure.** `postinstall` script (`npx @electron/rebuild -f -w better-sqlite3`) was failing silently in the `&&` chain, blocking `npm run dev`. Fix: remove `npm install` from the chain, run dev directly.
- **CSP gotchas.** Tone.js AudioWorklet needs `worker-src 'self' blob:`. Local `file://` videos need `file:` in `media-src` and `img-src` — added 2026-04-07 to unblock `VideoPreview.tsx` on Windows. Spotify SDK formerly needed `https://sdk.scdn.co` in `script-src` (now obsolete with SDK removed).
- **Only `index.html` has a `<meta>` CSP.** If you add a new window, the hub/studio/display HTMLs inherit Electron defaults instead of Cockpit's CSP. Duplicating CSP rules across files is easy to forget; grep for `http-equiv="Content-Security-Policy"` before assuming a rule applies everywhere.
- **Vite has no `publicDir` — assets must live inside `apps/desktop/src/`.** Any `url()` in a bundled CSS that escapes the source tree (e.g. `../../fonts/...` reaching `apps/desktop/fonts/`) is silently dropped from the build output. The CSS file itself still ships, the `@font-face` block looks valid, but the referenced files never appear in `dist/assets/` and the browser 404s at runtime. Verified empirically on commit `3c96d40`: pre-fix `dist/assets/` had `SDGlitch-*.ttf` (file lives at `src/styles/fonts/SDGlitch.ttf`) but **zero** Hitmarker files (referenced via `../../fonts/...`). Either keep all referenced assets under `src/` or set `publicDir` in `vite.config.ts`.
- **Widevine `components.whenReady()`** must be awaited inside `app.whenReady()` — not via `appendSwitch`. Now removed alongside SDK.

## History & Changelog [coverage: high — 9 sources]

- **2026-04-07 (commit `3c96d40`)** — Vite asset-bundling rule documented after a real shipping bug. `apps/desktop/src/styles/fonts.css` had been referencing Hitmarker Text WOFF/WOFF2 files via `../../fonts/18082023_Hitmarker/Text/WOFF/...`, which traverses out of `apps/desktop/src/`. Because `vite.config.ts` sets no `publicDir`, Vite silently omitted those files from `dist/assets/` while still emitting the CSS — fonts 404'd at runtime on a collaborator's machine. Fix lived in `ui-design-system` (move the 8 referenced files into `src/styles/fonts/HitmarkerText/`); the architectural lesson — *anything `url()`-referenced from bundled CSS must stay inside `src/`* — is now in Patterns and the new `vite.config.ts` line in Components.
- **2026-04-07 (fix)** — `apps/desktop/index.html` CSP `<meta>` extended: `file:` added to both `media-src` and `img-src` so `VideoPreview.tsx` can load local videos via `file://` URLs on Windows. Audit confirmed `index.html` is the only HTML with a `<meta>` CSP — hub/studio/display inherit Electron defaults and `main.ts` injects no CSP headers. No other window files were changed.
- **2026-04-07 (feat)** — `electron/main.ts:385` `import-video` dialog extensions extended to include `dvr`, `mkv`, `m4v`. No new IPC channel — reuses the existing `import-video` handler. See `persistence-media-library` for the renderer-side preload=metadata change.
- **2026-04-07 (infra)** — `apps/desktop/package.json`: `naudiodon` removed from `postinstall` and `rebuild:native`. Loopback switched to Electron 29's `setDisplayMediaRequestHandler({ audio: 'loopback' })`. `better-sqlite3` rebuild remains.
- **2026-04-06 (session 25)** — Hub autoplay Promise rejection silenced via `.catch()`.
- **2026-04-06 (session 24)** — `electron/audio-loopback.ts` (new) — loopback IPC. `electron/main.ts` calls `setupLoopbackIpc()` on app ready. `components` import and `components.whenReady()` Widevine block removed. `package.json`: castlabs replaced with standard `electron@^29.4.6`. CSP `https://sdk.scdn.co` removed. (Initial implementation used naudiodon WASAPI; superseded 2026-04-07.)
- **2026-04-06 (session 23)** — Widevine via `components.whenReady()` API (now removed).
- **2026-04-06 (session 22)** — Widevine `appendSwitch` registration + CSP `worker-src` for AudioWorklet + `allowRunningInsecureContent: false`.
- **2026-04-05 (session 18)** — `run.vbs` fix: removed `npm install --prefer-offline` from chain.
- **2026-04-05 (session 7)** — Tool launcher: `vendor/binary-synth/`, `toolRegistry` Map, `vendorPath()` helper, `tool:launch` IPC handler with BrowserWindow creation, `toolWindows` Map cleanup on Hub close. `HubApp` "TOOLS" section with "BINARY SYNTH" button.
- **2026-04-05 (session 4)** — `createDisplayWindow()` and 5 Display IPC handlers commented out in `electron/main.ts`. F11 fullscreen shortcut commented out.

## Open Threads [coverage: medium — 1 source]

- Manual test: with Spotify connected and playing, click the "Enable Audio Reactivity" button in `SpotifyBrowser` (added session 25b) and verify the visualizer reacts. `getDisplayMedia` requires a user gesture, so activation is not automatic on OAuth auto-reconnect.
- Installer packaging is tabled — only when explicitly requested.

## Sources

- [[../../../.claude/memory/patterns/index]]
- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/context/active]]
