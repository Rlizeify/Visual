# 2026-05-24 — Asian Vibrant Design Language (Rebuild)

Replaces the 2026-05-24 v1 doc. Informed by the `frontend-design`
skill and the rebuild audit
(`progress/asian-vibrant-rebuild-audit.md`).

## Aesthetic vision in one sentence

A **monk's scriptorium** — quiet rice paper, warm ink, a single
calligraphic stroke of crimson, gold leaf reserved for the title
plaque, and once every minute a dragon crossing the sky.

## Aesthetic anchors

| Anchor | Means |
|---|---|
| **Classical scroll painting** | Sumi-e ink wash, deckled paper, hand-cut edges, controlled imperfection. |
| **Restrained palette** | Cream + ink with crimson + gold used as accents, never as fields. |
| **Calligraphic energy** | Brushstroke feel — varied stroke width, slight feather, no perfectly geometric shapes anywhere. |
| **Generous negative space** | 30-50% of any panel is paper. The empty space IS the design. |
| **Sparse drama** | The dragon, the gold-leaf title, the lacquer nav — each appears once and only once per viewport. |

### What this is NOT

- Anime / chibi / kawaii.
- Cyberpunk-with-kanji.
- Cherry-blossom-everywhere greeting-card kitsch.
- Nationalistic (no flags, no specific historical regalia).
- Maximal. Maximal here = louder, not better.

## Typography — distinctive pairing

```css
@import url('https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@400;500;600;700&display=swap');
```

| Family | Role | Where it lives |
|---|---|---|
| **Ma Shan Zheng** | Display calligraphy | MHEU title plaque (ONLY). Optional: single hanko glyph. |
| **Noto Serif SC** | Body + interface | Everything else — usernames, labels, paragraph copy, numerals. |

**Skill compliance** — Ma Shan Zheng is genuinely distinctive (not
Inter/Roboto/Arial); Noto Serif SC carries the East Asian serif
texture into Latin glyphs without losing legibility.

Tokens:
- `--av-font-display: 'Ma Shan Zheng', 'Noto Serif SC', serif`
- `--av-font-body: 'Noto Serif SC', Georgia, 'Times New Roman', serif`
- `--font-ui: var(--av-font-body)` (overrides global default)

**Kanji-glyph budget per panel: ONE.** If a panel already has a kanji
in its title, no other section inside that panel uses kanji. Latin
labels carry the meaning; kanji is decorative.

## Palette — dominant + accent, never even

The doctrine: **paper and ink dominate. Crimson and gold are
accents.** A user looking at any single panel should see paper +
ink as the field, with at most one crimson moment and one gold
moment.

### Paper family (the field)

| Token | Hex | Use |
|---|---|---|
| `--av-paper`        | `#F4ECD8` | Cards, panels, page background (warm cream). |
| `--av-paper-soft`   | `#EFE3C8` | Secondary cards (zebra strips, recessed). |
| `--av-paper-edge`   | `#D8C9A6` | Deckled / torn edges. |
| `--av-paper-grain`  | gradient | Layered mesh: 2 radial tints + 1 linear, applied as backdrop. |

### Ink family (the marks)

| Token | Hex | Use |
|---|---|---|
| `--av-ink`          | `#1A1410` | Primary text, ink strokes (warm sumi black). |
| `--av-ink-soft`     | `#3D2F26` | Body text, secondary labels. |
| `--av-ink-wash`     | `rgba(26,20,16,0.18)` | Borders, dividers, ink-wash mountains. |
| `--av-ink-line`     | `rgba(26,20,16,0.55)` | Brushstroke divider line. |

### Crimson — used once per region

| Token | Hex | Use |
|---|---|---|
| `--av-crimson`      | `#8B1A1A` | Primary accent (nav band, hanko stamp, active glyph). |
| `--av-crimson-deep` | `#5C0F0F` | Lacquer crimson — single deep accent, never field. |
| `--av-crimson-soft` | `rgba(139,26,26,0.12)` | Active-state tints. |
| `--av-crimson-glow` | `rgba(139,26,26,0.45)` | Glow on focus only. |

### Vermillion + blossom (signal colors)

| Token | Hex | Use |
|---|---|---|
| `--av-vermillion`   | `#C0392B` | Magnitude UP, error, brushstroke fills. |
| `--av-blossom`      | `#F8C8DC` | Cherry-blossom pink (decoration). |
| `--av-blossom-deep` | `#E89BB5` | Deeper blossom (rare). |

### Gold leaf — title only

| Token | Hex | Use |
|---|---|---|
| `--av-gold`         | `#C9A227` | MHEU title gradient stop, ONE feature accent. |
| `--av-gold-bright`  | `#E8C158` | Title gradient highlight. |
| `--av-gold-deep`    | `#8C6E15` | Title gradient shadow, hairline on cream. |
| `--av-gold-soft`    | `rgba(201,162,39,0.22)` | Soft glow behind title (paused). |
| `--av-gold-faint`   | `rgba(201,162,39,0.40)` | **NEW** — faint border on cream cards. Fixes B1. |

### Jade — magnitude down

| Token | Hex | Use |
|---|---|---|
| `--av-jade`         | `#5B8C5A` | Magnitude DOWN — earthy green, never field. |
| `--av-jade-soft`    | `rgba(91,140,90,0.16)` | Down-tint. |

### Night — used only on /m

| Token | Hex | Use |
|---|---|---|
| `--av-night`        | `#2C1B1F` | Lacquered red-black, only on PlaybackControls shelf above visualizer. |
| `--av-night-soft`   | `rgba(44,27,31,0.85)` | Translucent lacquer. |
| `--av-night-deep`   | `rgba(20,12,14,0.92)` | Deep lacquer (rare). |

### Shadow tokens — NEW

Replaces raw rgba box-shadow literals across components. Fixes audit
quality concern.

| Token | Definition |
|---|---|
| `--av-shadow-card`  | `0 1px 0 rgba(26,20,16,0.06), 0 8px 24px -12px rgba(26,20,16,0.25)` |
| `--av-shadow-panel` | `0 18px 40px -16px rgba(26,20,16,0.45), 0 0 0 1px var(--av-ink-wash)` |
| `--av-shadow-deep`  | `0 6px 18px -8px rgba(26,20,16,0.65), inset 0 1px 0 rgba(244,236,216,0.18)` |
| `--av-shadow-lift`  | `0 4px 12px -6px rgba(26,20,16,0.35), inset 0 0 0 1px var(--av-gold-soft)` |

## Surface vocabulary (precise, named, reusable)

Each surface is a CSS class on a structural div. **Components stop
inline-styling the surface and lean on the class.** Inline style is
only for layout (display, position, padding inside the surface),
not appearance.

### `.av-paper-card`

Rice-paper card with deckled top + bottom edge.
- Background: `var(--av-paper)`.
- Border: 1px `var(--av-gold-faint)` (cream-on-cream, very soft).
- Shadow: `var(--av-shadow-card)`.
- Deckle: SVG mask on `::before` + `::after` for top/bottom rough edge.
- Radius: 4px (the only rounding allowed — paper isn't round).

### `.av-paper-card--lifted`

Modifier. Adds `var(--av-shadow-lift)` and `translateY(-1px)`.
Hover and active states.

### `.av-scroll-panel`

ProfileDropdown specifically. Cream fill, rolled gradient edges at
top + bottom (10-16px tall, vertical gradient simulating a scroll
edge).

### `.av-lacquer-band`

NavBar specifically. Vertical lacquer gradient
(`--av-crimson-deep` → `--av-crimson` → `--av-crimson-deep`), single
hairline `--av-gold` underline at the bottom. **No other surface
uses lacquer.**

### `.av-instrument-shelf`

PlaybackControls bar. `--av-night` lacquered plank with single thin
`--av-gold` line along top + brush-shadowed buttons. **Only appears
above the visualizer (on /m).**

### `.av-ink-divider`

Horizontal brush-line. 1px height, gradient `transparent →
--av-ink-line → transparent`, slight blur for ink-on-paper bleed.

### `.av-brush-button`

Pill button. Cream fill, ink border. Hover: fill crimson, text
cream. Crisp transition.

### `.av-hanko`

Carved seal stamp. Crimson square, cream glyph carved out.
**Two variants**:
- `.av-hanko--clean` (default) — rounded 2px corners.
- `.av-hanko--rough` (used for ONE active-state per panel) — SVG
  mask with broken corner + ink bleed at one edge.

### `.av-section-title`

Calligraphic + gold-underline section title. Used at most ONCE per
panel. Body sections use plain Latin labels in ink-soft.

### `.av-title`

The MHEU plaque ONLY. Gold-leaf gradient through Ma Shan Zheng
glyphs, slow shimmer (paused under prefers-reduced-motion).

## Iconography — brushstroke set

All inline SVG, all `stroke="currentColor"` so parent color drives
hue, all slight feather (`feGaussianBlur stdDeviation="0.25"`).

| Icon | Brush form |
|---|---|
| Play | Single confident rightward wedge |
| Pause | Two tapered vertical strokes |
| Next | Two short rightward chevrons |
| Prev | Two short leftward chevrons |
| Shuffle | Crossed brushstrokes with one bent loop |
| Gear | Stylized chrysanthemum bloom (8 petal flicks around small center circle) |
| Close | Two diagonal strokes, slight curvature |
| Fullscreen | Four corner brackets |

Default color: `var(--av-ink)`. Hover/active: `var(--av-gold)` OR
`var(--av-paper)` over crimson.

## Atmospheric layers (decorations)

5 layers. Each layer has ONE responsibility. None of them try to
dominate.

| Layer | z-index | Visible | Detail |
|---|---|---|---|
| Rice-paper backdrop  | 40 | H/E/U | 3-stop layered gradient + SVG noise multiply blend. Fades to 0 on /m. |
| Ink-wash mountains   | 41 | H/E/U | Two ridges, **subtle horizontal sway** (1-2px sine, 40s period). Fixes V5. |
| Kanji columns        | 45 | ALL  | 4 desktop / 2 mobile. Slow vertical scroll. Opacity 0.15-0.22 — barely there. |
| Cherry petals        | 46 | ALL  | 8 desktop / 4 mobile. **Five-lobed silhouette** (fixes V7). Diagonal drift. |
| Dragon               | 47 | ALL  | Single brushstroke body + minimal head silhouette (fixes V6). Every 60-90s, 15s crossing. |

### Decoration rules

- All animations RAF-gated to 30fps (`prevTime + 33` gate).
- All pause when `document.visibilityState === 'hidden'`.
- All freeze (single static frame) when `prefers-reduced-motion: reduce`.
- All 4 kanji columns share ONE RAF (consolidation — fixes B4).
- All inline `transform` writes, never React state per frame.
- Petals seed initial position from real viewport via
  `useLayoutEffect` (fixes B6).

### Kanji pool — curated, neutral

50 characters from nature / weather / seasons / music / sound /
time. **No political, religious, or emotionally charged glyphs.**

```
山 川 月 日 風 雨 雲 雪 春 夏 秋 冬 花 木 鳥 魚
水 火 土 金 石 海 空 星 光 影 朝 夜 音 声 歌 詩
書 画 紙 墨 筆 茶 竹 松 梅 桜 蘭 菊 鶴 龍 雀 蝶
時 流 静 響
```

## Composition rules

### Grid + asymmetry

- Centered max-width 1100px container for content.
- Nav: profile-icon left, MHEU title center, tabs right — **but on
  mobile, drop the title** (Frutiger Aero pattern).
- Cards stack vertically with 18px gap (more breathing than 12px).
- Inside cards, 24-28px padding minimum (not 16px).
- **Grid-breaking**: the dragon flies diagonally across all four
  tabs without regard for container boundaries. The petals overflow
  the visualizer.

### Spacing rhythm

- 4px / 8px / 12px / 18px / 24px / 32px — six steps, nothing
  between.
- Section dividers (`.av-ink-divider`) have 18px clear above + below.
- Leaderboard rows: 48px tall.
- Feed rows: 56px tall with 6px between.

### Crimson budget per viewport region

- Nav: lacquer band uses crimson (1 use).
- Card: max ONE crimson moment per card (the active glyph, OR the
  primary CTA, OR the active-row tint — pick one).
- Magnitude badges: vermillion (not crimson) for up.
- Hanko: crimson stamp counts as a crimson moment.

### Gold budget per viewport region

- MHEU title plaque: gold (always present).
- Card border: `--av-gold-faint` is permitted everywhere (it's
  faint, doesn't count toward the budget).
- Bright/deep gold elsewhere: 1 use per panel max (e.g., scroll
  divider in ProfileDropdown).

## Motion policy

| Element | Motion |
|---|---|
| Card hover | `translateY(-1px)` + shadow swap, 160ms ease. |
| Tab change | No animation (paper doesn't slide). Color transition 200ms. |
| Brush-button | Background + color transition 180ms ease. Hover translate -1px. |
| Title plaque | Gold shimmer, 14s linear infinite. Paused under prefers-reduced-motion. |
| Mountains | 40s sine sway 1-2px (NEW). Frozen under prefers-reduced-motion. |
| Kanji | 30fps scroll. Frozen under prefers-reduced-motion. |
| Petals | 30fps drift + sine sway + rotation. Frozen under prefers-reduced-motion. |
| Dragon | Every 60-90s, 15s flight. Body undulates via single `<path d>` rewrite per RAF tick. Frozen under prefers-reduced-motion (static dragon in upper-left corner at 0.35 opacity). |

**No element ever uses `setInterval` for visuals.** All motion is
CSS keyframes or RAF.

## Defensive coding requirements

These come from the rebuild audit and are non-negotiable in the
rebuild.

1. **`Promise.allSettled` everywhere**, not `Promise.all`, when
   fetching multiple Supabase resources in parallel. A single failed
   query must never blank the panel.
2. **No undefined CSS variables.** Every `var(--av-*)` reference
   must resolve. Lint pass before commit.
3. **Animations must be cleanable.** Every `useEffect` returning a
   RAF must `cancelAnimationFrame` AND reset `lastTime.current = 0`.
4. **Re-init guards** — collections like the petal specs Array must
   re-init only when COUNT actually changes, not on every render.
5. **Viewport size read before paint** for any layer that positions
   from `w/h` — use `useLayoutEffect`.

## Accessibility

- Every decorative layer is `aria-hidden`.
- Focus ring: `--av-gold` (2px solid). Visible against paper and
  against crimson.
- Color contrast: `--av-ink-soft` on `--av-paper` = 8.4:1 (AAA).
  `--av-crimson` on `--av-paper` = 6.1:1 (AA). Vermillion on paper =
  4.8:1 (AA large only — never use for body text).
- All clickable hanko stamps and brush icons have visible
  text alternative OR accessible name.

## Self-imposed constraints (the "no" list)

These were the failure modes of v1. The rebuild forbids them.

1. **No more than 1 kanji glyph per panel** in chrome roles.
2. **No box-shadow rgba literals** — use shadow tokens.
3. **No inline `background` declarations** that duplicate a class
   surface — use the class.
4. **No undefined CSS variable references.**
5. **No `Promise.all` for parallel Supabase fetches.**
6. **No dragon ornamentation** beyond body + head silhouette + tail
   tip.
7. **No `setInterval`** for visual animation.
8. **No Latin font fallback to system-ui** — falls back to serif
   (Georgia, Times New Roman).
9. **No purple anywhere.** (Skill compliance — purple gradients on
   white = cliché.)
10. **No mobile collision** between centered MHEU title and the
    tabs strip — title hides on `width < 700px`.

## Acceptance criteria for the rebuild

- All 11 components compile and type-check.
- `npm run build` succeeds.
- The five risk surfaces in the audit (B1-B5) are gone.
- A user opening any one panel can identify the dominant surface
  (paper) and the single accent (one crimson moment, one gold
  moment) without effort.
- The dragon, when it crosses, surprises a user once and then they
  ignore it — it must not become annoying.
- prefers-reduced-motion completely freezes all decorations.
- Theme switcher round-trips cleanly: Frutiger Aero → Asian
  Vibrant → Frutiger Aero → Asian Vibrant with no console errors.
