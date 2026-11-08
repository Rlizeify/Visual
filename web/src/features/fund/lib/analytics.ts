// History statistics and calculus on the fund's month-end series.
//
// Returns are time-weighted: each gain row's gain ÷ the balance it was
// earned on, so deposits and withdrawals don't count as performance.

import type { Ledger } from './ledger'

export interface MonthReturn { date: string; r: number; gain: number; base: number }

export function monthlyReturns(ledger: Ledger): MonthReturn[] {
  return ledger.rows
    .filter(r => r.entry.kind === 'gain' && r.pct !== null)
    .map(r => ({ date: r.entry.entry_date, r: r.pct as number, gain: r.entry.amount, base: r.before }))
}

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0)

/** Exponential recency weights (newest = 1); halfLife in months, Infinity = equal. */
export function recencyWeights(n: number, halfLife: number): number[] {
  if (!Number.isFinite(halfLife)) return Array(n).fill(1)
  return Array.from({ length: n }, (_, i) => Math.pow(0.5, (n - 1 - i) / Math.max(halfLife, 0.25)))
}

export function weightedMoments(xs: readonly number[], ws: readonly number[]): { mean: number; sd: number } {
  const W = sum(ws)
  if (!xs.length || W <= 0) return { mean: 0, sd: 0 }
  const mean = xs.reduce((s, x, i) => s + x * ws[i], 0) / W
  const v1 = W, v2 = ws.reduce((s, w) => s + w * w, 0)
  const ss = xs.reduce((s, x, i) => s + ws[i] * (x - mean) ** 2, 0)
  // Reliability-weighted unbiased variance (equals the n-1 form for equal weights).
  const denom = v1 - v2 / v1
  return { mean, sd: denom > 0 ? Math.sqrt(ss / denom) : 0 }
}

export interface HistoryStats {
  months: number
  meanMonthly: number
  geoMonthly: number
  sdMonthly: number
  annualized: number
  annualVol: number
  best: MonthReturn | null
  worst: MonthReturn | null
  winRate: number
  maxDrawdown: number
  sharpe: number
  sortino: number
  skew: number
  kurtosis: number
  twr: number
  irr: number | null
  avgGain3: number
  avgGain12: number
  /** Linear trend of the monthly return, per month (is the rate rising?). */
  trendPerMonth: number
  monthsToDouble: number | null
}

export function historyStats(ledger: Ledger, rets: readonly MonthReturn[], rfAnnual = 0): HistoryStats {
  const rs = rets.map(m => m.r)
  const n = rs.length
  const { mean, sd } = weightedMoments(rs, Array(n).fill(1))
  const growth = rs.reduce((g, r) => g * (1 + r), 1)
  const geo = n ? Math.pow(growth, 1 / n) - 1 : 0
  const rfM = Math.pow(1 + rfAnnual, 1 / 12) - 1
  const down = rs.filter(r => r < rfM)
  const dsd = down.length ? Math.sqrt(sum(down.map(r => (r - rfM) ** 2)) / n) : 0
  let peak = 1, idx = 1, mdd = 0
  for (const r of rs) { idx *= 1 + r; peak = Math.max(peak, idx); mdd = Math.min(mdd, idx / peak - 1) }
  const m3 = n ? sum(rs.map(r => (r - mean) ** 3)) / n : 0
  const m4 = n ? sum(rs.map(r => (r - mean) ** 4)) / n : 0
  const pv = n ? sum(rs.map(r => (r - mean) ** 2)) / n : 0
  const xbar = (n - 1) / 2
  const sxx = sum(rs.map((_, i) => (i - xbar) ** 2))
  const slope = sxx > 0 ? sum(rs.map((r, i) => (i - xbar) * (r - mean))) / sxx : 0
  const gains = rets.map(m => m.gain)
  const avg = (k: number) => (gains.length ? sum(gains.slice(-k)) / Math.min(k, gains.length) : 0)
  let best: MonthReturn | null = null, worst: MonthReturn | null = null
  for (const m of rets) {
    if (!best || m.r > best.r) best = m
    if (!worst || m.r < worst.r) worst = m
  }
  return {
    months: n,
    meanMonthly: mean,
    geoMonthly: geo,
    sdMonthly: sd,
    annualized: Math.pow(1 + geo, 12) - 1,
    annualVol: sd * Math.sqrt(12),
    best, worst,
    winRate: n ? rs.filter(r => r > 0).length / n : 0,
    maxDrawdown: mdd,
    sharpe: sd > 0 ? ((mean - rfM) / sd) * Math.sqrt(12) : 0,
    sortino: dsd > 0 ? ((mean - rfM) / dsd) * Math.sqrt(12) : Infinity,
    skew: pv > 0 ? m3 / pv ** 1.5 : 0,
    kurtosis: pv > 0 ? m4 / pv ** 2 - 3 : 0,
    twr: growth - 1,
    irr: moneyWeightedReturn(ledger),
    avgGain3: avg(3),
    avgGain12: avg(12),
    trendPerMonth: slope,
    monthsToDouble: geo > 0 ? Math.log(2) / Math.log(1 + geo) : null,
  }
}

const DAY = 86_400_000
const t = (iso: string) => Date.parse(iso + 'T00:00:00Z')

/** Annualized money-weighted return (XIRR) of the members' cash flows. */
export function moneyWeightedReturn(ledger: Ledger): number | null {
  const flows = ledger.rows
    .filter(r => r.entry.kind !== 'gain')
    .map(r => ({ t: t(r.entry.entry_date), v: r.entry.kind === 'deposit' ? -r.entry.amount : r.entry.amount }))
  const last = ledger.rows.at(-1)
  if (!flows.length || !last) return null
  flows.push({ t: t(last.entry.entry_date), v: ledger.balance })
  const t0 = flows[0].t
  const npv = (rate: number) => flows.reduce((s, f) => s + f.v / Math.pow(1 + rate, (f.t - t0) / DAY / 365), 0)
  let lo = -0.99, hi = 100
  if (npv(lo) * npv(hi) > 0) return null
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (npv(lo) * npv(mid) <= 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

// ── calculus ────────────────────────────────────────────────────────────

export type SeriesKey = 'balance' | 'gains' | 'index'

export interface Series { dates: string[]; y: number[] }

/** Month-end samples (one per gain row). */
export function seriesOf(ledger: Ledger, key: SeriesKey): Series {
  const dates: string[] = [], y: number[] = []
  let cum = 0, idx = 100
  for (const r of ledger.rows) {
    if (r.entry.kind !== 'gain') continue
    cum += r.entry.amount
    idx *= 1 + (r.pct ?? 0)
    dates.push(r.entry.entry_date)
    y.push(key === 'balance' ? r.balance : key === 'gains' ? cum : idx)
  }
  return { dates, y }
}

/** d/dt with dt = 1 month: central differences inside, one-sided at the ends. */
export function derivative(y: readonly number[]): number[] {
  const n = y.length
  if (n < 2) return y.map(() => 0)
  return y.map((_, i) => i === 0 ? y[1] - y[0] : i === n - 1 ? y[n - 1] - y[n - 2] : (y[i + 1] - y[i - 1]) / 2)
}

export function nthDerivative(y: readonly number[], order: number): number[] {
  let out = [...y]
  for (let k = 0; k < order; k++) out = derivative(out)
  return out
}

/** Running ∫ y dt (trapezoid, dt = 1 month): units × months. */
export function cumulativeIntegral(y: readonly number[]): number[] {
  const out = [0]
  for (let i = 1; i < y.length; i++) out.push(out[i - 1] + (y[i] + y[i - 1]) / 2)
  return out
}
