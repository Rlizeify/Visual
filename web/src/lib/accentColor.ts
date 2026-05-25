// Inject a user's accent color into CSS custom properties on :root.
// Writes inline on documentElement (highest specificity → beats every
// per-theme :root[data-theme='...'] fallback).
//
// Two naming families are emitted:
//   1. Legacy 5-variant: --accent-color, -bright, -dim, -bg, -border, -glow.
//      Wired through ~25 components and `MHEUShell.css`.
//   2. Brief-named pair: --user-accent (solid) + --user-accent-glass
//      (rgba at low alpha, used as a frosted-glass wash layered over
//      the base dark/cream surface — see decisions/accent-color-paired-tokens.md).
//
// Glass alpha chosen: 0.15. Lowest value where a colored wash is
// visible on top of `rgba(0,20,30,0.55)` frosted glass; highest value
// where the panel still reads as glass instead of opaque accent.

const STORAGE_KEY = 'mheu_accent_color'
const GLASS_ALPHA = 0.15

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '')
  const full = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned
  const num = parseInt(full, 16)
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  }
}

export function applyAccentColor(hex: string): void {
  if (!hex || !/^#[0-9a-fA-F]{3,8}$/.test(hex)) return
  const { r, g, b } = hexToRgb(hex)
  const root = document.documentElement.style
  // Legacy family (kept — existing call sites read these).
  root.setProperty('--accent-color', hex)
  root.setProperty('--accent-color-bright', hex)
  root.setProperty('--accent-color-dim',    `rgba(${r}, ${g}, ${b}, 0.6)`)
  root.setProperty('--accent-color-bg',     `rgba(${r}, ${g}, ${b}, 0.08)`)
  root.setProperty('--accent-color-border', `rgba(${r}, ${g}, ${b}, 0.4)`)
  root.setProperty('--accent-color-glow',   `rgba(${r}, ${g}, ${b}, 0.3)`)
  // Brief-named pair (solid + visible glass wash).
  root.setProperty('--user-accent',        hex)
  root.setProperty('--user-accent-glass',  `rgba(${r}, ${g}, ${b}, ${GLASS_ALPHA})`)
  try { localStorage.setItem(STORAGE_KEY, hex) } catch { /* private mode */ }
}

export function loadCachedAccentColor(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}
