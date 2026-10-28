import { describe, it, expect } from 'vitest'
import { parseYahooChart, parseFredCsv, parseTreasuryCsv } from './marketData.js'

describe('parseYahooChart', () => {
  it('uses regularMarketPrice/Time from meta', () => {
    const json = { chart: { result: [{ meta: { regularMarketPrice: 7735.81, regularMarketTime: 1793204538 } }] } }
    expect(parseYahooChart(json)).toEqual({ close: 7735.81, asOf: new Date(1793204538000).toISOString() })
  })

  it('falls back to the last non-null bar', () => {
    const json = { chart: { result: [{
      meta: {},
      timestamp: [1792675800, 1792762200, 1793021400],
      indicators: { quote: [{ close: [7663.43, 7623.68, null] }] },
    }] } }
    expect(parseYahooChart(json)).toEqual({ close: 7623.68, asOf: new Date(1792762200000).toISOString() })
  })

  it('returns null on error payloads', () => {
    expect(parseYahooChart({ chart: { result: null, error: { code: 'Not Found' } } })).toBeNull()
    expect(parseYahooChart(null)).toBeNull()
  })
})

describe('parseFredCsv', () => {
  it('takes the last valid observation and skips "." placeholders', () => {
    const csv = 'observation_date,SP500\n2026-10-26,7676.77\n2026-10-27,7722.60\n2026-10-28,.\n'
    expect(parseFredCsv(csv)).toEqual({ close: 7722.6, asOf: '2026-10-27T20:00:00.000Z' })
  })

  it('returns null when empty', () => {
    expect(parseFredCsv('observation_date,SP500\n')).toBeNull()
  })
})

describe('parseTreasuryCsv', () => {
  const csv = [
    'Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"',
    '10/27/2026,4.10,4.11,4.18,4.22,4.31,4.34,4.50,4.70,4.80,4.82,4.91,4.99,5.34,5.30',
    '10/26/2026,4.11,4.13,4.18,4.22,4.32,4.35,4.47,4.68,4.79,4.84,4.91,5.00,5.35,5.31',
  ].join('\n')

  it('returns the newest row keyed by tenor label', () => {
    const parsed = parseTreasuryCsv(csv)
    expect(parsed?.date).toBe('2026-10-27')
    expect(parsed?.curve['1 Mo']).toBe(4.1)
    expect(parsed?.curve['1.5 Month']).toBe(4.11)
    expect(parsed?.curve['30 Yr']).toBe(5.3)
    expect(Object.keys(parsed!.curve)).toHaveLength(14)
  })

  it('skips blank cells and returns null for an empty year', () => {
    const sparse = 'Date,"1 Mo","2 Yr"\n01/02/2026,,4.5\n'
    expect(parseTreasuryCsv(sparse)).toEqual({ date: '2026-01-02', curve: { '2 Yr': 4.5 } })
    expect(parseTreasuryCsv('')).toBeNull()
  })
})
