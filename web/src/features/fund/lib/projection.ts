// Forward projection of the fund balance ("weather forecast").
//
// Model: each month the balance grows by a lognormal factor whose
// arithmetic mean/sd are the chosen monthly return and volatility, then
// the planned withdrawal comes out. The expected return can fade toward a
// long-run rate (half-life in months), since a hot streak rarely lasts.
// Paths share one seeded set of normal draws, so dragging a slider moves
// the forecast smoothly and the sensitivities ("Greeks") are stable
// bump-and-reprice differences.

export interface ProjectionInput {
  start: number
  months: number
  /** Expected monthly return, arithmetic (0.05 = 5%/month). */
  mean: number
  /** Monthly volatility after the doubt multiplier. */
  sd: number
  /** Return the expected return fades toward. */
  longRun: number
  /** Months for the gap to long-run to halve; Infinity = no fade. */
  fadeHalfLife: number
  /** Dollars withdrawn at each month end. */
  withdrawal: number
}

export const PERCENTILES = [5, 10, 25, 50, 75, 90, 95] as const
export type Pct = (typeof PERCENTILES)[number]

export interface Projection {
  months: number[]
  bands: Record<Pct, number[]>
  mean: number[]
  samples: number[][]
  /** Terminal balances, sorted. */
  terminal: Float64Array
  probBelowStart: number
  probBroke: number
}

export const PATHS = 2000
const SAMPLE_PATHS = 36

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let cache: { key: string; z: Float64Array } | null = null

/** PATHS × months standard normals, reused across calls (common random numbers). */
export function normals(months: number, seed = 20250115): Float64Array {
  const key = `${months}:${seed}`
  if (cache?.key === key) return cache.z
  const rnd = mulberry32(seed)
  const z = new Float64Array(PATHS * months)
  for (let i = 0; i < z.length; i += 2) {
    const u = Math.max(rnd(), 1e-12), v = rnd()
    const r = Math.sqrt(-2 * Math.log(u))
    z[i] = r * Math.cos(2 * Math.PI * v)
    if (i + 1 < z.length) z[i + 1] = r * Math.sin(2 * Math.PI * v)
  }
  cache = { key, z }
  return z
}

/** Lognormal (m, s) of the monthly growth factor for an arithmetic mean/sd. */
export function logParams(mean: number, sd: number) {
  const g = Math.max(1 + mean, 1e-6)
  const s2 = Math.log(1 + (sd * sd) / (g * g))
  return { m: Math.log(g) - s2 / 2, s: Math.sqrt(s2) }
}

export function meanAt(p: ProjectionInput, month: number): number {
  if (!Number.isFinite(p.fadeHalfLife)) return p.mean
  return p.longRun + (p.mean - p.longRun) * Math.pow(0.5, month / Math.max(p.fadeHalfLife, 0.25))
}

/** Simulates every path; calls visit(month, path, balance) after each month. */
function simulate(p: ProjectionInput, visit: (month: number, path: number, v: number) => void) {
  const H = p.months
  const z = normals(H)
  const params = Array.from({ length: H }, (_, k) => logParams(meanAt(p, k), p.sd))
  for (let i = 0; i < PATHS; i++) {
    let v = p.start
    for (let k = 0; k < H; k++) {
      if (v > 0) {
        const { m, s } = params[k]
        v = Math.max(0, v * Math.exp(m + s * z[i * H + k]) - p.withdrawal)
      }
      visit(k + 1, i, v)
    }
  }
}

export function quantile(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length
  if (!n) return 0
  const x = (n - 1) * q, lo = Math.floor(x), hi = Math.ceil(x)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo)
}

export function project(p: ProjectionInput): Projection {
  const H = Math.max(1, Math.round(p.months))
  const q = { ...p, months: H }
  const byMonth = Array.from({ length: H }, () => new Float64Array(PATHS))
  simulate(q, (k, i, v) => { byMonth[k - 1][i] = v })
  const samples: number[][] = Array.from({ length: SAMPLE_PATHS }, (_, j) => {
    const i = Math.floor((j * PATHS) / SAMPLE_PATHS)
    return [p.start, ...byMonth.map(col => col[i])]
  })
  const bands = Object.fromEntries(PERCENTILES.map(pc => [pc, [p.start]])) as Record<Pct, number[]>
  const mean = [p.start]
  for (const col of byMonth) {
    mean.push(col.reduce((s, x) => s + x, 0) / PATHS)
    col.sort()
    for (const pc of PERCENTILES) bands[pc].push(quantile(col, pc / 100))
  }
  const terminal = byMonth[H - 1]
  let below = 0, broke = 0
  for (const v of terminal) { if (v < p.start) below++; if (v <= 0) broke++ }
  return {
    months: Array.from({ length: H + 1 }, (_, k) => k),
    bands, mean, samples, terminal,
    probBelowStart: below / PATHS,
    probBroke: broke / PATHS,
  }
}

/** Mean and 5th percentile of the balance at the horizon only. */
function terminalStats(p: ProjectionInput): { mean: number; p5: number; median: number } {
  const H = Math.max(1, Math.round(p.months))
  const col = new Float64Array(PATHS)
  simulate({ ...p, months: H }, (k, i, v) => { if (k === H) col[i] = v })
  const mean = col.reduce((s, x) => s + x, 0) / PATHS
  col.sort()
  return { mean, p5: quantile(col, 0.05), median: quantile(col, 0.5) }
}

export interface Greeks {
  /** $ change in expected horizon balance per +1 pt monthly return. */
  delta: number
  /** Change in delta per +1 pt monthly return. */
  gamma: number
  /** $ change in the 5th-percentile (bad case) balance per +1 pt volatility. */
  vega: number
  /** Expected $ the fund earns in the next month (carry). */
  theta: number
  /** $ change in expected horizon balance per +$100/month withdrawn. */
  rho: number
  /** % change in expected balance per 1% change in the return (elasticity). */
  elasticity: number
}

export function greeks(p: ProjectionInput): Greeks {
  const h = 0.0025 // 0.25 pt bumps, reported per 1 pt
  const base = terminalStats(p)
  const up = terminalStats({ ...p, mean: p.mean + h, longRun: p.longRun + h })
  const dn = terminalStats({ ...p, mean: p.mean - h, longRun: p.longRun - h })
  const vUp = terminalStats({ ...p, sd: p.sd + h })
  const vDn = terminalStats({ ...p, sd: Math.max(0, p.sd - h) })
  const wUp = terminalStats({ ...p, withdrawal: p.withdrawal + 100 })
  const next = terminalStats({ ...p, months: 1 })
  const delta = ((up.mean - dn.mean) / (2 * h)) * 0.01
  return {
    delta,
    gamma: ((up.mean - 2 * base.mean + dn.mean) / (h * h)) * 0.0001,
    vega: ((vUp.p5 - vDn.p5) / (p.sd - Math.max(0, p.sd - h) + h)) * 0.01,
    theta: next.mean - p.start,
    rho: wUp.mean - base.mean,
    elasticity: base.mean > 0 && p.mean !== 0 ? (delta / 0.01) * (p.mean / base.mean) : 0,
  }
}

/** 3D: each month's distribution as relative likelihood (peak = 1). */
export function likelihoodSurface(proj: Projection, p: ProjectionInput, bins = 60) {
  // Span today's balance through the widest month (the fan can bend down).
  const lo = Math.max(0, Math.min(p.start, ...proj.bands[5]) * 0.92)
  const hi = Math.max(...proj.bands[95], p.start) * 1.08
  const step = (hi - lo) / bins
  const y = Array.from({ length: bins }, (_, b) => lo + (b + 0.5) * step)
  const H = proj.months.length - 1
  const counts = Array.from({ length: bins }, () => new Float64Array(H + 1))
  simulate({ ...p, months: H }, (k, _i, v) => {
    const b = Math.floor((v - lo) / step)
    if (b >= 0 && b < bins) counts[b][k]++
  })
  const start = Math.floor((p.start - lo) / step)
  if (start >= 0 && start < bins) counts[start][0] = PATHS
  // Light smoothing across balance bins, then normalize each month.
  const z = counts.map((row, b) => Array.from(row, (_, k) =>
    ((counts[b - 1]?.[k] ?? 0) + 2 * row[k] + (counts[b + 1]?.[k] ?? 0)) / 4))
  for (let k = 0; k <= H; k++) {
    let peak = 0
    for (let b = 0; b < bins; b++) peak = Math.max(peak, z[b][k])
    if (peak > 0) for (let b = 0; b < bins; b++) z[b][k] /= peak
  }
  return { x: proj.months, y, z }
}

/** 3D: median balance by month for a range of expected monthly returns. */
export function outcomeSurface(p: ProjectionInput, lo = -0.02, hi = 0.1, steps = 25) {
  const H = Math.max(1, Math.round(p.months))
  const rates = Array.from({ length: steps }, (_, i) => lo + ((hi - lo) * i) / (steps - 1))
  const z = rates.map(rate => {
    const proj = project({ ...p, months: H, mean: rate, longRun: Number.isFinite(p.fadeHalfLife) ? p.longRun : rate })
    return proj.bands[50]
  })
  return { x: Array.from({ length: H + 1 }, (_, k) => k), y: rates, z }
}
