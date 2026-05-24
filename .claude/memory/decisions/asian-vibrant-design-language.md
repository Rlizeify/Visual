# 2026-05-24 — Asian Vibrant Design Language

## Aesthetic anchor

Classical East Asian scroll painting. Confident brushwork, rich pigment,
controlled negative space. Cherry blossoms, dragons, mountains,
ink-wash skies, gold accents on deep reds and pinks. **Not anime.**
**Not cute.** **Not nationalistic.** Curated neutral characters drawn
from nature / seasons / weather / music vocabularies.

## Palette (12+ named tokens)

Every value is tinted — no pure black, no pure white.

| Token | Hex | Role |
|---|---|---|
| `--av-paper`        | `#F4ECD8` | Rice-paper background (warm cream, the canvas) |
| `--av-paper-soft`   | `#EFE3C8` | Rice paper, lower layer |
| `--av-paper-edge`   | `#D8C9A6` | Deckled edges of cards |
| `--av-ink`          | `#1A1410` | Warm sumi black — primary text and ink strokes |
| `--av-ink-soft`     | `#3D2F26` | Body text on paper |
| `--av-ink-wash`     | `rgba(26,20,16,0.18)` | Soft ink wash (mountains, shadows) |
| `--av-crimson`      | `#8B1A1A` | Deep crimson — primary accent (nav band, hanko stamp) |
| `--av-crimson-deep` | `#5C0F0F` | Lacquer crimson — borders, deep accents |
| `--av-crimson-soft` | `rgba(139,26,26,0.12)` | Crimson tint (panel backgrounds on dark) |
| `--av-vermillion`   | `#C0392B` | Vermillion — magnitude up, brushstroke fills |
| `--av-blossom`      | `#F8C8DC` | Cherry blossom pink |
| `--av-blossom-deep` | `#E89BB5` | Saturated blossom pink (badges) |
| `--av-gold`         | `#C9A227` | Aged gold leaf — calligraphy, accent text |
| `--av-gold-bright`  | `#E8C158` | Highlight gold |
| `--av-gold-deep`    | `#8C6E15` | Aged-bronze gold (borders on cream) |
| `--av-jade`         | `#5B8C5A` | Jade green — magnitude down (cooled — uses jade not red so reds stay sacred to up) |
| `--av-jade-soft`    | `rgba(91,140,90,0.14)` | Jade tint |
| `--av-night`        | `#2C1B1F` | Lacquered red-black (chrome surfaces on M tab) |
| `--av-night-soft`   | `rgba(44,27,31,0.85)` | Translucent lacquer |

Magnitude convention: positive = vermillion (auspicious red), negative
= jade. Two distinct hues, no green/red collision with conventional
gain/loss expectations because both feel "earthy".

## Typography

Two fonts, both loaded via Google Fonts `@import` at the top of
`tokens.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@400;600;700&display=swap');
```

| Family | Role |
|---|---|
| **Ma Shan Zheng** | Display — calligraphic brush. MHEU title, tab labels, section headers, magnitude badges (single glyph). |
| **Noto Serif SC** | Body — clean East Asian serif. Wide weight + Latin coverage. Used for usernames, paragraph copy, controls. |

Falls back to `serif` if Google Fonts is blocked.

Token: `--font-display: 'Ma Shan Zheng', 'Noto Serif SC', serif`
Token: `--font-body: 'Noto Serif SC', Georgia, serif`
Token: `--font-ui: var(--font-body)` (overrides the global default while
the theme is active)

## Surface treatment language

A panel in Asian Vibrant is a piece of **paper, scroll, or lacquered
wood** — never a frosted glass plate.

- **Paper card**: cream `--av-paper` fill, 1px `--av-ink-wash` border,
  deckled (rough-cut) edges via SVG mask, slight drop shadow. Used for
  H/E placeholders, social-feed rows, leaderboard.
- **Scroll panel**: ProfileDropdown. Cream fill with darker rolled
  edges at top + bottom (10px gradient bands). Ink-line section
  dividers inside.
- **Lacquer band**: NavBar. Deep crimson `--av-crimson-deep` lacquer
  with a single thin `--av-gold` underline. MHEU title in gold
  calligraphy.
- **Instrument shelf**: PlaybackControls. Lacquered wood `--av-night`
  base with vermillion brushstroke buttons.
- **Hanko (seal stamp)**: 28-32px filled square, `--av-crimson`,
  rounded corners 2px, white kanji-style character carved out via SVG.
  Used for: tab-audio capture button, magnitude badge backgrounds, the
  ACTIVE indicator on the theme switcher.

## Iconography

All transport / control icons are hand-drawn SVG brushstrokes — varied
stroke width, slight feather, slight imperfection. Stored inline in the
component, not loaded as external assets.

| Icon | Brush form |
|---|---|
| Play | Single confident triangle stroke, rightward — like a fan opening |
| Pause | Two vertical brush strokes, equal weight, slight taper |
| Next | Two short rightward strokes |
| Prev | Two short leftward strokes |
| Shuffle | Crossed brush strokes forming a loose X with one bend |
| Gear (settings) | Stylized chrysanthemum bloom — circle with 8 petal-flicks |
| Close | Single diagonal stroke, slight curvature |
| Fullscreen | Four corner brackets in brushstroke |

All icons use `stroke="var(--av-ink)"` by default and switch to
`var(--av-gold)` on hover or active.

## Negative space rules

Traditional scroll painting reserves 30-50% of the canvas as breathing
room. Built into the layouts:

- `DashboardShell` padding-top: 56px nav + 24px breathing.
- Cards use `padding: 24px 28px` not `16px`.
- Section dividers are ink lines with 20px clear space on each side.
- The social feed adds 4px vertical gap between rows (not 2px).
- Leaderboard table rows are 48px tall, not 32px.

The decorations (petals, dragon, kanji) deliberately stay sparse —
~8 petals total, dragon every 60-90s, 4 kanji columns at most. The
empty paper is the design.

## Decorative layer architecture

| Layer | z-index | Visible on |
|---|---|---|
| Rice paper backdrop | 40 | H/E/U (replaces fog) |
| Ink-wash mountains  | 41 | H/E/U |
| Kanji columns       | 45 | ALL routes (low opacity ambient) |
| Cherry petals       | 46 | ALL routes |
| Dragon              | 47 | ALL routes |
| NavBar              | 1000 | ALL |
| ProfileDropdown     | 1100 | when open |

On `/m`, the visualizer is z-100 → the decorative layers 40/41 are
behind it (invisible), but the kanji/petals/dragon at 45-47 sit
on top of the viz as ambient overlay. Their opacity is low (0.15-0.35)
so they don't fight the visualizer.

## Animation policy

- All CSS `@keyframes` or `requestAnimationFrame` — never
  `setInterval` for visuals.
- Kanji and petals throttled to 30fps (`requestAnimationFrame` with
  `prevTime + 33` gate).
- Dragon flight uses a single SVG `<path>` `transform: translate +
  rotate` along a precomputed bezier — one `transform` write per frame,
  no per-frame DOM creation.
- All layers pause when `document.visibilityState === 'hidden'`.
- All layers freeze to a single static frame when
  `prefers-reduced-motion: reduce`.

## Character pool (curated, neutral)

50 characters drawn from nature, weather, seasons, music, sound, time.
Avoids political, religious, nationalistic, or emotionally charged
glyphs.

```
山 川 月 日 風 雨 雲 雪 春 夏 秋 冬 花 木 鳥 魚
水 火 土 金 石 海 空 星 光 影 朝 夜 音 声 歌 詩
書 画 紙 墨 筆 茶 竹 松 梅 桜 蘭 菊 鶴 龍 雀 蝶
時 流 静 響
```

Each column picks a random subset on mount and rotates through them as
they scroll off the top.
