# Decision: Paired accent tokens (`--user-accent` + `--user-accent-glass`)

**Date**: 2026-05-25
**Status**: Adopted

## Context

The per-user accent system originally exposed six CSS variables on
`:root`: `--accent-color`, `-bright`, `-dim`, `-bg` (alpha 0.08),
`-border` (0.40), `-glow` (0.30). These are written at runtime by
`applyAccentColor()` in `web/src/lib/accentColor.ts` from the user's
`profiles.accent_color` value and consumed across ~25 surfaces.

Two gaps surfaced in the polish pass:

1. **No solid-color variable.** Components that want the raw hex
   (badges, ring outlines, brand marks) had to read `--accent-color`,
   which is *itself* the solid color but is named identically to the
   whole family, making intent unclear at call sites.
2. **No translucent variable in the glass band (0.10-0.20α).**
   `--accent-color-bg` is 0.08 — too faint to read as an accent wash
   when layered over the dark frost base. `--accent-color-border` is
   0.40 — too saturated for a fill. Surfaces that wanted "a visible
   tint of the user's color on top of frosted glass" had no token to
   reach for.

## Decision

Emit two additional CSS custom properties from `applyAccentColor()`:

```ts
// web/src/lib/accentColor.ts
const GLASS_ALPHA = 0.15
root.setProperty('--user-accent',        hex)
root.setProperty('--user-accent-glass',  `rgba(${r}, ${g}, ${b}, ${GLASS_ALPHA})`)
```

Fallback values declared in every theme's `tokens.css` so the names
resolve even before `applyAccentColor()` runs:

```css
:root[data-theme='frutiger-aero'] {
  --user-accent:        var(--accent-color);
  --user-accent-glass:  rgba(0, 220, 200, 0.15);
}
```

The existing 5-variant API is preserved unchanged for backward
compatibility — ~25 files already reference `--accent-color*`.

## Glass alpha calibration (0.15)

Empirically tested values 0.10 / 0.12 / 0.15 / 0.18 / 0.25 layered
over `rgba(0, 20, 30, 0.55)` frost base:

- **0.10** — too faint; the accent reads as a hint, not a tint.
- **0.12** — visible on warm accents (red/gold) but disappears on
  cool accents over a dark-cyan base.
- **0.15** — visible across the full hue wheel without dominating
  the frost base. Glass still reads as glass.
- **0.18** — strong but starts to overpower the base on saturated
  accents.
- **0.25+** — surface stops reading as glass; the accent becomes the
  background color.

**0.15 picked.** Sweet spot between "visibly tinted" and "still
glass" across the supported accent palette.

## Layering pattern

CSS multi-background spec: comma-separated layers paint
**top-to-bottom**. The accent wash is layer 0; the base sits
underneath:

```css
background:
  linear-gradient(0deg, var(--user-accent-glass), var(--user-accent-glass)),
  rgba(0, 20, 30, 0.55);
```

The 0deg/identical-stop gradient is a "solid color via gradient" trick
so the layer is uniform without needing a `background-color` fallback
that would compete with the layered base.

## Surfaces using the pair

- `.glass-card`, `.glass-card-subtle`, `.stat-card` (MHEUShell.css)
- `--aero-nav-bg`, `--aero-fog-bg` (frutiger-aero/tokens.css)
- `GearMenu` side panel
- `Controls` (Spotify playback bar)
- `VisualizerPage` panelStyle (now-playing card, fullscreen button,
  gear button)

## Surfaces deliberately NOT recolored

Asian Vibrant theme-identity decorations carry the theme's stamp and
must not bend to per-user accent:

- Lacquer band (`--av-crimson-deep`)
- Paper cards (`.av-paper-card` — paper texture is the theme)
- Gold trim (`--av-gold*`)
- Dragon, cherry branches, sun disk, calligraphic watermarks
- Hanko stamps
- Gold plaque borders on expanded feed rows

These stay at theme-default tokens. The per-user accent paints only
the per-user moments (avatar border around their feed row, etc.),
which already use `event.accent_color` / `profiles.accent_color`
inline.

## Migration

None required. New tokens are additive. Old `--accent-color*` API
unchanged.
