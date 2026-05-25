# AC-130 Thermal — archived stub

Archived 2026-05-25 when the full theme replaced the stub. The stub
was a single full-screen "coming soon" plate with scan-line overlay,
a bracketed `[ FLIR / WH ]` header, and a back-to-Frutiger-Aero
escape button. All surface components returned `null` (NullStub).

The aesthetic vocabulary established by the stub — black void,
white-on-black monospace, bracketed labels, scan lines, sharp 0-radius
corners — was preserved and extended in the full build. The stub
itself is no longer reachable from the theme switcher.

Files:
- `index.ts` — manifest with `NullStub` for every surface.
- `shell.tsx` — full-screen overlay with title, subtitle, back button.
- `tokens.css` — white-on-near-black token fallback.
- `components/stubs.ts` — `NullStub = () => null`.

See `web/src/themes/ac130-thermal/` for the current implementation
and `.claude/memory/decisions/ac130-thermal-design-language.md` for
the design language.

---

## Original intent notes (preserved)

- White-hot FLIR camera HUD. Pure grayscale on near-black substrate.
- All chrome rendered as brackets, crosshairs, ranging numbers.
- Hard-edged rectangles. `--radius: 0` everywhere.
- Scan-line overlay (1px on / 2px off) at low alpha across everything.
- Display font: a stencil or military-spec mono.
- Body font: monospace.
- Motion: jittery one-frame nudges. Crosshair tracking on hover.
- Decorative: corner brackets `[ ]`, `+--+`, "DISTANCE", "ALT", "WIND" labels.
