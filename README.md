# VISUAL

> To run: double-click `run.bat`

A DJ cockpit / music visualizer desktop app with an 80s Miami neon aesthetic meets old aircraft cockpit.

## What is this?

VISUAL is a dual-window Electron app:
- **COCKPIT** — The main control interface. Load tracks, control playback, adjust effects via instrument-style dials and switches.
- **DISPLAY** — A borderless visualizer output window designed for a CRT or second monitor.

## Requirements

- **Node 18+**
- **ffmpeg** installed and on your PATH (required for future audio processing features)

## How to run

```bash
npm install
npm run dev
```

Both windows launch automatically. The DISPLAY window starts with a black screen and a pulsing VISUAL title.

## Project structure

```
/apps/desktop    — Electron + React + Vite + TypeScript app
/assets/clips    — Video clip assets (empty, add your own)
/assets/audio    — Audio assets (empty, add your own)
/docs            — Documentation
```

## Tech stack

See [docs/STACK.md](docs/STACK.md) for full stack documentation.
