// Inject a user's accent color into CSS custom properties on :root.
// Also derives dim/bright/bg/border/glow variants from the hex so existing
// rgba(0, 220, 200, ...) tints can be replaced with var(--accent-color-*).

const STORAGE_KEY = 'mheu_accent_color'

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
  root.setProperty('--accent-color', hex)
  root.setProperty('--accent-color-bright', hex)
  root.setProperty('--accent-color-dim',    `rgba(${r}, ${g}, ${b}, 0.6)`)
  root.setProperty('--accent-color-bg',     `rgba(${r}, ${g}, ${b}, 0.08)`)
  root.setProperty('--accent-color-border', `rgba(${r}, ${g}, ${b}, 0.4)`)
  root.setProperty('--accent-color-glow',   `rgba(${r}, ${g}, ${b}, 0.3)`)
  try { localStorage.setItem(STORAGE_KEY, hex) } catch { /* private mode */ }
}

export function loadCachedAccentColor(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}
