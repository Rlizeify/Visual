---
topic: Plugin Effects System
last_compiled: 2026-04-07
status: active
---

# Plugin Effects System

## Summary [coverage: high — 4 sources]

Visual has a file-per-plugin effects architecture under `src/plugins/`. Six effects ship pre-loaded in the Cockpit's plugin rack: Compressor, EQ, Delay, Reverb, Chorus, Distortion. Plugins implement the `MHEUPlugin` interface and self-register on import via `pluginRegistry.ts`. The `PluginChain` class owns an ordered plugin array and rewires Web Audio connections on every mutation; bypassed plugins are routed around (not disconnected). The chain is inserted between Tone.js's chorus output and `ctx.destination`. The rack UI lives in a 260px sidebar with collapsible panels — each `PluginPanel` reads `getParams()` and renders label + number input + range slider per param plus a BYPASS toggle.

## Architecture & Components [coverage: high — 5 sources]

- `plugins/MHEUPlugin.ts` — interface, `ParamDescriptor` type, `MHEUPluginConstructor` type
- `plugins/PluginChain.ts` — ordered plugin array, `addPlugin/removePlugin/movePlugin/setBypass`, rewires on mutation
- `plugins/pluginRegistry.ts` — Map-based registry, `registerPlugin/getRegisteredPlugins`, side-effect imports
- `components/cockpit/PluginRack.tsx` — 260px fixed-width sidebar, collapsible header, scrollable chain (`overflow-y auto`, `onWheel stopPropagation`), auto-loads all 6 plugins on mount, ADD PLUGIN hidden when 6 loaded
- `components/cockpit/PluginPanel.tsx` — generic UI: 40px header, 8px L/R padding, 4px param gap, 52px number input, controlled `collapsed` state lifted to PluginRack
- `effects/Compressor.ts` — `DynamicsCompressorNode`, 5 params (threshold, ratio, attack, release, knee), bypass via passthrough GainNode
- `effects/EQ.ts` — 3 `BiquadFilterNode`s in series (lowshelf, peaking, highshelf), 7 params, bypass routes around all filters
- `effects/Delay.ts` — `DelayNode` + feedback `GainNode` loop + wet/dry, bypass sets wet=0/dry=1 without disconnecting
- `effects/Reverb.ts` — `ConvolverNode` with offline-generated impulse response (white noise × exponential decay), rebuilds impulse async on `roomSize`/`decay` change
- `effects/Chorus.ts` — `DelayNode` (20ms center) + LFO `OscillatorNode` → depth gain → `delay.delayTime`
- `effects/Distortion.ts` — `WaveShaperNode` with sigmoid soft-clip curve (4× oversample) + highpass + output gain

## Decisions & Rationale [coverage: high — 4 sources]

- **File-per-plugin architecture.** Hard rule from `priorities.md` and `roadmap.md` — one job per file, max 150 lines.
- **Self-registration on import.** Avoids a central manifest. Each effect file calls `registerPlugin(...)` at module load; the entry point just imports the file for side effects.
- **Bypass via routing, not disconnection.** Bypassed plugins remain in the graph; their wet/dry mix is set to pass-through. Avoids click artifacts and Web Audio re-connection cost.
- **Pre-load all 6, bypassed and collapsed.** Removed manual `addPlugin` calls from `AudioEngine` constructor; `PluginRack` does it on mount. ADD PLUGIN button hidden when 6 plugins loaded.
- **Plugin chain insertion point.** AudioEngine disconnects Tone chorus from `Tone.getDestination()`, inserts `PluginChain` between chorus and `ctx.destination`. `audioEngine.getPluginChain()` exposes it.
- **WAM (Web Audio Modules) deferred.** Will register through the same `pluginRegistry`. Revisit when effects expand.

## Patterns & Gotchas [coverage: medium — 2 sources]

- **`Float32Array<ArrayBuffer>` cast for TS strict.** Distortion's `WaveShaperNode.curve` needs the explicit generic to satisfy strict TypeScript.
- **Convolver impulse rebuild is async.** Reverb regenerates the impulse via OfflineAudioContext when `roomSize` or `decay` changes — don't expect synchronous param updates.
- **Plugin rack scroll isolation.** `PluginRack`'s chain div uses `onWheel stopPropagation` so wheel events scroll the rack instead of the cockpit body. Overflow setting was changed from `hidden` to `visible` for wheel scrolling.
- **150-line file limit applies to plugins too.** No plugin file should exceed it.

## History & Changelog [coverage: high — 4 sources]

- **2026-04-05 (session 5)** — Plugin rack layout: 260px hard-walled sidebar, header flex-shrink 0, chain scrolls independently, removed reorder arrows and per-slot remove button. Panel header 40px, label-on-own-line, BYPASS always visible. Cockpit sidebar locked to 260px width/min/max. Built and pushed (`a4afc7f`).
- **2026-04-05 (session 3, STEP 6)** — Plugin rack preload: `PluginRack` auto-loads all 6 on mount, each bypassed + collapsed, ADD PLUGIN hidden when 6 loaded. Collapsed state lifted to PluginRack (controlled). `AudioEngine` constructor no longer calls `addPlugin`.
- **2026-04-05** — Reverb/Chorus/Distortion added. Three side-effect imports added to `pluginRegistry.ts`.
- **2026-04-05** — Compressor/EQ/Delay added. AudioEngine inserts PluginChain between Tone chorus and destination. Cockpit grid template updated to `52px 1fr auto 52px` to fit the rack row.
- **2026-04-05** — Plugin architecture foundation: `MHEUPlugin.ts`, `PluginChain.ts`, `PluginPanel.tsx`, `PluginRack.tsx`, `pluginRegistry.ts`.

## Open Threads [coverage: low — 1 source]

- WAM (Web Audio Modules) standard — deferred, revisit when effects expand.

## Sources

- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/roadmap/priorities]]
- [[../../../.claude/memory/patterns/index]]
