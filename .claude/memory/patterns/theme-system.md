# Theme System — Architecture Pattern

**Observed**: 2026-05-23, theme-system foundation.
**Pattern**: Feature shells define structure / behavior / data;
themes define presentation. Themes are siblings, not deviations
from a baseline. Frutiger Aero is one theme, not "the default look".

## Where themes live

```
web/src/themes/
  types.ts             # ThemeManifest, ThemeSurfaces contract
  registry.ts          # imports all manifests, exports `themes` map
  ThemeContext.tsx     # <ThemeProvider> + useTheme()
  frutiger-aero/
    tokens.css         # :root[data-theme='frutiger-aero'] tokens
    shell.tsx          # whole-app wrapper (pass-through here)
    index.ts           # default-export the manifest
    components/        # one file per ThemeSurfaces key
  asian-vibrant/       # stub theme
  ac130-thermal/       # stub theme
```

## How a feature consumes a theme

```ts
const { theme } = useTheme()
const NavBar = theme.components.NavBar
return <NavBar />
```

Feature shells (e.g. `MHEUShell.tsx`, `EntertainmentTab.tsx`,
`HealthTab.tsx`) hold zero presentation. Each is a single line that
pulls its surface from `useTheme().components` and renders it.

## How a theme is registered

1. `web/src/themes/<id>/index.ts` default-exports a `ThemeManifest`
   with `id`, `name`, `description`, `shell`, and `components` for
   every key in `ThemeSurfaces`.
2. Import the manifest in `web/src/themes/registry.ts` and add it to
   the `themes` map (order = order in the theme switcher).
3. Add the new id to the CHECK constraint on `profiles.theme_id` in a
   new Supabase migration.

## How to add a new feature surface (cross-theme)

1. Add a key + signature to `ThemeSurfaces` in `web/src/themes/types.ts`.
2. Add a component file under `web/src/themes/frutiger-aero/components/`
   (the real implementation).
3. Add a stub (re-export `NullStub` or a small placeholder) in every
   other theme's `components/` folder.
4. Wire the consumer site to `useTheme().components.<Surface>`.

## Stub theme convention

Stub themes (AC-130 Thermal as of 2026-05-24) implement the full
contract but their `shell` renders a centered "coming soon" plate
and ignores `children`. Every `components/*` value is a `NullStub`
because the shell takes over the viewport. The stub MUST include a
back-button that calls `setTheme('frutiger-aero')` so users who pick
the stub aren't stranded — the profile dropdown is not rendered
while a stub is active.

When a stub theme is built out into a real theme, archive the
`shell.tsx` and `stubs.ts` to `web/src/archive/<id>-stub/` with a
short README. Asian Vibrant did this on 2026-05-24.

## Decorative-layer convention (full themes)

For ambient theme decorations (Asian Vibrant: rice paper, ink-wash
mountains, scrolling kanji, drifting petals, periodic dragon):

- A single `components/Decorations.tsx` file holds every layer.
- Mount the bundle once from `DashboardShell` with a `showBackdrop`
  prop that hides the full-canvas backdrop on `/m` (the visualizer
  covers it) while keeping ambient overlays.
- Every animation MUST respect `prefers-reduced-motion` (hook:
  `useReducedMotion()`) and `document.visibilityState === 'hidden'`
  (hook: `useDocumentVisible()`). Reduced motion shows static
  alternates; hidden tabs pause RAF.
- RAF loops gate to ~30fps via `FRAME_GATE = 33ms` accumulator.
  Single-SVG paths preferred over per-element DOM updates.
- Mobile (<600px viewport) reduces element counts (kanji 4→2,
  petals 8→4) and doubles intervals (dragon 60–90s → 120–180s).
- Decorative z-index stack: backdrop layers 40–47, nav 1000,
  dropdowns 1100+.

## Font loading convention

Web-font themes (Asian Vibrant: Ma Shan Zheng + Noto Serif SC) load
fonts via a single `@import url(...)` at the top of `tokens.css`.
This keeps the theme's typography opt-in (fonts only fetch when the
theme is active and its CSS is imported by `index.ts`).

## Animation throttling reference

The Asian Vibrant Decorations file is the reference for throttled
ambient animation in this codebase. Copy its `useReducedMotion`,
`useDocumentVisible`, and FRAME_GATE pattern when adding new
decorative layers.

## Persistence

- Active theme persists in `public.profiles.theme_id` (text, default
  `'frutiger-aero'`, CHECK constrained to registered ids).
- `ThemeContext` writes back fire-and-forget on `setTheme`; UI swaps
  immediately.
- Local-storage cache (`mheu_theme_id`) avoids a flash of the wrong
  theme on first paint before the profile loads.

## Token discipline

- Every theme provides the same set of token names under
  `:root[data-theme='<id>']`. The base set is whatever Frutiger Aero
  exposes (color, font, radius, magnitude colors, row tints).
- `web/src/styles/tokens.css` ships the Frutiger Aero defaults on plain
  `:root` as a first-paint fallback.
- Themes MAY add theme-only tokens (e.g. `--aero-glass-blur`); other
  themes leave those undefined and consumers must `var(--x, fallback)`.
- All hex literals in feature shells must come from tokens. Exceptions
  (waveform gradient `#87150a → #eea91c`) are deliberate brand
  signatures and live inside theme component files, never in shells.
