# AC-130 Thermal

Stub theme. Intended aesthetic:

- White-hot FLIR camera HUD. Pure grayscale on near-black substrate.
- All chrome rendered as brackets, crosshairs, ranging numbers.
- Hard-edged rectangles. `--radius: 0` everywhere.
- Scan-line overlay (1px on / 2px off) at low alpha across everything.
- Display font: a stencil or military-spec mono.
- Body font: monospace.
- Motion: jittery one-frame nudges. Crosshair tracking on hover.
- Decorative: corner brackets `[ ]`, `+--+`, "DISTANCE", "ALT", "WIND" labels.

When this theme is built out, the placeholder shell goes away and each
surface in `components/` is replaced with a real React component.
