# Accent / Frosted-Glass / Feed Overflow — Audit

**Date:** 2026-05-25
**Scope:** Desktop only. Mobile responsiveness out of scope this pass.

Three issues against both themes (Frutiger Aero + Asian Vibrant):

1. User accent not reaching every chrome surface.
2. Frosted glass tints stay theme-default; never pick up user accent.
3. U-tab Activity Feed runs past the bottom of the viewport.

---

## Accent system as found

`web/src/lib/accentColor.ts::applyAccentColor(hex)` already derives a
five-variant family at runtime and writes them as inline custom props
on `documentElement` (highest specificity, beats any selector rule):

```
--accent-color         #RRGGBB
--accent-color-bright  #RRGGBB
--accent-color-dim     rgba(r,g,b, 0.60)
--accent-color-bg      rgba(r,g,b, 0.08)   ← used as "glass tint" today
--accent-color-border  rgba(r,g,b, 0.40)
--accent-color-glow    rgba(r,g,b, 0.30)
```

Per-theme fallbacks live in `web/src/styles/tokens.css` (plain `:root`)
and `web/src/themes/<id>/tokens.css` (`:root[data-theme='<id>']`).

**Brief asks for two paired tokens by name:** `--user-accent` and
`--user-accent-glass`. The existing 5-variant API is already wired
through ~25 files — replacing the names wholesale would touch the
whole codebase. Resolution: **alias** the brief's names alongside the
existing system. `--user-accent` ≡ `--accent-color`. `--user-accent-glass`
is the new mid-alpha variant (existing `--accent-color-bg` at 0.08
is too faint to read as a wash on frosted glass).

**Alpha choice for `--user-accent-glass`: `0.15`.** Rationale: dark
Frutiger Aero panels sit at `rgba(0,20,30,0.55)` over a black/visualizer
backdrop with `backdrop-filter: blur(12-16px)`. At 0.08 (current
`--accent-color-bg`) the wash is invisible on top of that base. At
0.25+ the panels stop reading as frosted glass and start reading as
opaque colored panels. 0.15 is the lowest value where a purple/pink
accent is clearly visible on top of the dark blue base, and the
highest value where the panel still reads as glass.

---

## Issue 1 — surfaces by accent source

### Surfaces that DO update with `--accent-color*` today

| Surface | File | Source |
|---|---|---|
| NavBar tab buttons | `themes/frutiger-aero/components/NavBar.tsx` | `var(--accent-color-border)`, `var(--accent-color-bg)` |
| Profile icon border | same | inline `accent_color` per-profile + `var(--accent-color)` fallback |
| Playback Controls bar border | `features/spotify/Controls.tsx:49` | `var(--accent-color-border)` |
| GearMenu side-panel border | `features/visualizer/GearMenu.tsx:180` | `var(--accent-color-border)` |
| `.glass-card`, `.aero-button`, `.stat-card`, `.leaderboard-table` | `components/MHEUShell.css` | all routed |
| SocialFeed FeedRow border | `features/feed/FeedRow.tsx:49` | `var(--accent-color-border)` |
| ProfileDropdown | `themes/frutiger-aero/components/ProfileDropdown.tsx` | via `.glass-card` + inline vars |
| Frutiger Aero stat / leaderboard hover | MHEUShell.css | all routed |

### Surfaces that DO NOT update — hardcoded teal hex/rgba

| Surface | File:line | Hardcoded color | Fix |
|---|---|---|---|
| M-tab "No track playing" card border | `features/visualizer/VisualizerPage.tsx:82` | `rgba(0, 220, 200, 0.4)` | `var(--accent-color-border)` |
| Album-art placeholder border | `VisualizerPage.tsx:154` | `rgba(0, 220, 200, 0.2)` | `var(--accent-color-bg)` (kept as light alpha) |
| Fullscreen button border (idle) | `VisualizerPage.tsx:203` | `rgba(0, 220, 200, 0.4)` | `var(--accent-color-border)` |
| Fullscreen button border (active) | `VisualizerPage.tsx:202` | `rgba(39, 224, 225, 0.8)` | `var(--accent-color)` |
| Fullscreen icon color (active) | `VisualizerPage.tsx:204` | `#27e0e1` | `var(--accent-color-bright)` |
| GearMenu signal-track background | `features/visualizer/GearMenu.tsx:270` | `rgba(0, 30, 40, 0.8)` | keep dark, layer glass — chrome-neutral |
| GearMenu select background (preset / input) | `GearMenu.tsx:291, 334` | `rgba(0, 20, 30, 0.8)` | keep dark, layer glass |

Result: VisualizerPage is the main offender. The hardcoded teal was
copied from the old token defaults and never rewired.

### Asian Vibrant exceptions (judgment calls — stay theme-default)

| Surface | Reason |
|---|---|
| Lacquered NavBar (`.av-lacquer-band`) | Crimson lacquer IS the theme identity. Painting it purple would obliterate the design language. |
| Instrument shelf (`.av-instrument-shelf`) | Same — solid crimson lacquer plank. |
| Dragon gold mane / claws / horns | Decorative illustration. Brief calls this out explicitly. |
| Cherry blossoms, sun disk, mountains | Decorative illustration. |
| `.av-title` gold-leaf plaque | The plaque IS the theme signature. |
| Hanko stamps (crimson) | Carved seal stamps are crimson by definition. |

Asian Vibrant chrome that SHOULD respect accent: profile icon border
(already routed via `profiles.accent_color` per-row), feed-row
expanded border, U-tab pager buttons that currently use `var(--av-ink-wash)`.

These are smaller decorative accents where a user's color choice
reads as a personal touch rather than a theme override.

---

## Issue 2 — frosted-glass tint sources

| Surface | File:line | Current tint | Layer accent-glass? |
|---|---|---|---|
| `.glass-card` (Frutiger Aero) | `MHEUShell.css:2-16` | `--accent-color-bg` linear-gradient | already accent — bump base via `--user-accent-glass` for visible wash |
| `.glass-card-subtle` | `MHEUShell.css:18-24` | `rgba(0, 20, 30, 0.5)` solid | layer `--user-accent-glass` |
| GearMenu panel | `GearMenu.tsx:177` | `rgba(0, 20, 30, 0.75)` | layer `--user-accent-glass` |
| Playback Controls bar | `Controls.tsx:46` | `rgba(0, 20, 30, 0.55)` | layer `--user-accent-glass` |
| VisualizerPage `panelStyle` | `VisualizerPage.tsx:79` | `rgba(0, 20, 30, 0.30)` | layer `--user-accent-glass` |
| Nav band | `NavBar.tsx:81` | `--aero-nav-bg` (dark blue gradient) | layer `--user-accent-glass` |
| Asian Vibrant panel surfaces | `.av-paper-card`, `.av-scroll-panel-outer` etc. | warm paper gradients | leave alone — paper is the look |

Layering pattern (CSS multi-bg):
```
background:
  linear-gradient(0deg, var(--user-accent-glass), var(--user-accent-glass)),
  rgba(0, 20, 30, 0.55);
```
First layer = accent wash, second = dark frost base. Reads as
"frosted glass with a faint wash of the chosen color".

---

## Issue 3 — U-tab feed overflow

Both tabs render `SocialFeed` (or the AV inline equivalent) as the
last block in a vertically-flowing column with no max-height:

- `components/tabs/UserCompetitionTab.tsx:542` — `<SocialFeed ... />`
  inside `containerStyle { overflow: 'visible' }`.
- `themes/asian-vibrant/components/UTab.tsx:545` — same shape.
- `themes/frutiger-aero/components/DashboardShell.tsx:44` —
  `contentStyle.overflow = showFog ? 'auto' : 'visible'`. On U the
  document scrolls but there's no bound on the feed itself.

Result: with 200 events the feed list outgrows the viewport and the
PAGE scrolls. Stone wants the FEED to scroll, the page to stay
fixed-height.

**Fix:** add `max-height: calc(100vh - var(--feed-chrome-offset)); overflow-y: auto`
on the feed list region. Pick offset that covers nav (56px) + tab
header + leaderboard + scores cards above. Use a CSS var so both
themes can override it. Approximate offset for desktop U:
`56 + 24 + 24` (nav + page top padding + bottom gutter) = 104px above
the feed *section*, then we want the inner list to scroll, not the
section header. Constrain inner list to `calc(100vh - 320px)` so the
section header + first leaderboard rows stay visible. Tune to taste.

---

## Issue 4 (in Part 6) — Asian Vibrant follow-up items

- Cherry branches (`Decorations.tsx:350-462`):
  - Top-left SVG is `top:0, left:0, 320×260`. Nav is `56px` tall.
    Drop top-left branch to `top: 60px` (just below nav).
  - Bottom-right SVG is `bottom:0, right:0, 300×240`. On U-tab there
    is no fixed bottom bar (playback shelf only shows on /m). Keep
    bottom-right where it is, but shrink to 240×200 so it doesn't
    push into the activity feed.
- Dragon first-flight (`Decorations.tsx:813`): currently
  `Math.min(wait, 12_000)` — first appearance ~12s. Brief: push to
  30-45s. Change to `Math.max(30_000, Math.min(wait, 45_000))`.
- Sun disk fixed 180px offset — leave as-is.
- Petal density 18 — leave as-is.

---

## Out-of-scope (this pass)

- Mobile sizing of any decoration / chrome.
- Accent on Asian Vibrant lacquered surfaces (identity-locked).
- VisualizerEngine + audio pipeline.
- Per-user `accent_color` storage (already in `profiles.accent_color`).
- `apply­AccentColor()` IO contract (only adds two new property writes).
