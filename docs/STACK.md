# VISUAL — Tech Stack

## Core Framework

| Layer | Technology | Why |
|-------|-----------|-----|
| Desktop shell | **Electron 29** | Cross-platform native windows, IPC, file system access, and the ability to move a borderless window to a second monitor. |
| UI framework | **React 18** | Component model maps cleanly to instrument panels; hooks handle local state for dials, toggles, transport. |
| Build tool | **Vite 5** | Sub-second HMR in dev, fast ESM builds, first-class TS support. Works well with `vite-plugin-electron`. |
| Language | **TypeScript 5** | Type safety across the main/renderer/preload boundary prevents the class of runtime errors that are hardest to debug in Electron. |

## Electron Architecture

- **Main process** (`electron/main.ts`) — creates both windows, registers IPC handlers, manages app lifecycle.
- **Preload scripts** (`electron/preload-cockpit.ts`, `electron/preload-display.ts`) — expose a typed `window.api` surface via `contextBridge`. `nodeIntegration` is off on both renderers.
- **Renderer processes** — two separate Vite entry points: `index.html` (Cockpit) and `display.html` (Display).

## Styling

- **CSS custom properties** — all neon colors, glow box-shadows, panel borders defined as variables in `global.css`.
- **Google Fonts** — VT323 (display/readout text), Share Tech Mono (data labels), Inter (readable UI).
- **No CSS-in-JS** — plain CSS modules + a global stylesheet. Keeps the bundle lean and avoids runtime style injection overhead.

## Audio (planned)

- **Web Audio API** — for waveform rendering and real-time FFT analysis in the renderer.
- **ffmpeg** (native CLI) — invoked via Electron's main process for format conversion and clip extraction.

## Dev tooling

- `vite-plugin-electron` — runs the Electron main process through Vite's dev server so hot-reload works across both processes.
- `electron-builder` — packaging and distribution.
- `concurrently` — runs Vite dev server and Electron watcher in parallel.

## Why not Tauri / NW.js / etc.?

- **Tauri** would require Rust for the backend. The team is JS/TS-first and audio tooling (Web Audio, ffmpeg) integrates more naturally with Node.
- **NW.js** has a smaller ecosystem and `nodeIntegration` on by default (a security concern for a media app that opens arbitrary files).
- **Electron** remains the most mature option for a rich desktop UI with direct file system access and multi-monitor window management.
