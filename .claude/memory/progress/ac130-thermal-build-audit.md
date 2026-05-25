## AC-130 Thermal — Build Audit (PART 1)

Date: 2026-05-25. Author: Claude. Status: complete.

### Goal

Replace the AC-130 Thermal stub with a full theme on the same
structural contract as Frutiger Aero and Asian Vibrant, while
honoring the L3Harris gunship reference imagery at
`web/public/reference/AC130-reference.JPEG` and
`web/public/reference/ac130-reference-2.jpg`.

### Current stub (what we are replacing)

`web/src/themes/ac130-thermal/`:

- `index.ts` — manifest with `NullStub` for every surface component;
  the shell renders the whole UI as a "coming soon" plate.
- `shell.tsx` — fixed full-screen `#0a0a0a` panel, centered. Uses
  `HitmarkerText, monospace`. Renders `[ FLIR / WH ]` bracketed
  header (11px, 0.3em tracking, 60% white), title `AC-130 THERMAL`
  (32px, 300 weight, 0.3em tracking, pure white), subtitle
  "Theme coming soon." (13px, 0.15em tracking, 70% white). One wire-
  frame button (transparent bg, 1px rgba(255,255,255,0.4) border, 11px,
  0.12em tracking) reading `BACK TO FRUTIGER AERO`. Scan-line overlay
  is a `repeating-linear-gradient(to bottom, rgba(255,255,255,0.04)
  0 1px, transparent 1px 3px)` on a `position:absolute inset:0`
  layer. Radius 0 (sharp corners).
- `tokens.css` — white-on-near-black accents; `--color-bg: #0a0a0a`,
  `--font-ui: 'HitmarkerText', monospace`, `--radius: 0px`. Already
  emits the `--user-accent` / `--user-accent-glass` pair.

These are the only visual cues we must preserve. Everything else in
the new build extends from them.

### Reference imagery findings

**Reference 1 (`AC130-reference.JPEG`)** — color HUD, daylight LLLTV
trainer screen on a 4:3 CRT:

- Dominant chrome: thin neon-green vector lines and text in monospace,
  pure white reticle pip, single red center dot.
- Top-left HUD column: date `10AUG2025 AVT`, time `15:19:17`, range
  `USER+0.0`, plus a vertical compass tape (`030 N 060`...) and an
  altitude tape on the right.
- Top-right HUD: lat/lon coordinates (`N 32°06.2'...` format),
  altitude `1234 FT`, slant-range readout.
- Bottom-right status block: `FIRE ACTIVE / 1111 BORE VALID / OFF
  NONE / SEE VALID` stacked in a 4-line monospace plate.
- Bottom-left: `N : OFF — DISARM` in green.
- Center: cross-hair reticle (thin white) with concentric range
  rings, all 1px wire.
- Scan lines: visible at full-image scale, very fine, low contrast.
- Vignette: noticeable corner falloff; CRT-style softened edges.

**Reference 2 (`ac130-reference-2.jpg`)** — black/white thermal IR
("WHOT" white-hot mode):

- Background: full grayscale aerial of terrain, no chroma.
- Right edge vertical letter column: `N S F Q Z TGT` stacked.
- Left edge stack: `RAY FF 30 LIR`, `BORE`, `25 mm`, `40 mm`, `105 mm`.
- Top-right marker: `WHOT` (white-hot mode indicator).
- Center: small crosshair, lat/lon, range, target ID.
- Bottom: small green dialog overlay "AC-130 Navigator:..." +
  `L1514 RDY  00:06` timer.

**Synthesis for the build**:

- The MHEU UI uses the **color HUD** vocabulary (Reference 1) for
  chrome — green/white/red against deep black — because it
  communicates more semantic meaning per surface.
- The **WHOT thermal** treatment (Reference 2) is reserved for the
  WaveformBar and any "imagery"-shaped surface — a true grayscale
  band where white = hot.
- Persistent decorations: bracketed header text, scan lines, corner
  HUD plates, optional reticle, fine vignette.

### Component map — what gets built

From `web/src/themes/types.ts` (already inventoried), the theme
contract requires these surfaces. AC-130 builds:

| Surface | Strategy |
|---|---|
| `shell` | Full-route override no longer needed — the shell now just renders the standard React tree. Keep a thin shell that returns `<DashboardShell>` semantics or set `shell: undefined`. |
| `DashboardShell` | Black void backdrop + `<Decorations />` with HUD overlays, scan lines, vignette. |
| `NavBar` | 56px black bar, green wire-frame tab brackets `[ M ]`, profile icon top-left as monochrome wire glyph. |
| `ProfileDropdown` | "DEBRIEF" plate — black panel, green wire borders, monospace caps, same fields as Frutiger Aero (avatar, accent picker, score visibility, theme switcher, Spotify disconnect, sign out). |
| `MTab` | Returns `null` (visualizer shows through). |
| `HTabPlaceholder` | "HEALTH — OFFLINE" in HUD frame. |
| `ETabPlaceholder` | "ENTERTAINMENT — STANDBY" in HUD frame. |
| `UTab` | Full social-feed UTab — green HUD chrome, monospace, monochrome rows. |
| `PlaybackControls` | Bottom playback bar styled as a weapons-station mini-panel. Wire-frame buttons, no fills, green text. |
| `GearMenu` | Side panel as ammo-bay drawer: black bg, green wire borders, monospace labels. Same fields/behavior as Frutiger Aero gear menu. |
| `WaveformBar` | Thermal white-hot oscilloscope: grayscale fill, no green chrome, white-hot peak. |
| `SocialFeedRow` | HUD log entry: timestamp prefix, monospace, magnitude badge as `[+12]` / `[-04]` brackets. |

### Reference themes

- `web/src/themes/frutiger-aero/components/*` — canonical structural
  reference. `NavBar.tsx` lays out the 56px top bar + profile-left
  pattern. `ProfileDropdown.tsx` (17.7KB) is the most complex
  component and we mirror its data flow exactly. `DashboardShell`
  uses an `Outlet` + fog overlay; we replace fog with HUD chrome.
- `web/src/themes/asian-vibrant/components/*` — canonical
  *decorative* reference. `Decorations.tsx` (45.5KB) is the pattern
  to follow for HUD overlays: a single shared RAF, `useReducedMotion`,
  `useDocumentVisible`, `FRAME_GATE = 33ms`, mobile/viewport gating.

### Defensive infrastructure already in place

- `ThemeErrorBoundary` at provider level catches any throw inside
  theme components and falls back to Frutiger Aero with a session-
  local blocklist (`web/src/themes/ThemeContext.tsx`). Safe to ship
  even if the theme has a runtime bug — only the user choosing it is
  affected.
- `applyAccentColor()` (`web/src/lib/accentColor.ts`) writes the full
  `--accent-color*` family + the `--user-accent` / `--user-accent-glass`
  pair. New theme must declare fallback values in `tokens.css`.
- `web/src/archive/asian-vibrant-stub/` is the precedent for archiving
  a prior stub — we will mirror it as `ac130-thermal-stub/`.

### Token requirements (drives PART 5)

The build needs 15+ named tokens under the `--ac-*` prefix:

- Voids: `--ac-void`, `--ac-panel`, `--ac-panel-dim`.
- HUD: `--ac-hud-green`, `--ac-hud-green-bright`, `--ac-hud-green-dim`,
  `--ac-hud-green-wash`.
- Warning: `--ac-amber`, `--ac-amber-wash`.
- Hot: `--ac-ir-red`, `--ac-ir-red-bright`.
- Scan: `--ac-scanline`, `--ac-scanline-strong`.
- Thermal: `--ac-thermal-cold`, `--ac-thermal-mid`, `--ac-thermal-hot`,
  `--ac-thermal-white-hot` (white-hot mode gradient stops).
- Frame: `--ac-frame-wire`, `--ac-frame-bracket`.
- Typography: `--ac-font-mono`, `--ac-font-display`.
- Shadows + vignette: `--ac-vignette`, `--ac-glow-green`.
- Plus the shared contract: `--color-bg`, `--color-panel-bg`,
  `--color-panel-border`, `--color-secondary`, `--color-error`,
  `--font-ui`, `--radius`, `--row-tint*`, `--color-success*`,
  `--color-danger*`, and the `--accent-color*` + `--user-accent*`
  pair (the per-user accent only shows up subtly on focus borders +
  the active nav tab frame).

### Fonts

Google Fonts `@import` for **B612 Mono** (the official font of EUROCAE
aviation HMI ED-241, used in cockpit displays). Fallback chain:
`'B612 Mono', 'Share Tech Mono', 'HitmarkerText', monospace`. Display
variant (for the AC-130 brand mark) uses the same family at heavier
weight + wider tracking — no separate display family.

### Files to create

```
web/src/themes/ac130-thermal/
├── index.ts                  (rewrite — wire real components)
├── shell.tsx                 (delete — no longer needed; or keep a no-op)
├── theme.css                 (new — surface classes: .ac-hud-frame,
│                              .ac-wire-button, .ac-bracket-tab, ...)
├── tokens.css                (rewrite — full token set)
└── components/
    ├── Decorations.tsx       (HUD overlays + scan lines + vignette)
    ├── DashboardShell.tsx
    ├── NavBar.tsx
    ├── ProfileDropdown.tsx
    ├── MTab.tsx              (returns null)
    ├── HTabPlaceholder.tsx
    ├── ETabPlaceholder.tsx
    ├── UTab.tsx
    ├── PlaybackControls.tsx
    ├── GearMenu.tsx
    ├── WaveformBar.tsx
    ├── SocialFeedRow.tsx
    └── stubs.ts              (delete — no longer needed)
```

Archive: move current `shell.tsx`, `index.ts`, `tokens.css`,
`README.md`, `components/stubs.ts` to
`web/src/archive/ac130-thermal-stub/`.

### Audit conclusion

All structural data is mapped. All defensive infrastructure is in
place. The build can proceed.
