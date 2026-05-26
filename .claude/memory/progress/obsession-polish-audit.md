# Obsession Polish Audit

**Date**: 2026-05-26
**Status**: Diagnosis complete; fixes applied in follow-up commit.

## Scope

Three issues surfaced after the initial OBSESSION ship (commit
`84ae6eb`). All three are local to `/obsession/*` — no other surface
is affected.

---

## 1. Settings page does not scroll

### Symptom

`/obsession/settings` content is taller than the viewport, but the
page cannot scroll. The footer rows (Export bundle, conflict policy,
duration controls) are clipped and unreachable.

### Diagnosis

Global `html, body { overflow: hidden }` is required by the
visualizer (Butterchurn canvas + the MHEU shell rely on it to
prevent rubber-band bounce on iOS Safari and to keep the WebGL
context stable). That rule cascades into every route, including
`/obsession/*`.

`.obs-root` was declared with `min-height: 100vh; overflow-x: hidden`
— no vertical overflow declaration, so vertical scrolling falls
through to `body`, which is `overflow: hidden`. Result: content
overflows visibly but is unscrollable.

The `.obs-write-stage` (7-min discipline surface) is `position:
fixed; inset: 0` so it is unaffected. The decorative chrome (`.obs-
root::before` grid, `.obs-root::after` scanlines, `.obs-vignette`,
`<HudCorners />` plates, `<BirdButton />`) all use `position: fixed`
and are anchored to the viewport — they are also unaffected by
making `.obs-root` the scroll container.

### Fix

Promote `.obs-root` to its own scroll container:

```css
.obs-root {
  height: 100vh;            /* was: min-height: 100vh */
  overflow-y: auto;         /* new */
  overflow-x: hidden;       /* unchanged */
}
```

Why explicit `height: 100vh` rather than keeping `min-height: 100vh`:
`overflow-y: auto` on a container with only `min-height` will only
scroll content beyond `min-height`, not beyond the container's actual
rendered height when it equals viewport. Locking height to `100vh`
makes the container exactly viewport-sized and forces overflow to
scroll inside it, which is what we want.

---

## 2. Hummingbird image has visible JPEG background

### Symptom

The bird floating button (`<BirdButton />`) and the Amor page hero
image (`/reference/bird-reference.jpg`) render with a flat opaque
rectangle around the bird — no transparency. The drop-shadow CSS
filter still applies but to the whole rectangle, not the bird
silhouette.

### Diagnosis

The asset is a JPEG. JPEG does not support an alpha channel. The
transparent background that the design language requires was lost
when the source PNG was flattened to JPEG (likely during a
re-export). No CSS or code change can restore transparency from a
JPEG — the alpha data is gone.

### Fix (code-side)

Update both `<img>` references to point at `bird-reference.png`. The
file does not yet exist at `web/public/reference/bird-reference.png`
— the browser will show a broken-image icon until Stone re-exports
the source asset. Adding a `TODO` near each reference makes the
required asset visible to anyone reading the file.

### Required manual step (Stone)

Re-export the source bird artwork as **PNG-24 with alpha channel**
and save it to:

```
web/public/reference/bird-reference.png
```

PNG-24 (not PNG-8) preserves the antialiased edges and the subtle
soft-shadow halo that the bird drawing carries. PNG-8 would
posterize the alpha to 1-bit and produce hard fringe pixels around
the wings.

---

## 3. Manifesto text is buried in JSX

### Symptom

Stone needs to iterate on the manifesto copy without touching React.
The current `Amor.tsx` inlines the manifesto as `<p>` elements with
hand-typed `<em>` wrappers and a stray `&nbsp;` inside one
`<em>`. Editing prose means editing JSX — high friction, easy to
break the component, no obvious place to put new paragraphs.

### Fix

Extract to top-of-file constants:

```ts
const MANIFESTO_HEADER = 'AMOR\nCANTUS\nAVIUM'         // newlines → <br/>
const MANIFESTO_SUBTITLE = "*Love of the birds' song.*" // single line
const MANIFESTO_PARAGRAPHS: string[] = [
  '...',
  '...',
]
```

Add a tiny inline-emphasis renderer that converts `*word*` segments
into `<em>word</em>`:

```ts
function renderEmphasis(text: string) {
  const parts = text.split(/\*([^*]+)\*/g)
  return parts.map((chunk, i) =>
    i % 2 === 1
      ? <em key={i}>{chunk}</em>
      : <Fragment key={i}>{chunk}</Fragment>,
  )
}
```

Render the paragraphs by mapping:

```tsx
{MANIFESTO_PARAGRAPHS.map((para, i) => (
  <p key={i}>{renderEmphasis(para)}</p>
))}
```

Constraints intentionally kept tight:
- No nesting (`*a *b* c*` is a parse error in spirit; the regex
  is non-greedy and won't nest).
- No other markdown — no bold, no links, no headings. The manifesto
  has one inline style.
- A `TODO` comment marks the constants as placeholder so Stone's
  final copy lands in the obvious place.

---

## Risk

All three fixes are local to `/obsession/*`. None touches:

- the global MHEU shell
- the visualizer pipeline
- the theme system
- Supabase tables
- the OAuth handlers
- the API surface

Verification plan:
1. `tsc --noEmit` clean.
2. `vite build` clean.
3. Manual: navigate to `/obsession/settings`, scroll to bottom row;
   confirm Export button reachable.
4. Manual: load `/obsession` — bird image will show broken-image
   icon until PNG ships; the rest of the page must render.
5. Manual: navigate to `/obsession/amor`; confirm the four
   manifesto paragraphs render in order with `*continuity*` and
   `*Love of the birds' song.*` italicized in amber.
