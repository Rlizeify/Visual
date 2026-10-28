// Glue between stored candidates and the options engine: build market
// params, solve each candidate's IV, and compute matrix cells.

import {
  CONTRACT_MULTIPLIER,
  ImpliedVolError,
  breakevenAtExpiry,
  curvePoints,
  greeksAt,
  impliedVol,
  interpolateRate,
  valueAtScenario,
  yearFraction,
  type MarketParams,
  type PricedOption,
} from '../../../lib/options/index.js'
import type { CandidateRow, CellMetric } from './types'

/** Used only if there is no curve and no manual rate. */
export const FALLBACK_RATE = 0.04

export function buildMarket(
  curve: Record<string, number> | null | undefined,
  rateOverride: number | null,
  divYield: number,
): MarketParams {
  const pts = curvePoints(curve)
  return {
    rateFor: years => rateOverride ?? interpolateRate(pts, years) ?? FALLBACK_RATE,
    divYield,
  }
}

/** Local calendar date of an ISO timestamp, `YYYY-MM-DD`. */
export function localDateOf(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export interface SolvedCandidate {
  row: CandidateRow
  /** Null when the solve failed and there is no override. */
  option: PricedOption | null
  ivSource: 'solved' | 'override'
  ivError: string | null
  cost: number
  breakeven: number
}

/**
 * IV is solved from the premium against spot_at_entry on the entry
 * date (that's when the premium was observed), unless overridden.
 */
export function solveCandidate(row: CandidateRow, market: MarketParams): SolvedCandidate {
  const cost = row.premium * CONTRACT_MULTIPLIER * row.contracts
  const breakeven = breakevenAtExpiry(row.type, row.strike, row.premium)
  const base = { row, cost, breakeven }
  if (row.iv_override != null) {
    return { ...base, option: { type: row.type, strike: row.strike, expiry: row.expiry, iv: row.iv_override }, ivSource: 'override', ivError: null }
  }
  const t = yearFraction(localDateOf(row.entered_at), row.expiry)
  try {
    const iv = impliedVol(row.premium, {
      type: row.type,
      spot: row.spot_at_entry,
      strike: row.strike,
      t,
      rate: market.rateFor(t),
      divYield: market.divYield,
    })
    return { ...base, option: { type: row.type, strike: row.strike, expiry: row.expiry, iv }, ivSource: 'solved', ivError: null }
  } catch (err) {
    const msg = err instanceof ImpliedVolError ? err.message : 'IV solve failed.'
    return { ...base, option: null, ivSource: 'solved', ivError: msg }
  }
}

export function positionGreeks(c: SolvedCandidate, asOf: string, spot: number, market: MarketParams) {
  if (!c.option) return null
  const g = greeksAt(c.option, asOf, spot, market)
  return {
    delta: g.delta,
    /** $ per day for the whole position. */
    thetaPerDay: g.thetaPerDay * CONTRACT_MULTIPLIER * c.row.contracts,
  }
}

export type Cell =
  | { kind: 'value'; metric: number; pnl: number; value: number; atExpiry: boolean }
  | { kind: 'expired' }
  | { kind: 'n/a' }

export function scenarioCell(
  c: SolvedCandidate,
  date: string,
  level: number,
  ivShift: number,
  market: MarketParams,
  metric: CellMetric,
): Cell {
  if (!c.option) return { kind: 'n/a' }
  const v = valueAtScenario(c.option, date, level, ivShift, market)
  if (v.status === 'expired') return { kind: 'expired' }
  const pnl = (v.value - c.row.premium) * CONTRACT_MULTIPLIER * c.row.contracts
  const m = metric === 'pnl' ? pnl
    : metric === 'pct' ? (v.value - c.row.premium) / c.row.premium
    : v.value / c.row.premium
  return { kind: 'value', metric: m, pnl, value: v.value, atExpiry: v.atExpiry }
}

/** Index of the best (highest-metric) row per column, or -1 if none. */
export function bestPerColumn(cells: Cell[][]): number[] {
  const cols = cells[0]?.length ?? 0
  const best: number[] = []
  for (let j = 0; j < cols; j++) {
    let idx = -1
    let max = -Infinity
    cells.forEach((row, i) => {
      const cell = row[j]
      if (cell.kind === 'value' && cell.metric > max) {
        max = cell.metric
        idx = i
      }
    })
    best.push(idx)
  }
  return best
}

export function formatMetric(metric: CellMetric, v: number): string {
  if (metric === 'pnl') {
    const abs = Math.abs(v)
    const s = abs >= 10000 ? `${(abs / 1000).toFixed(1)}k` : Math.round(abs).toLocaleString('en-US')
    return `${v < 0 ? '−' : '+'}$${s}`
  }
  if (metric === 'pct') return `${v < 0 ? '−' : '+'}${Math.abs(v * 100).toFixed(0)}%`
  return `${v.toFixed(2)}×`
}

/** Round an SPX level to the nearest 5 (SPX strike spacing). */
export function roundLevel(x: number): number {
  return Math.round(x / 5) * 5
}
