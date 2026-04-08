---
topic: Visualizer & Oscilloscope
last_compiled: 2026-04-07
status: active
---

# Visualizer & Oscilloscope

## Summary [coverage: high — 4 sources]

Visual ships two visualization systems running side-by-side in the Cockpit. **Butterchurn** is the main music visualizer — a Milkdrop-style preset engine — embedded inside the Cockpit's bottom-right panel (the original standalone Display window has been folded in and its code commented out). Butterchurn reads from the cockpit AnalyserNode and supports preset cycling, blend transitions, bass/mid/high reactivity sliders, drag, and fullscreen via the Fullscreen API. **LJV** is a 2D Lissajous oscilloscope used in both Cockpit and Studio. There is also an **XY Lissajous oscilloscope** in Studio that splits the analyser into L/R channels and draws the Lissajous pattern with fade trails. Canvas-based rendering uses pre-allocated buffers exclusively — allocating per frame caused performance issues that were tracked down across multiple commits.

## Architecture & Components [coverage: high — 4 sources]

- `components/cockpit/VisualizerPreview.tsx` — Butterchurn canvas in the cockpit panel, ResizeObserver, 30s preset cycle, 2.5s blend, fullscreen on hover, time-tracking render loop
- `components/cockpit/VisualizerControls.tsx` — preset selector, bass/mid/high reactivity sliders, blend time, cycle speed
- `components/cockpit/Oscilloscope.tsx` — canvas oscilloscope, ResizeObserver, `clearRect` per frame, `getByteTimeDomainData`, stroke `#27e0e1` 1.5px, ≤80 lines
- `components/synth/XYScope.tsx` — XY Lissajous, L/R split from analyser, fade trail, crosshair guides, 1:1 aspect ratio
- `assets/asset-types.d.ts` — butterchurn type declarations (`render(timestamp?: number, elapsedMs?: number): void`)
- `src/archive/visualizer-original/` — pre-fold original visualizer
- `src/archive/oscilloscopes-original/` — old XY/XYZ scopes (3D archived, revisit later)
- `src/archive/display-window-original/` — original standalone Display window code

The Butterchurn render loop multiplies elapsed time by an `animSpeedRef` to control speed without restarting the init effect.

## Decisions & Rationale [coverage: medium — 3 sources]

- **Fold Display window into Cockpit panel.** Reduces window count, keeps audio reactivity tight. Original Display window code commented out (not deleted) in `electron/main.ts` and archived under `src/archive/display-window-original/`.
- **3D oscilloscope deferred.** XY/XYZ 3D scopes archived to `src/archive/oscilloscopes-original/`, revisit later.
- **Speed control via elapsed-time multiplier, not setAnimationSpeed.** The npm `butterchurn` package has no `setAnimationSpeed` method — `viz.render(timestamp, (timestamp - lastTime) * animSpeedRef.current)` is the correct approach.

## Patterns & Gotchas [coverage: high — 5 sources]

- **Canvas perf requires pre-allocation.** Ring buffers and pre-allocated particle pools — never allocate in `requestAnimationFrame`.
- **Oscilloscope glow causes gray buildup.** Semi-transparent fade passes for phosphor/glow trails accumulate to gray instead of fading to black when alpha math doesn't converge to 0. Fix: explicit clear-to-black periodically, or clamp low alpha values to 0. Test fade trails visually before shipping.
- **Don't trust butterchurn type declarations blindly.** `setAnimationSpeed` was a phantom method declared in `asset-types.d.ts` but absent from the npm package. Removed.
- **Butterchurn audio reactivity needs the right analyser node.** Earlier sessions had bugs where the visualizer wasn't reading from the active source.
- **Black screen between presets** was a bug — fixed alongside drag and scrollbar/fullscreen issues.

## History & Changelog [coverage: high — 5 sources]

- **2026-04-05 (session 19)** — `VisualizerPreview.tsx` runtime crash fix: removed `viz.setAnimationSpeed` calls (method doesn't exist on npm butterchurn). Replaced `viz.render()` with time-tracking loop. Fixed `asset-types.d.ts`.
- **2026-04-05 (session 11)** — `synth/XYScope.tsx` introduced (XY Lissajous, L/R split, fade trail).
- **2026-04-05 (session 4)** — `createDisplayWindow()` and Display IPC handlers commented out in `electron/main.ts`. Butterchurn now runs inside Cockpit preview panel.
- **2026-04-05 (session 3)** — Cockpit redesign: `VisualizerPreview.tsx` and `VisualizerControls.tsx` introduced. Display window archived. Butterchurn integrated into 2x2 cockpit grid.
- **2026-04-05 (session 2)** — `Oscilloscope.tsx` rebuilt: canvas + ResizeObserver, `clearRect`, teal stroke.
- **2026-04-05** — Butterchurn 4-issue fix: audio reactivity, black screen between presets, drag, scrollbars/fullscreen.

## Open Threads [coverage: low — 1 source]

- 3D oscilloscope (XY, XYZ) — archived, revisit later.
- noise-craft and loop-drop-app integration — deferred.

## Sources

- [[../../../.claude/memory/patterns/index]]
- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/roadmap/priorities]]
