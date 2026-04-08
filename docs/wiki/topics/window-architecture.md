---
topic: Window Architecture & IPC
last_compiled: 2026-04-07
status: active
---

# Window Architecture & IPC

## Summary [coverage: high — 4 sources]

Visual is an Electron 29 multi-window app. The original four-window layout (Hub, Cockpit, Display, Studio) has collapsed to three: **Hub** (splash + launcher + tools + tutorial), **Cockpit** (DJ + MP3 + visualizer + plugins + Spotify + video), and **Studio** (additive synth + sampler + beat pads). The standalone Display window has been folded into Cockpit's bottom-right panel — its code in `electron/main.ts` is commented out (not deleted) and prefixed with a `// DISPLAY WINDOW —` marker. IPC flows one-way: Cockpit → Display only (back when Display existed); Studio is isolated and doesn't talk to either. New cross-window features require new IPC channels in `main.ts` plus the relevant preload script. Tools (like Binary Synth) launch as additional BrowserWindows tracked in a `toolWindows` Map and cleaned up when Hub closes.

## Architecture & Components [coverage: high — 5 sources]

- `electron/main.ts` — main process, window factories (`createHubWindow`, `createCockpitWindow`, `createStudioWindow`, ~~`createDisplayWindow`~~), all IPC handlers, `toolRegistry`, `vendorPath()` helper, `tool:launch` handler with `toolWindows` Map
- `electron/preload-hub.ts` — exposes `launchTool(toolName)` and project bridges
- `electron/preload-cockpit.ts` — exposes Spotify, media, settings, project, audio loopback, video import bridges
- `electron/preload-studio.ts` — exposes project + sample dialog bridges
- `electron/spotify-auth.ts` — temp HTTP server on `127.0.0.1:8888` for OAuth callback
- `electron/audio-loopback.ts` — `setupLoopbackIpc()` registers the loopback IPC and wires Electron 29's `setDisplayMediaRequestHandler({ audio: 'loopback' })` so the renderer receives system audio output without any native module. (The earlier naudiodon WASAPI implementation was replaced 2026-04-07; `package.json` no longer lists naudiodon in `postinstall` / `rebuild:native`.)
- `vendor/binary-synth/` — bundled MIT-licensed open-source tool launched as a popup window
- `apps/desktop/run.vbs` — silent launcher; runs `npm run dev` directly (no `npm install` chain — that broke session 18)
- `apps/desktop/index.html` — CSP `<meta>` tag with `worker-src 'self' blob:` for AudioWorklet, `script-src` allows local

## Decisions & Rationale [coverage: high — 4 sources]

- **Fold Display window into Cockpit panel.** Reduces window count, simplifies IPC. Display window code commented out (not deleted) in `electron/main.ts` for archival.
- **Standard `electron@^29.4.6`, drop castlabs.** Session 24 (2026-04-06) — castlabs `electron-releases` was needed for Widevine/EME (Spotify Web Playback SDK). With SDK removed, standard Electron is enough.
- **One-way Cockpit → Display IPC.** Display never sends back. Studio is isolated. Any feature needing reverse or cross-window sync requires new IPC channels.
- **Tool launcher is a BrowserWindow popup.** Vendored open-source tools launch via `tool:launch` IPC, tracked in `toolWindows` Map, cleaned up on Hub close.
- **CSP must allow `worker-src 'self' blob:`** for Tone.js AudioWorklet. Added to `index.html` `<meta http-equiv="Content-Security-Policy">`.
- **`allowRunningInsecureContent: false`** explicitly set in cockpit `webPreferences` (security; was previously omitted).
- **`127.0.0.1` over `localhost`** for OAuth redirect — Spotify dashboard requires it.

## Patterns & Gotchas [coverage: high — 4 sources]

- **IPC is one-way Cockpit → Display.** Always was. Adding Display → Cockpit feedback or Studio sync requires new IPC channels in `main.ts` and the appropriate preload.
- **Renderer crash "bad IPC message reason 263"** — caused by `getUserMedia({chromeMediaSource:'desktop'})` in renderer. Fix: silent OscillatorNode fallback (session 25).
- **Hub autoplay Promise rejection.** Use `audio.play().catch(() => {})` not `try/catch` — the rejection from "play() interrupted by pause()" is async.
- **`run.vbs` silent failure.** `postinstall` script (`npx @electron/rebuild -f -w better-sqlite3`) was failing silently in the `&&` chain, blocking `npm run dev`. Fix: remove `npm install` from the chain, run dev directly.
- **CSP gotchas.** Tone.js AudioWorklet needs `worker-src 'self' blob:`. Spotify SDK formerly needed `https://sdk.scdn.co` in `script-src` (now obsolete with SDK removed).
- **Widevine `components.whenReady()`** must be awaited inside `app.whenReady()` — not via `appendSwitch`. Now removed alongside SDK.

## History & Changelog [coverage: high — 7 sources]

- **2026-04-07 (infra)** — `apps/desktop/package.json`: `naudiodon` removed from `postinstall` and `rebuild:native`. Loopback switched to Electron 29's `setDisplayMediaRequestHandler({ audio: 'loopback' })`. `better-sqlite3` rebuild remains.
- **2026-04-06 (session 25)** — Hub autoplay Promise rejection silenced via `.catch()`.
- **2026-04-06 (session 24)** — `electron/audio-loopback.ts` (new) — loopback IPC. `electron/main.ts` calls `setupLoopbackIpc()` on app ready. `components` import and `components.whenReady()` Widevine block removed. `package.json`: castlabs replaced with standard `electron@^29.4.6`. CSP `https://sdk.scdn.co` removed. (Initial implementation used naudiodon WASAPI; superseded 2026-04-07.)
- **2026-04-06 (session 23)** — Widevine via `components.whenReady()` API (now removed).
- **2026-04-06 (session 22)** — Widevine `appendSwitch` registration + CSP `worker-src` for AudioWorklet + `allowRunningInsecureContent: false`.
- **2026-04-05 (session 18)** — `run.vbs` fix: removed `npm install --prefer-offline` from chain.
- **2026-04-05 (session 7)** — Tool launcher: `vendor/binary-synth/`, `toolRegistry` Map, `vendorPath()` helper, `tool:launch` IPC handler with BrowserWindow creation, `toolWindows` Map cleanup on Hub close. `HubApp` "TOOLS" section with "BINARY SYNTH" button.
- **2026-04-05 (session 4)** — `createDisplayWindow()` and 5 Display IPC handlers commented out in `electron/main.ts`. F11 fullscreen shortcut commented out.

## Open Threads [coverage: medium — 1 source]

- Manual test: verify Electron native loopback starts on Spotify connect and that the visualizer reacts.
- Installer packaging is tabled — only when explicitly requested.

## Sources

- [[../../../.claude/memory/patterns/index]]
- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/context/active]]
