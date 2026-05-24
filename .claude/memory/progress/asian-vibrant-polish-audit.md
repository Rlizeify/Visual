# Asian Vibrant — Polish Pass Audit

**Date:** 2026-05-24
**Trigger:** Stone reported four concrete issues against the
"monk's scriptorium" rebuild shipped earlier today (`9bfc7e7`):

1. Background fills only ~half viewport at some sizes.
2. Dragon reads as a single curved stroke, not an illustrated creature.
3. Palette feels restrained vs the supplied reference imagery.
4. Profile dropdown shadow scrolls with content (renders inside the box).

This audit grounds each issue in the code, names probable causes, and
flags scope. Polish is intentional override of the "restrained" budget
language in `decisions/asian-vibrant-design-language.md` — the new
references call for saturation + density.

---

## F1 — Background not filling viewport

**Code path:**
- `themes/asian-vibrant/components/Decorations.tsx:101-125`
  (`RicePaperBackdrop`) — `position: fixed; inset: 0; z-index: 40;`
  background `var(--av-paper-grain)` (radial + linear gradients) +
  noise overlay (SVG data URI, `mixBlendMode: multiply`, opacity 0.55).
- `themes/asian-vibrant/components/DashboardShell.tsx:24-43` — content
  div is `height: '100%'`, overflow:`auto` on non-M routes.
- `styles/global.css:11-23` — `html, body, #root { width:100%; height:100% }`,
  `body { background: var(--color-bg) }` (resolves to `--av-paper`).

**Findings:**
- `RicePaperBackdrop` uses `position:fixed inset:0` — should cover the
  viewport on its own. Likely culprits (ranked):
  1. **Containing-block hijack.** Any ancestor with `transform`,
     `filter`, or `will-change` makes `position:fixed` resolve to
     that ancestor's box, not the viewport.
  2. **feTurbulence tile gap.** Noise SVG was 320×320 without
     `stitchTiles` — at large viewports the filter only paints inside
     its declared region, leaving untextured rows.
  3. **Outlet page background covering the backdrop.**

**Fix (PART 2, shipped):**
- Explicit `100vw × 100vh` dimensions plus `inset:0` (belt + braces).
- `pointer-events: none` always — never `auto`.
- Noise SVG now 256×256 with `stitchTiles="stitch"` so the filter
  tiles cleanly across any viewport.
- Theme paints `body` + `#root` with `--av-paper` + `--av-paper-grain`
  via scoped `:root[data-theme='asian-vibrant'] body` selectors.
- `DashboardShell` content lane: `width:100vw`, `minHeight:100vh`,
  `overflow:visible` (document scrolls, not lane).

---

## F2 — Dragon is a single brushstroke

**Code path:**
- `themes/asian-vibrant/components/Decorations.tsx:462-598`
  (`buildDragonBodyPath`, `Dragon`).

**Current implementation:**
- One `<path>` with `fill="none" stroke="url(#av-dragon-body)"
  strokeWidth="9"`. A 14-segment sine-curve serpentine.
- Head is two small paths: a brushed teardrop (3 quadratic Béziers)
  and a single triangle horn. No eye, no whiskers, no mouth, no mane.
- No legs, no claws, no scales, no underside banding, no tail flame.
- Gradient runs deep-crimson → crimson → gold along the X axis — so
  the head end is crimson, the tail end gold, regardless of motion.

**Mismatch to reference (`web/public/reference/dragon-reference.jpg`):**
- Reference is an ink-and-watercolor traditional dragon: cream/white
  body with **horizontal red underside banding**, **black diamond
  scale outlines** on top, **golden mane**, **golden 3-toed claws on
  legs**, **eyes with whites + dark pupil**, **two horns**, **whiskers**,
  **flame/tuft at tail tip**, against navy ink-wash with white
  wave-pattern clouds.
- Current is one stroke. Stone's description ("single curved gradient
  stroke") matches the code exactly.

**Fix direction (PART 3):**
- Rebuild as a discrete-element illustrated SVG, 200-500 lines.
- Body = filled segments along a serpentine spine, not a stroke.
- Discrete `<g>`s with descriptive ids: `dragon-head`, `dragon-mane`,
  `dragon-body-segment-1..N`, `dragon-leg-front/back`, `dragon-claw`,
  `dragon-tail`, `dragon-eye`, `dragon-horn-1/2`, `dragon-whisker-1/2`.
- Per-segment phase-offset undulation (existing approach extended).
- Reference palette: body `#F4ECD8`, ink `#1A1410`, underside stripe
  `#A0001C`, mane / claws `#C9A227` → `#FFD700`, eye dark with white
  highlight.
- If pure SVG can't reach reference quality without ballooning past
  500 lines or hitting render-cost limits, document the gap and stop
  rather than ship token effort.

---

## F3 — Palette / decorative density feels restrained

**Code path:**
- `themes/asian-vibrant/tokens.css` (lines 27-147).
- `decisions/asian-vibrant-design-language.md` — explicitly codifies
  "one crimson moment per region", "gold reserved for title plaque",
  "restrained palette".

**Token reality vs perception:**
- Most tokens ARE saturated: `--av-crimson #8B1A1A`, `--av-vermillion
  #C0392B`, `--av-blossom #F8C8DC`, `--av-gold #C9A227`, `--av-jade
  #5B8C5A`.
- But the **deployment** is restrained by doctrine. Crimson appears
  once per region. Gold only on plaques. Decorations limited to:
  4 kanji columns (desktop), 8 petals (desktop), 2 mountain ridges,
  1 dragon every 60-90s. No clouds, no sun/moon disk, no large
  background calligraphy, no blossom-branch silhouettes.
- Reference imagery (`web/public/reference/pink-reference.jpg`) is the
  inverse — dense pink saturation everywhere, a deep red sun, gnarled
  cherry tree with abundant blossoms, bluebird, warm earth tones.

**Fix direction (PART 4):**
- Override doctrine: budget language explicitly retired for this pass.
- Add deeper crimson tokens: `--av-crimson-bright #A0001C`,
  `--av-crimson-blood #8B0000`, `--av-pink-saturated`,
  `--av-gold-leaf #FFD700`, `--av-gold-warm #D4A017`, `--av-cinnabar`,
  `--av-indigo`, `--av-peach`, `--av-sage`.
- New decorative layers in `Decorations.tsx`:
  - Distant ink-wash clouds (low-opacity SVG strokes near top).
  - Large sun/moon disk (positioned upper-right, deep crimson on day
    routes, ink on night).
  - 3-4 mountain ridge layers at varied depth + opacity.
  - Faint large background calligraphy (one giant kanji watermark,
    very low opacity, anchored bottom-right or center).
  - Cherry-blossom branch silhouettes at viewport edges.
- Increase counts: kanji columns 3-4, petals 12-20 with size variation.

---

## F4 — Profile dropdown shadow scrolls with content

**Code path:**
- `themes/asian-vibrant/components/ProfileDropdown.tsx` — `panelStyle`
  includes `overflowY: 'auto'` directly on the panel element that
  also has `className="av-scroll-panel"`.
- `themes/asian-vibrant/theme.css:82-102`:
  ```
  .av-scroll-panel { box-shadow: var(--av-shadow-panel); position: relative; }
  .av-scroll-panel::before, .av-scroll-panel::after {
    content: ''; position: absolute; left:0; right:0;
    height: 16px; background: var(--av-scroll-edge);
    pointer-events: none; z-index: 1;
  }
  .av-scroll-panel::before { top: 0; }
  .av-scroll-panel::after  { bottom: 0; transform: scaleY(-1); }
  ```

**Findings:**
- The `box-shadow` is on the outer panel — that part is correct.
- The `::before` / `::after` rolled gradient edges are absolutely
  positioned at `top:0` / `bottom:0` of the **scrollable container**.
  When content scrolls inside the panel, these pseudo-elements stay
  pinned to the scroll-content origin (because they're abs-positioned
  inside an `overflow:auto` box, they scroll with the content's
  positioning context — they DON'T stay glued to the viewport edge of
  the panel). This produces the "shadow renders inside panel and
  scrolls with content" symptom Stone described.

**Fix direction (PART 5):**
- Split the panel into two elements:
  - Outer wrapper: `.av-scroll-panel` carries `box-shadow`, border,
    `position:relative`, `overflow:hidden`. The `::before`/`::after`
    edges live here, sticky to the outer box.
  - Inner scroller: a child `<div>` with `overflowY:auto`,
    `height:100%`. Content goes inside.
- Pseudo-elements stay glued to the outer box; content scrolls
  underneath them.
- Audit panel shadow as well: confirm only outer panel has the deep
  shadow, no `inset` shadows on inner descendants.

---

## Scope boundaries

- M-tab (visualizer route): backdrop is intentionally hidden — leave
  visualizer untouched.
- Per-user `--accent-color*` tokens: unchanged. Polish only touches
  theme identity tokens (`--av-*`).
- `applyAccentColor()` contract unchanged.
- VisualizerEngine + audio pipeline unchanged.
- Frutiger Aero + AC-130 themes untouched.
- All `.md` artifacts capped at 200 lines.
