---
topic: UI Design System
last_compiled: 2026-04-07 (r8)
status: active
---

# UI Design System

## Summary [coverage: high — 5 sources]

The Visual UI is themed dark red + amber + teal, evoking "80s Miami neon + vintage Audi amber instruments + sci-fi cockpit + JDM anime edge." Colors, glows, and fonts are defined as CSS custom properties in `:root` (in `global.css`); components reference variables, never hardcoded values. The aesthetic palette: background `#010103`, borders `#7a0105`, gradient `#87150a → #eea91c`, oscilloscope lines `#27e0e1`, primary text `#eea91c`, secondary text `#87150a`. All numeric displays are editable text inputs with units (Hz, %, dB, BPM, ms). Tooltips are mouse-movement-reset (1500ms idle triggers), portal'd to `document.body`. Both Cockpit and Studio have guided tutorials with full-screen SVG mask overlays. Dials use vertical drag (not rotation) plus scroll wheel. The "MHEU" title font on the Hub splash is custom and untouchable; everywhere else uses fonts from the Hitmarker family. As of 2026-04-07, Hitmarker Text (Regular/Italic/Medium/Bold, WOFF2/WOFF) lives inside the Vite source tree at `apps/desktop/src/styles/fonts/HitmarkerText/` so the bundler actually emits hashed copies into `dist/assets/`; the untouched original at `apps/desktop/fonts/18082023_Hitmarker/` still holds the Condensed/Normal/Wide/VF families.

## Architecture & Components [coverage: high — 6 sources]

- `src/styles/global.css` — `:root` CSS variables, dialog styles, save flash, project status indicator
- `src/styles/cockpit.css` — Cockpit grid layout, panels, plugin rack, DJ styles, Spotify CSS (~350 lines), source indicator
- `src/styles/studio.css` — Studio frame, tab bar, sample editor, waveform, beat pad grid
- `src/styles/fonts.css` — `@font-face` declarations; `url()` paths are relative to this file and must resolve **inside** `apps/desktop/src/` for Vite to copy the files. Current paths: `./fonts/HitmarkerText/*.woff2` and `./fonts/SDGlitch.ttf`.
- `src/styles/fonts/HitmarkerText/` — the 8 Hitmarker Text face files (Regular/Italic/Medium/Bold × woff2+woff) that Vite actually bundles into `dist/assets/` as hashed artifacts (e.g. `HitmarkerText-Regular-APgbd4-k.woff2`).
- `components/shared/Tooltip.tsx` — mouse-movement-reset tooltip, centered horizontal positioning, viewport overflow clamping (bottom→top flip, L/R clamp), 150ms fade-in, portal to `document.body`
- `components/hub/HubTutorial.tsx` — 5-step Hub walkthrough, full-screen SVG mask cutout overlay
- `components/cockpit/CockpitTutorial.tsx` — 13-step Cockpit walkthrough
- `components/studio/StudioTutorial.tsx` — 12-step Studio walkthrough
- `components/cockpit/WaveformSlider.tsx` — canvas + transparent range input overlay; waveform amplitude scaled by volume; gradient `#87150a → #eea91c`
- `components/shared/Dial.tsx` — vertical-drag dial control (also scroll wheel)
- `apps/desktop/fonts/18082023_Hitmarker/` — original full tree: Display (Condensed, Normal, Wide, VF) and Text (TTF, VF, WOFF) variants. Left untouched as an archive — **not** referenced by bundled CSS anymore.

`data-tutorial-id` attributes target elements for tutorial walkthroughs. localStorage keys: `visual-tutorial-cockpit-viewed`, `visual-tutorial-studio-viewed`, plus Hub's flag.

## Decisions & Rationale [coverage: high — 4 sources]

- **CSS variables in `:root`, not hardcoded colors.** Components reference variables. Add new variables to `:root` if needed; never inline.
- **Dial = vertical drag, not rotation.** Drag up = increase. Scroll wheel also works. Keep this consistent for any new dial-like control.
- **Editable text inputs with units everywhere.** All numeric displays — Hz, %, dB, BPM, ms, st.
- **Tooltips on everything non-obvious.** Hard rule from `roadmap.md`.
- **No themes/colors until functionality is complete** (`priorities.md`). Aesthetic is applied last.
- **MHEU title font and animation are off-limits.** Hub splash custom font/animation are not to be touched. Everywhere else uses Hitmarker fonts.
- **Borders 1px solid `#7a0105`, no border-radius, no box-shadow on panels.** From session 2 cockpit rebuild. Plugin rack also got `border-radius: 0` in session 3 step 8.
- **Spotify branding stripped.** `.sp-connect-btn` recoloured dark-red bg + amber text. Spotify green `#1DB954` replaced with teal `#27e0e1` or amber everywhere except `.sp-connected__dot` (stays green).

## Patterns & Gotchas [coverage: high — 5 sources]

- **Vite only bundles assets referenced from *inside* `src/`.** `apps/desktop/vite.config.ts` has no `publicDir` set, so any `url()` in CSS that traverses out of `apps/desktop/src/` (e.g. `../../fonts/...`) is silently ignored — the CSS ships, the files do not. Symptom: `dist/assets/` contains the assets that *were* inside `src/` (e.g. `SDGlitch-*.ttf` from `src/styles/fonts/SDGlitch.ttf`) and silently omits everything else. Rule: any font/asset the app needs at runtime must live under `apps/desktop/src/` and be referenced with a path that stays inside `src/`. Mirror the working SDGlitch pattern (`./fonts/FooFamily/file.woff2` from `fonts.css`).
- **CSS design system in `:root` variables.** Always reference variables. Adding new colors? Add a variable.
- **Dial interaction = vertical mouse movement.** Never circular rotation gestures.
- **Tooltip viewport overflow.** Tooltip clamps to viewport: bottom → top flip, L/R clamp. Don't bypass the portal — it's there to escape parent `overflow:hidden`.
- **Responsive layout — `box-sizing: border-box`.** Studio frame `100vw + padding` was overflowing. Always use border-box.
- **`overflow:hidden` on containers, not `overflow:auto`.** `overflow:auto` was creating unwanted scrollbars in Studio. Stick to hidden unless a specific scroll region is needed (then make that region explicit).
- **Plugin rack scroll isolation.** `onWheel stopPropagation` so wheel events scroll the rack, not the cockpit body.
- **Bottom bar height was 56px → 48px** in session 3.
- **Save flash + project status indicator** styles live in `global.css`.

## History & Changelog [coverage: high — 6 sources]

- **2026-04-07 (commit `3c96d40`)** — Hitmarker Text fonts now actually bundled. Root cause: `fonts.css` pointed at `../../fonts/18082023_Hitmarker/Text/WOFF/...`, which exits `apps/desktop/src/`; with no `publicDir` configured, Vite silently dropped the files on the floor. Pre-fix `dist/assets/` had `SDGlitch-*.ttf` but **zero** Hitmarker artifacts. Fix: copied the 8 referenced Text WOFF files (Regular/Italic/Medium/Bold × woff2+woff) into `apps/desktop/src/styles/fonts/HitmarkerText/` and rewrote `fonts.css` `url()` paths to `./fonts/HitmarkerText/` (mirroring SDGlitch). `npx vite build` then emitted hashed copies (e.g. `HitmarkerText-Regular-APgbd4-k.woff2`); `npx tsc --noEmit` clean. Original `apps/desktop/fonts/18082023_Hitmarker/` tree left in place as an archive of the Condensed/Normal/Wide/VF families.
- **2026-04-05 (session 14+)** — Spotify CSS (~350 lines): settings, tabs, badge, browser, now-playing, controls, playlists/tracks. Spotify green replaced with app teal/amber.
- **2026-04-05 (session 15)** — `CockpitTutorial.tsx` and `StudioTutorial.tsx` added. 13-step and 12-step walkthroughs. SVG mask cutout overlays. `data-tutorial-id` attributes added across components. "?" buttons in bottom bars (28px circle, amber/pink themed).
- **2026-04-05 (session 12)** — Responsive cleanup: removed inline sidebar styles, plugin rack collapse 260 → 36px with transition.
- **2026-04-05 (session 10)** — Tooltip system rewritten: mouse-movement-reset, centered positioning, viewport clamping, 150ms fade, portal to `document.body`. Tooltips added across Cockpit (PluginRack, VisualizerControls, DeckChannel, DJDecks, VideoFiles) and Studio (OscillatorLayer, SampleControls, BeatPads, StudioApp). `HubTutorial.tsx` added.
- **2026-04-05 (session 3)** — Cockpit redesign: 2x2 grid, `border-radius: 0` on plugin rack/panel/buttons, bottom bar 56 → 48px. `WaveformSlider.tsx` added.
- **2026-04-05 (session 2)** — Cockpit color palette retheme: dark-red + amber + teal. `cockpit.css` rewritten. Borders 1px solid `#7a0105`, no box-shadow on panels.
- **2026-04-05** — Hub splash button cleanup: icons removed, font changed from `'SD Glitch'` to `'Inter', sans-serif`.

## Open Threads [coverage: medium — 2 sources]

- **Hitmarker Text faces are now bundled; Display faces are not yet wired up.** The 2026-04-07 fix only copied the 4 Text weights (Regular/Italic/Medium/Bold) into `src/styles/fonts/HitmarkerText/`. Hitmarker Display (Condensed/Normal/Wide/VF) is still sitting unreferenced in `apps/desktop/fonts/18082023_Hitmarker/`. If a future task needs Display weights in the running app, copy them inside `src/styles/fonts/` and add matching `@font-face` entries — do not `url()` out of the source tree. MHEU title font/animation remain off-limits per roadmap.
- **Apply Hitmarker fonts everywhere except the MHEU title** (from `roadmap.md`). The bundling is no longer a blocker — remaining work is CSS/usage, not infrastructure.

## Sources

- [[../../../.claude/memory/patterns/index]]
- [[../../../.claude/memory/progress/changelog]]
- [[../../../.claude/memory/roadmap/roadmap]]
- [[../../../.claude/memory/roadmap/priorities]]
- [[../../../.claude/memory/context/active]]
