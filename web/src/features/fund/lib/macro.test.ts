import { describe, expect, it } from 'vitest'
import { benchmarkReturn, benchmarkSeries, compare, cpiYoY, fredMonthly, latestRate, parseBlsSeries, parseFredSeries, parseYahooMonthly } from './macro'

describe('fund macro parsers', () => {
  it('maps Yahoo monthly bars to months, last bar (live quote) wins', () => {
    const ts = ['2026-09-01T04:00:00Z', '2026-10-01T04:00:00Z', '2026-11-01T04:00:00Z', '2026-11-06T21:37:09Z'].map(d => Date.parse(d) / 1000)
    const closes = parseYahooMonthly({ chart: { result: [{ timestamp: ts, indicators: { quote: [{ close: [100, 110, null, 99] }] } }] } })
    expect(closes).toEqual({ '2026-09': 100, '2026-10': 110, '2026-11': 99 })
  })

  it('reads FRED CSV, skipping missing observations', () => {
    const rows = parseFredSeries('observation_date,DGS3MO\n2026-11-04,4.21\n2026-11-05,.\n2026-11-06,')
    expect(rows).toEqual([['2026-11-04', 4.21]])
    expect(latestRate(rows)).toEqual({ rate: 0.0421, date: '2026-11-04' })
    expect(fredMonthly(parseFredSeries('d,SP500\n2026-09-01,100\n2026-10-01,105\n2026-11-01,'))).toEqual({ '2026-09': 100, '2026-10': 105 })
  })

  it('computes CPI year over year from the newest month with a match', () => {
    expect(cpiYoY([['2025-09-01', 300], ['2026-08-01', 305], ['2026-09-01', 309]])?.yoy).toBeCloseTo(0.03)
  })

  it('reads BLS CPI newest-first data into oldest-first monthly rows', () => {
    const rows = parseBlsSeries({ Results: { series: [{ data: [
      { year: '2026', period: 'M09', value: '309' }, { year: '2026', period: 'M13', value: '1' }, { year: '2025', period: 'M09', value: '300' },
    ] }] } })
    expect(rows).toEqual([['2025-09-01', 300], ['2026-09-01', 309]])
    expect(cpiYoY(rows)?.yoy).toBeCloseTo(0.03)
  })

  it('benchmark returns use the previous month-end close', () => {
    const c = { '2026-08': 100, '2026-09': 110, '2026-11': 120 }
    expect(benchmarkReturn(c, '2026-09-30')).toBeCloseTo(0.1)
    expect(benchmarkReturn(c, '2026-11-30')).toBeNull()
    expect(benchmarkSeries(c)).toHaveLength(1)
  })

  it('a fund that is 2× the benchmark has beta 2 and correlation 1', () => {
    const cmp = compare([[0.02, 0.01], [-0.04, -0.02], [0.06, 0.03]])!
    expect(cmp.beta).toBeCloseTo(2)
    expect(cmp.correlation).toBeCloseTo(1)
    expect(cmp.beatRate).toBeCloseTo(2 / 3)
  })
})
