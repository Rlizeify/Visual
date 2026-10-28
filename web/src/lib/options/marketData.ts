// Parsers for the free, no-key market data sources behind the daily
// market snapshot. Pure functions (no fetch) so they're unit-testable;
// the network side lives in api/_handlers/market-snapshot.ts.
//
// Sources (verified reachable 2026-10-28):
//   SPX primary   Yahoo chart API  query1.finance.yahoo.com/v8/finance/chart/^GSPC
//                 (needs a browser User-Agent; bare requests get 429)
//   SPX fallback  FRED SP500 CSV   fred.stlouisfed.org/graph/fredgraph.csv?id=SP500
//   Rates         Treasury daily par yield curve CSV (home.treasury.gov)
//   Stooq ^spx was tested and refused connections — not used.

import type { TreasuryCurve } from './rates.js'

export interface SpxQuote {
  close: number
  /** ISO timestamp of the quote. */
  asOf: string
}

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number; regularMarketTime?: number }
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: Array<number | null> }> }
    }>
  }
}

export function parseYahooChart(json: unknown): SpxQuote | null {
  const r = (json as YahooChart)?.chart?.result?.[0]
  if (!r) return null
  const price = r.meta?.regularMarketPrice
  const time = r.meta?.regularMarketTime
  if (typeof price === 'number' && price > 0 && typeof time === 'number') {
    return { close: price, asOf: new Date(time * 1000).toISOString() }
  }
  // Fall back to the last non-null daily bar.
  const ts = r.timestamp ?? []
  const closes = r.indicators?.quote?.[0]?.close ?? []
  for (let k = Math.min(ts.length, closes.length) - 1; k >= 0; k--) {
    const c = closes[k]
    if (typeof c === 'number' && c > 0) return { close: c, asOf: new Date(ts[k] * 1000).toISOString() }
  }
  return null
}

/** FRED CSV: `observation_date,SP500` rows; missing days are "." or blank. */
export function parseFredCsv(csv: string): SpxQuote | null {
  const lines = csv.trim().split(/\r?\n/).slice(1)
  for (let k = lines.length - 1; k >= 0; k--) {
    const [date, val] = lines[k].split(',')
    const close = Number(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(close) && close > 0) {
      // FRED gives the date only; stamp it at the 16:00 ET close (20:00 UTC, EDT).
      return { close, asOf: `${date}T20:00:00.000Z` }
    }
  }
  return null
}

export interface ParsedCurve {
  /** `YYYY-MM-DD` */
  date: string
  curve: TreasuryCurve
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
}

/** Treasury daily par yield CSV. Rows are newest-first; returns the newest. */
export function parseTreasuryCsv(csv: string): ParsedCurve | null {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return null
  const headers = splitCsvLine(lines[0])
  let best: ParsedCurve | null = null
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const m = cells[0]?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!m) continue
    const date = `${m[3]}-${m[1]}-${m[2]}`
    if (best && date <= best.date) continue
    const curve: TreasuryCurve = {}
    for (let c = 1; c < headers.length; c++) {
      const v = Number(cells[c])
      if (cells[c] !== '' && cells[c] !== undefined && Number.isFinite(v)) curve[headers[c]] = v
    }
    if (Object.keys(curve).length > 0) best = { date, curve }
  }
  return best
}

export function treasuryCsvUrl(year: number): string {
  return 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/'
    + `${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`
}
