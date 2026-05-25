# AC-130 Thermal — Design Language

**Date**: 2026-05-25
**Status**: Adopted
**Theme**: `ac130-thermal`
**Reference**: `web/public/reference/AC130-reference.JPEG`,
`web/public/reference/ac130-reference-2.jpg`

## Concept

A military fire-control display. The user sits at the sensor
operator's station of an AC-130J Ghostrider gunship, watching MHEU
data through an L3Harris EO/IR turret. Every surface is rendered
as if drawn by a vector overlay generator on top of a sensor feed:
thin neon-green wire frames, monospaced bracketed labels, scan
lines, black void where there's no signal. Cold, exact,
weaponized — not playful, not warm, not glossy.

## Tone

- Brutally minimal in chrome: 1px wire frames, no fills, no
  rounded corners, no gradients except in the thermal waveform.
- Maximalist in information density: every corner has a HUD plate.
  Timestamps update live. Coords drift. Status flips.
- Cold and exact: deep void blacks, neon HUD green, occasional
  amber warning, rare IR red. White is reserved for active text.

## Color (resolves to `--ac-*` tokens)

**Voids** — `--ac-void` (#000), `--ac-panel` (#0A0E0A — 2% green
cast), `--ac-panel-dim` (#06080A).

**HUD green** — primary chrome, CRT phosphor:
`--ac-hud-green` #00FF41, `-bright` #5BFF89,
`-dim` rgba(0,255,65,0.55), `-wash` rgba(0,255,65,0.08).

**Amber** — advisory: `--ac-amber` #FFB000, `-wash` 0.10.

**IR red** — fire / danger: `--ac-ir-red` #FF2A1A,
`-bright` #FF6B5B. Reserved for the FIRE status pip + errors.

**Frame** — `--ac-frame-wire` rgba(0,255,65,0.45) for inactive
border, `--ac-frame-bracket` 0.85 for active.

**Thermal** (WaveformBar only, 5-stop grayscale): `--ac-thermal-cold`
through `--ac-thermal-white-hot` (#000 → #FFF). Maps amplitude to
emission.

**Scan + vignette** — `--ac-scanline` rgba(255,255,255,0.04) at
1px on / 3px gap; `--ac-vignette` radial 55%→65% black.

## Typography

**B612 Mono** (Airbus + ENAC cockpit-display font; disambiguated
glyphs are intentional, not stylistic). Fallback chain
`'B612 Mono' → 'Share Tech Mono' → 'HitmarkerText' → monospace`.
Loaded via Google Fonts `@import` with `display=swap`.

Sizes (px, monospace): 9 HUD micro (corner plates), 11 HUD small
(buttons / tabs), 13 HUD body (feed rows), 16 HUD large (section
headers), 28-32 Display (brand mark only).

ALL CAPS for chrome; normal case allowed only for user content
(usernames, song titles). Chrome brackets every code/label in
literal `[ ]`.

## Layout

- `--radius: 0`. Sharp corners forbidden anywhere else.
- 1px solid `var(--ac-frame-wire)` for inactive borders,
  `var(--ac-frame-bracket)` + `var(--ac-glow-green)` for active.
- Every interactive element wraps its label in literal `[ … ]`.
  Tabs: `[ M ]`. Buttons: `[ PLAY ]`. Status: `[ FIRE ACTIVE ]`.
- Corner brackets (4 L-shaped marks inset 4px from each panel
  corner) frame cards/dropdowns — `.ac-hud-frame--brackets`.
- 8/16/24/32px spacing grid. No 12 or 20px.

## Motion

Single shared RAF in `Decorations.tsx` at `FRAME_GATE = 33ms`
(30fps cap). Gated by `prefers-reduced-motion: reduce` (off
entirely) and `document.visibilityState === 'hidden'` (paused).

- Scan-line drift: Y 0→3px on a 10s linear loop.
- Timestamp tick: every ~33ms (shared RAF), display every 1s.
- Coordinate drift: ±0.001° per 3s tick, bounded ±0.01° from
  baseline.
- Status flicker: 1-in-20 chance per 2s tick to flicker `FIRE`
  off/on for 80ms.
- Thermal hot spots: 1-2 small white blobs every 8-15s on the
  void backdrop, 3s fade. Off on /m.
- Mobile (<600px): hot-spot count halved, drift interval doubled.

No spring easings. No bounce. Military gear doesn't bounce.

## Surface classes (defined in `theme.css`)

- `.ac-hud-frame` — wire-framed panel with scan lines. Used for
  ProfileDropdown body, GearMenu drawer.
- `.ac-hud-frame--brackets` — adds the 4 corner brackets.
- `.ac-wire-button` (+ `--danger`, `--amber`) — bracketed wire
  button. Hover brightens border + adds glow. Active inverts.
- `.ac-bracket-tab` — nav tab; active state takes `--user-accent`.
- `.ac-hud-text` (+ `--dim`, `--micro`, `--small`, `--glow`) —
  monospace caps with letter-spacing.
- `.ac-thermal-bar` — WaveformBar container, grayscale-only.

## Persistent HUD overlays (`Decorations.tsx`)

Always visible (faded to ~20% opacity on /m):

- Top-left plate: live UTC timestamp (`DDMMMYYYY AVT / HH:MM:SS UTC`),
  mode (`WHOT`), offset (`+0.0`).
- Top-right plate: lat/lon (session-seeded baseline + bounded
  drift), `ALT XXXXX FT`, `LOS XXX°`.
- Top-center compass tape: 9 ticks centered on heading (desktop).
- Bottom-right status: `FIRE: ACTIVE` (occasional flicker),
  `LASER: 1111`, `BORE: VALID`, `SEE: VALID`.
- Bottom-left: `N: OFF — DISARM`.
- Bottom-center (desktop): `L1514 RDY · HH:MM:SS`.
- Scan lines + vignette: full-screen, low alpha.

## User accent integration

Per-user accent (`--user-accent` / `--user-accent-glass`) is
intentionally suppressed in the AC-130 vocabulary — the HUD is
uniform; an arbitrary accent would break the gunship illusion.
Accent appears subtly in:

1. Avatar border (NavBar + ProfileDropdown).
2. Active nav tab frame (border + text color).
3. SocialFeedRow `@username` color.
4. Focus rings inside `.ac-hud-frame` (`:focus` ring uses
   `var(--user-accent, var(--ac-frame-bracket))`).

Everywhere else stays uniform green/amber/red.

## NOT recolored by user accent

- All HUD overlay plates (timestamp, coords, status, compass).
- All wire frames + panel borders.
- All `[ bracket ]` marks.
- Magnitude badges (semantic green for up, amber for down).
- WaveformBar (grayscale only).
- Reticle / crosshair (white).
- FIRE status indicator (red).

## What this theme is NOT

- Not playful. No bounce, no spring, no friendly copy.
- Not gradient-heavy. The only gradient is the thermal mapping
  in the WaveformBar.
- Not generic monospace styling — every chrome element traces
  back to Reference 1 (color HUD) or Reference 2 (thermal IR).
- Not a "matrix code" theme. No falling characters, no random
  hex dumps. Motion is bounded and deliberate.

## Why this works

1. **Distinctive**: nothing else in MHEU looks like this. Frutiger
   Aero is glossy/wet, Asian Vibrant is warm/painted, AC-130 is
   cold/exact — three distinct moods.
2. **Coherent**: every element traces back to a reference image.
3. **Functional**: bracketed labels make every interactive element
   obvious. Monospace caps reads from across the room.
4. **Restrained**: bounded motion, tight palette (3 chromatic
   colors + grayscale).
5. **Defensive**: reduced-motion + visibility gates, RAF-throttled,
   mobile-degraded.
