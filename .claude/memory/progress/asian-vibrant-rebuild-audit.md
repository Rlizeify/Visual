# Asian Vibrant — Rebuild Audit

Date: 2026-05-24. Against `main` at `d314379`.

This audit covers the **as-shipped** Asian Vibrant build (commit
`2e5de19 feat(web): Asian Vibrant theme — full build`) for the
forthcoming skill-informed rebuild. It separates what stays (structure
+ contracts) from what gets rewritten (visuals + bugs).

## Inventory

```
web/src/themes/asian-vibrant/
  index.ts                    (53 lines)  — manifest, 11 surfaces wired
  shell.tsx                   (15 lines)  — pass-through, archived stub
  tokens.css                  (97 lines)  — palette + @import fonts
  theme.css                   (183 lines) — keyframes + .av-* classes
  README.md                   (—)          — aesthetic notes (stale)
  components/
    DashboardShell.tsx        (49 lines)  — wraps NavBar + Outlet + Decorations
    NavBar.tsx                (203 lines) — lacquer band, MHEU title, 4 tabs, profile icon
    ProfileDropdown.tsx       (450 lines) — scroll panel, avatar/accent/reveal/theme/signout
    MTab.tsx                  (7 lines)   — returns null (viz at App root)
    HTabPlaceholder.tsx       (73 lines)  — paper card with 健 glyph
    ETabPlaceholder.tsx       (72 lines)  — paper card with 楽 glyph
    UTab.tsx                  (577 lines) — leaderboard + scores + feed
    PlaybackControls.tsx      (136 lines) — instrument shelf bar
    GearMenu.tsx              (455 lines) — right-side paper panel
    WaveformBar.tsx           (202 lines) — crimson→gold filled waveform
    SocialFeedRow.tsx         (164 lines) — paper card row + hanko magnitudes
    Decorations.tsx           (586 lines) — 5 decorative layers
    BrushIcons.tsx            (170 lines) — 8 brushstroke SVG icons + Hanko stamp
```

## What's structurally fine (keep)

1. **Manifest shape** — `index.ts` correctly registers all 11
   surfaces; matches `ThemeManifest`. Reuses Decorations as a child
   of DashboardShell, which is right.
2. **Shell pass-through** — `shell.tsx` returns `{children}`. Correct
   pattern. Stub overlay archived (per Archive Policy).
3. **MTab returns null** — visualizer mounts at App root, theme has
   no business owning it. Correct.
4. **Surface signatures** — every component matches the prop
   contract from `web/src/themes/types.ts`. `PlaybackControls`,
   `WaveformBar`, `GearMenu`, `SocialFeedRow` all signature-match
   the Frutiger Aero re-exports.
5. **Audio pipeline untouched** — WaveformBar consumes
   `useAudioSource()` from the shared analyser; GearMenu uses
   `getVisualizerEngine()` directly. No duplicate AnalyserNode.
6. **VisualizerPage wiring** — already pulls `PlaybackControls /
   WaveformBar / GearMenu` from `useTheme().components` (committed
   in the prior build).
7. **Font loading via @import in tokens.css** — Vite-friendly,
   resolves at build, no flash beyond the first paint. Pattern
   becomes the precedent.
8. **Decoration architecture** — 5 layers with RAF, mobile
   downscale, prefers-reduced-motion + visibility gates. Correct
   contract; needs internals reworked (see bugs).
9. **Per-user accent leak is intentional** —
   `applyAccentColor()`'s inline-style writes win over selector.
   `--accent-color*` stays per-user; theme identity lives in
   `--av-*`. Keep.
10. **Magnitude convention** — vermillion up / jade down (avoids
    green/red collision). Keep.
11. **Curated 50-kanji pool** — nature/weather/season vocabulary,
    no political/religious/charged glyphs. Keep the policy.
12. **z-index stack** — paper 40 / mountains 41 / kanji 45 /
    petals 46 / dragon 47 / nav 1000 / dropdowns 1100+. Correct.

## Bugs (must fix in rebuild)

### B1 — `--av-gold-faint` referenced but undefined

`SocialFeedRow.tsx:50,149` and `UTab.tsx:368,463,547` reference
`var(--av-gold-faint)`, but `tokens.css` defines `--av-gold-soft`
not `--av-gold-faint`. CSS resolves to the unset initial value
(transparent border) silently. Either:
  - rename token to `--av-gold-faint` in tokens.css, **or**
  - replace 5 references with `--av-gold-soft`.
Audit recommends the rename — "faint" matches the visual intent
better and is more consistent with `-bright` / `-deep`.

### B2 — ProfileDropdown Promise.all rejects whole effect

`ProfileDropdown.tsx:74-79` issues four parallel Supabase queries
via `Promise.all`. Any single rejection (network blip,
`app_settings` row missing, RLS denial on
`user_score_visibility`) throws the await and leaves the panel
empty. Replace with `Promise.allSettled`, fall back per-channel.

### B3 — KanjiColumn wrap calculation ignores row padding

`Decorations.tsx:201` computes `const wrap = size * chars.length`
but each character row has `padding: '6px 0'` (line 245), so each
row is actually `size + 12`px tall. After a full wrap the column
shifts by `12 * chars.length` px from where it should — a slow
seam-creep. Replace with `const wrap = (size + 12) * chars.length`.

### B4 — Decorations spawns 6 independent RAF loops

`KanjiColumn` (×4 on desktop) + `Petals` + `Dragon` each own a
RAF. Combined frame budget is fine on modern hardware but
unnecessary. Consolidate kanji animation into a single RAF that
writes to all 4 columns at once. Petals and Dragon can stay
separate (different scheduling shape).

### B5 — KanjiColumn re-initializes lastTime on resume

When `paused` flips from true→false the effect re-runs and
`lastTime.current = 0` resets, so the first frame after resume has
`dt = 0` and movement stalls one frame. Cosmetic; the petals
already have the same shape. Acceptable, document only.

### B6 — Petal initial-render flash

`Petals` computes `initialX/Y` and sets transform in style, then
the first RAF frame overwrites it with viewport-relative position.
For ~1 frame the petal appears at `(p.x * w, p.y * h)` where `w/h`
are the initial useState values (default 1440×900 on SSR). Visible
as a flash on small viewports. Fix: read viewport via
`useLayoutEffect` before paint, or seed initial transform from
real viewport.

## Visual / craft concerns (rewrite)

### V1 — Inline-style sprawl drowns the CSS classes

`theme.css` defines `.av-paper-card`, `.av-scroll-panel`,
`.av-brush-button`, `.av-section-header`, `.av-title`,
`.av-ink-divider` — but most components pile inline styles on top
of those classes (HTab adds inline color + padding + flex; UTab
uses `.av-paper-card` then completely overrides with inline
`padding`). Hard to maintain; theme tweaks require touching 11
files. Rebuild target: components reference classes; CSS owns
appearance.

### V2 — Kanji glyphs over-used in chrome

Section labels in ProfileDropdown (肖, 色, 見, 風), GearMenu (音,
幻, 動, 設, 退), UTab (競, 榜, 記), placeholders (健, 楽), score
readouts (位, 速, 加, 衝, 撃). Design doc says glyphs should be
"sparse, neutral, decorative". Current build pushes glyphs into
informational roles where they compete with the Latin labels and
hurt scanability. Rebuild target: kanji used in ONE place per
panel (the title), Latin labels carry the meaning.

### V3 — Crimson + gold combination uninterrupted

Nav band, waveform fill, accent rings, section borders, magnitude
seals, leaderboard headers, score numbers — all crimson or gold.
No tonal relief. Rebuild target: introduce more paper / ink-soft
breathing room; reserve crimson for ONE primary surface per
viewport region (nav OR the active row OR the active glyph, not
all three).

### V4 — WaveformBar feathering loses peaks

`WaveformBar.tsx:174` filter `feGaussianBlur stdDeviation="0.6"`
combined with `opacity 0.92` and the played-overlay multiply blend
softens the visualizer's signal almost into a vague glow. The
Frutiger Aero version is sharp because peaks are the readout. Keep
feather on the brushstroke envelope sides only, not the top
silhouette. Or drop the blur entirely and rely on the gradient.

### V5 — Mountains parallax missing

Two stacked ridges, same scroll, no parallax — looks flat.
Frutiger fog at least breathes via opacity. Rebuild target: front
ridge moves on scroll at a slightly different rate from back
ridge, OR: ridges sway 1-2px on a slow sine.

### V6 — Dragon body is too literal

The dragon SVG includes mane tufts + horn + eye + whisker + claws
+ tail flick. Reads as cartoonish at 500px wide. Rebuild target:
strip to a single serpentine brushstroke body + a single head
silhouette. Less drawing, more brush.

### V7 — Petal blossoms render as teardrops

`Decorations.tsx:382` `path d="M16 4 C 22 8, 24 16, 16 28 C 8 16,
10 8, 16 4 Z"` is a single lobe — reads as a teardrop, not a five-
lobed cherry blossom. Either render an actual 5-lobed blossom OR
admit it's a petal and shape it accordingly (cherry-blossom petal
is a notched-tip oval).

### V8 — NavBar profile icon overlaps centered title on narrow screens

NavBar puts MHEU title at `left: 50%` and tabs at `right: 14px`
with profile icon at `left: 14px`. On ≤640px the gold-leaf title
collides with the tab strip's left edge. Rebuild target:
responsive sizing OR move title to left of tabs OR drop it on
mobile (Frutiger Aero doesn't show it on mobile either).

### V9 — Hanko stamp is uniform; loses character

Every Hanko renders as a rounded rectangle. Real seal stamps have
irregular edges, broken corners, paper transfer, ink bleed.
Rebuild target: optional rough-edge variant via SVG mask, used
sparingly (active states, top-of-section markers — not every
magnitude badge).

### V10 — UTab "競" header glyph is loaded

競 means "compete" — but the visual placement (giant glyph above
the H2) reads as a header decoration. Used in 2 places (the H2
glyph + a sign-in card) which conflict in meaning. Pick ONE
usage.

## Quality concerns (smaller)

- `box-shadow` literals use raw rgba instead of token references
  in many components. Tokens for shadow layers don't exist —
  rebuild should add `--av-shadow-card`, `--av-shadow-panel`,
  `--av-shadow-deep`.
- `GearMenu.tsx` has long sections of inline-styled rows where a
  `.av-form-row` class would deduplicate.
- `UTab.tsx` reimplements the leaderboard table inline; the
  Frutiger version has the same structure — extract a shared
  primitive? (No — themes intentionally re-skin everything. Leave
  duplicated.)
- `WaveformBar` `GRAD_START/MID/END` use hex literals instead of
  theme tokens. Should source from `--av-crimson-deep` /
  `--av-vermillion` / `--av-gold-deep` via JS for SVG gradient
  stops (since SVG doesn't read CSS vars in `<stop>` until very
  modern Chromium; use `currentColor` plus parent CSS variable
  trick, or accept literal hex).

## Out-of-scope for rebuild

- **AC-130 Thermal theme** — still a stub. Untouched by this work.
- **Frutiger Aero** — reference only, not modified.
- **Theme system foundation** — `ThemeContext`, `ThemeErrorBoundary`,
  `registry.ts`, `types.ts`. All correct as-shipped.
- **Audio pipeline** — single shared AnalyserNode rule holds.
- **Per-user accent leak** — intentional, do not "fix".

## Rebuild scope summary

Roughly: ~30% of the existing build (palette, structure,
contracts) survives. Tokens get expanded (shadow tokens, faint
gold). Theme.css absorbs more visual responsibility from inline
styles. Decorations gets bug fixes + consolidation but same shape.
All 11 component files get a visual rebuild emphasizing restraint:
fewer kanji in chrome, breathing space, crimson reserved for
single accents per region.
