// Chart colors come from tokens.css (no literals here): the jet colormap
// (--cmap-0..8) plus the surface/text/border tokens for axes and grid.

const CMAP = 9

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

let stops: [number, number, number][] | null = null
function jetStops() {
  stops ??= Array.from({ length: CMAP }, (_, i) => hexToRgb(token(`--cmap-${i}`) || '#000'))
  return stops
}

/** Jet color at t in [0, 1], optional alpha. */
export function jet(t: number, alpha = 1): string {
  const s = jetStops()
  const x = Math.min(1, Math.max(0, t)) * (s.length - 1)
  const i = Math.min(s.length - 2, Math.floor(x)), f = x - i
  const c = s[i].map((v, k) => Math.round(v + (s[i + 1][k] - v) * f))
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`
}

/** Plotly colorscale for surfaces. */
export function jetScale(): [number, string][] {
  return Array.from({ length: CMAP }, (_, i) => [i / (CMAP - 1), jet(i / (CMAP - 1))])
}

export function chartTheme() {
  return {
    text: token('--text-secondary'),
    muted: token('--text-muted'),
    strong: token('--text-primary'),
    grid: token('--border'),
    line: token('--border-strong'),
    surface: token('--surface-1'),
    accent: token('--accent'),
    font: token('--font-sans'),
  }
}

/** Shared 2D layout: transparent, token-colored axes, compact margins. */
export function baseLayout(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const c = chartTheme()
  const axis = { gridcolor: c.grid, zerolinecolor: c.line, linecolor: c.line, tickfont: { color: c.muted }, title: { font: { color: c.text } } }
  return {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: c.font, color: c.text, size: 12 },
    margin: { l: 64, r: 16, t: 16, b: 44 },
    hovermode: 'x unified',
    hoverlabel: { bgcolor: c.surface, bordercolor: c.line, font: { color: c.strong } },
    showlegend: false,
    xaxis: { ...axis },
    yaxis: { ...axis },
    ...extra,
  }
}
