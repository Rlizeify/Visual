# Asian Vibrant — Pre-build Audit

Date: 2026-05-23. Against `main` at `34967d4`.

## What's stubbed today

```
web/src/themes/asian-vibrant/
  tokens.css          # 17 lines — accent + bg only, placeholder palette
  shell.tsx           # full-screen "coming soon" plate, ignores children
  components/stubs.ts # exports NullStub = () => null
  index.ts            # 11 surfaces all set to NullStub
  README.md           # aesthetic notes (anime cell-shading hint — now superseded)
```

The stub theme intercepts at the App-root `Shell` wrapper and never lets
`AppRoutes` mount. To ship the real theme, the wrapper shell becomes a
pass-through (same as Frutiger Aero) and the components become real
React components.

## Surfaces (from `web/src/themes/types.ts`)

| Surface | Prop signature | Frutiger Aero impl |
|---|---|---|
| `DashboardShell` | `()` | `frutiger-aero/components/DashboardShell.tsx` (NavBar + fog + Outlet) |
| `NavBar` | `()` | `frutiger-aero/components/NavBar.tsx` (4 tabs + profile icon) |
| `ProfileDropdown` | `{ open, onClose, anchorRect }` | `frutiger-aero/components/ProfileDropdown.tsx` (avatar / accent / reveal / theme / signout) |
| `MTab` | `()` | returns null — visualizer at App root |
| `HTabPlaceholder` | `()` | "Health coming soon" card |
| `ETabPlaceholder` | `()` | "Entertainment coming soon" card |
| `UTab` | `()` | re-exports `components/tabs/UserCompetitionTab` |
| `PlaybackControls` | `{ isPlaying, shuffleState, visible }` | re-exports `features/spotify/Controls` |
| `GearMenu` | `(any)` — actual: `{ isOpen, onClose, settings, selectedPreset, onSettingsChange, onPresetChange, onLiveAudioChange?, onLogout? }` | re-exports `features/visualizer/GearMenu` |
| `WaveformBar` | `()` | re-exports `features/spotify/WaveformProgressBar` |
| `SocialFeedRow` | `{ event, currentUserId, expanded, onToggle, isNew, index }` | re-exports `features/feed/FeedRow` |

## Tokens used by feature shells

Read across `components/`, `features/`, and `MHEUShell.css`:

- `--accent-color`, `--accent-color-bright`, `--accent-color-dim`,
  `--accent-color-bg`, `--accent-color-border`, `--accent-color-glow`
- `--color-bg`, `--color-secondary`, `--color-error`
- `--color-success`, `--color-success-bg`, `--color-success-border`
- `--color-danger`, `--color-danger-bg`, `--color-danger-border`
- `--row-tint`, `--row-tint-hover`
- `--radius`, `--font-ui`
- `--color-teal-primary` (legacy alias)
- `--color-panel-bg`, `--color-panel-border`

Asian Vibrant must define **all of these** under `:root[data-theme='asian-vibrant']`
even when the values aren't a literal match — point them at theme-appropriate
crimson/gold/ink values.

## Per-user accent leak

`applyAccentColor()` sets `--accent-color*` directly on
`document.documentElement.style` (inline). Inline style wins over the
`:root[data-theme='asian-vibrant']` selector. So `--accent-color*` will
always reflect the picked accent, regardless of theme.

**Decision**: keep that behavior. The Asian Vibrant components use a
parallel set of theme-only tokens (`--av-*`) for theme identity
(crimson, gold, ink, paper). The per-user accent still tints the avatar
borders and the "active" state of the theme switcher — same as
Frutiger Aero. The decorative layers and brushwork chrome do **not**
use `--accent-color*`.

## Font loading

The current theme foundation has **no per-theme font-loading
infrastructure**. `web/src/styles/fonts.css` `@font-face`-declares
`HitmarkerText` from `web/src/assets/fonts/`. All themes inherit it via
`--font-ui` default.

**Plan**: Asian Vibrant loads Google Fonts via `@import` at the top of
its `tokens.css`. Specifically:
- Display: **Ma Shan Zheng** (calligraphic Chinese brush serif)
- Body: **Noto Serif SC** (clean East Asian serif, broad glyph
  coverage)

`@import url('https://fonts.googleapis.com/...')` works inside a CSS
file imported via the manifest. Vite resolves the `@import` at build
time and inlines it as a `<link>` element. Both fonts are subsetted and
small enough to ship inline.

This pattern (theme-local `@font-face` / `@import` in `tokens.css`)
becomes the precedent for future themes that need custom typography.

## Decorative layers — placement

The Frutiger Aero `DashboardShell` renders a translucent navy fog on
H/E/U routes (opacity gated by `pathname !== '/m'`). On M the fog goes
transparent so the visualizer shows.

Asian Vibrant replaces that fog with a stack:

1. **Rice paper backdrop** — `position: fixed inset:0`, layered SVG
   noise + warm cream radial. Opacity 1 on H/E/U, 0 on M.
2. **Ink-wash mountains** — fixed SVG at bottom of viewport, low
   opacity. Same gate as backdrop.
3. **Kanji columns** — 4 columns (2 left, 2 right) of vertically
   scrolling characters. Visible on all routes (low opacity, sits over
   the visualizer on M — acts as ambient texture).
4. **Petals** — drifting cherry blossoms. Visible on all routes.
   ~8 petals at a time, varied speed/size.
5. **Dragon** — periodic flight every 60-90s, ~15s crossing. Visible
   on all routes.

All five layers gate on `prefers-reduced-motion: reduce` and
`document.visibilityState === 'hidden'`.

## VisualizerPage wiring gap

`web/src/features/visualizer/VisualizerPage.tsx` imports
`Controls`, `WaveformProgressBar`, `GearMenu` **directly** from the
feature folder — not via `useTheme().components`. This is fine for
Frutiger Aero (whose surfaces are re-exports of those exact files) but
makes a sibling theme's PlaybackControls / GearMenu / WaveformBar
inert.

**Fix**: small refactor in `VisualizerPage.tsx` to pull those three
surfaces from `useTheme().components`. Keeps the audio pipeline
untouched.

## Mobile

The petal count and kanji column count scale down at `width < 600px`:
- 4 kanji columns → 2
- 8 petals → 4
- Dragon flight rate halved
