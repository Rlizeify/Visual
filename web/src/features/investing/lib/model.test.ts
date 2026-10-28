/**
 * /investing model tests, including the acceptance sanity case:
 * SPX call, strike 9500, expiry 2028-06-15, premium entered by hand.
 */

import { describe, it, expect } from 'vitest'
import { buildMarket, solveCandidate, scenarioCell, bestPerColumn, type Cell } from './model'
import type { CandidateRow } from './types'

// Treasury par curve as fetched 2026-10-28 (curve date 2026-10-27).
const CURVE = {
  '1 Mo': 4.1, '1.5 Month': 4.11, '2 Mo': 4.18, '3 Mo': 4.22, '4 Mo': 4.31, '6 Mo': 4.34,
  '1 Yr': 4.5, '2 Yr': 4.7, '3 Yr': 4.8, '5 Yr': 4.82, '7 Yr': 4.91, '10 Yr': 4.99, '20 Yr': 5.34, '30 Yr': 5.3,
}
const market = buildMarket(CURVE, null, 0.013)

function candidate(over: Partial<CandidateRow> = {}): CandidateRow {
  return {
    id: 'c1', user_id: 'u1', label: null, type: 'call', strike: 9500, expiry: '2028-06-15',
    premium: 150, contracts: 1, iv_override: null, spot_at_entry: 7736.76,
    entered_at: '2026-10-28T16:30:00Z', archived: false, ...over,
  }
}

describe('sanity case: 9500C 2028-06-15', () => {
  const c = solveCandidate(candidate(), market)

  it('solves a plausible IV (10–40%)', () => {
    expect(c.ivError).toBeNull()
    expect(c.option!.iv).toBeGreaterThan(0.10)
    expect(c.option!.iv).toBeLessThan(0.40)
    expect(c.cost).toBe(15000)
    expect(c.breakeven).toBe(9650)
  })

  it('P&L rises monotonically with SPX level', () => {
    for (const date of ['2027-04-28', '2027-10-28', '2028-06-15']) {
      const pnls = [6900, 7700, 8500, 9300, 10000, 10800].map(l => scenarioCell(c, date, l, 0, market, 'pnl'))
      for (let k = 1; k < pnls.length; k++) {
        const a = pnls[k - 1], b = pnls[k]
        expect(a.kind).toBe('value')
        if (a.kind === 'value' && b.kind === 'value') expect(b.pnl).toBeGreaterThanOrEqual(a.pnl)
      }
    }
  })

  it('value decays toward expiry at a fixed level', () => {
    const level = 9000
    const vals = ['2026-10-28', '2027-04-28', '2027-10-28', '2028-03-01', '2028-06-15']
      .map(d => scenarioCell(c, d, level, 0, market, 'multiple'))
      .map(cell => (cell.kind === 'value' ? cell.value : NaN))
    for (let k = 1; k < vals.length; k++) expect(vals[k]).toBeLessThan(vals[k - 1])
    expect(vals[vals.length - 1]).toBe(0) // OTM at expiry → intrinsic 0
  })

  it('flags a date after expiry', () => {
    expect(scenarioCell(c, '2028-06-16', 10000, 0, market, 'pnl')).toEqual({ kind: 'expired' })
  })
})

describe('solveCandidate', () => {
  it('uses the override when set', () => {
    const c = solveCandidate(candidate({ iv_override: 0.2 }), market)
    expect(c.ivSource).toBe('override')
    expect(c.option!.iv).toBe(0.2)
  })

  it('reports a below-intrinsic premium instead of throwing', () => {
    const c = solveCandidate(candidate({ strike: 6000, premium: 1000 }), market)
    expect(c.option).toBeNull()
    expect(c.ivError).toMatch(/below intrinsic/)
  })
})

describe('bestPerColumn', () => {
  it('picks the highest metric and ignores expired cells', () => {
    const v = (m: number): Cell => ({ kind: 'value', metric: m, pnl: m, value: m, atExpiry: false })
    const grid: Cell[][] = [
      [v(1), v(5), { kind: 'expired' }],
      [v(3), v(2), { kind: 'expired' }],
    ]
    expect(bestPerColumn(grid)).toEqual([1, 0, -1])
  })
})
