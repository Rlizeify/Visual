// Live market + macro data for /fund: S&P 500 monthly closes (benchmark),
// 3-month T-bill / fed funds (risk-free rate) and CPI (inflation).
//
// Pure functions only (no fetch, no imports) so the server handler
// (api/_handlers/fund-market.ts) and the page share them and they're
// unit-testable. All sources are keyless (verified 2026-11-08):
//   Benchmark  Yahoo chart ^SP500TR (total return) monthly, ^GSPC price
//              index as second choice, FRED SP500 month-end as last resort
//   Rates      3-month T-bill from the Treasury par yield CSV (same source
//              as /investing), FRED DGS3MO as fallback; fed funds FRED DFF
//   Inflation  BLS CPI-U (CUUR0000SA0), FRED CPIAUCSL as fallback
// FRED often doesn't answer Vercel's servers (2026-11-08), hence the
// Treasury and BLS first choices.

/** `YYYY-MM` → month-end close. */
export type MonthCloses = Record<string, number>

export type BenchmarkKind = 'total-return' | 'price'

/** Row of public.fund_market (one row, server-written). */
export interface FundMarket {
  benchmark: MonthCloses | null
  benchmark_kind: BenchmarkKind | null
  /** Decimal (0.042 = 4.2%). */
  tbill_3m: number | null
  fed_funds: number | null
  rates_date: string | null
  /** CPI year over year, decimal. */
  cpi_yoy: number | null
  cpi_date: string | null
  source: string
  fetched_at: string
}

interface YahooChart {
  chart?: {
    result?: Array<{
      timestamp?: number[]
      indicators?: { quote?: Array<{ close?: Array<number | null> }> }
    }>
  }
}

/**
 * Yahoo monthly bars are stamped at the month's first trading day (New York
 * time) and close at the month end; the last bar repeats as the live quote.
 * The current month's value is therefore month-to-date.
 */
export function parseYahooMonthly(json: unknown): MonthCloses | null {
  const r = (json as YahooChart)?.chart?.result?.[0]
  const ts = r?.timestamp ?? []
  const closes = r?.indicators?.quote?.[0]?.close ?? []
  const out: MonthCloses = {}
  for (let k = 0; k < Math.min(ts.length, closes.length); k++) {
    const c = closes[k]
    // +12h so a midnight-New-York stamp (04:00/05:00 UTC) can't fall back a month.
    if (typeof c === 'number' && c > 0) out[new Date(ts[k] * 1000 + 43_200_000).toISOString().slice(0, 7)] = c
  }
  return Object.keys(out).length >= 2 ? out : null
}

/** FRED CSV → [date, value] rows, skipping "." / blank observations. */
export function parseFredSeries(csv: string): Array<[string, number]> {
  const out: Array<[string, number]> = []
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [date, val] = line.split(',')
    const v = Number(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && val !== '' && val !== '.' && Number.isFinite(v)) out.push([date, v])
  }
  return out
}

/** FRED month-end series (`fq=Monthly&fam=eop`): rows dated the 1st. */
export function fredMonthly(rows: Array<[string, number]>): MonthCloses | null {
  const out: MonthCloses = {}
  for (const [d, v] of rows) if (v > 0) out[d.slice(0, 7)] = v
  return Object.keys(out).length >= 2 ? out : null
}

/** Latest observation of a percent series, as a decimal. */
export function latestRate(rows: Array<[string, number]>): { rate: number; date: string } | null {
  const last = rows.at(-1)
  return last ? { rate: last[1] / 100, date: last[0] } : null
}

interface BlsResponse {
  Results?: { series?: Array<{ data?: Array<{ year?: string; period?: string; value?: string }> }> }
}

/** BLS timeseries API v1 → [YYYY-MM-01, value] rows, oldest first (monthly periods only). */
export function parseBlsSeries(json: unknown): Array<[string, number]> {
  const data = (json as BlsResponse)?.Results?.series?.[0]?.data ?? []
  const out: Array<[string, number]> = []
  for (const d of data) {
    const m = d.period?.match(/^M(0[1-9]|1[0-2])$/)
    const v = Number(d.value)
    if (m && /^\d{4}$/.test(d.year ?? '') && Number.isFinite(v) && v > 0) out.push([`${d.year}-${m[1]}-01`, v])
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]))
}

/** CPI index rows → latest year-over-year change. */
export function cpiYoY(rows: Array<[string, number]>): { yoy: number; date: string } | null {
  const by = new Map(rows.map(([d, v]) => [d.slice(0, 7), v]))
  for (let i = rows.length - 1; i >= 0; i--) {
    const [d, v] = rows[i]
    const prev = by.get(`${Number(d.slice(0, 4)) - 1}${d.slice(4, 7)}`)
    if (prev && prev > 0) return { yoy: v / prev - 1, date: d }
  }
  return null
}

const prevMonth = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

/** Benchmark return for the month containing `date` (YYYY-MM-DD), or null. */
export function benchmarkReturn(closes: MonthCloses, date: string): number | null {
  const ym = date.slice(0, 7)
  const a = closes[prevMonth(ym)], b = closes[ym]
  return a && b ? b / a - 1 : null
}

/** All monthly benchmark returns, oldest first. */
export function benchmarkSeries(closes: MonthCloses): number[] {
  const keys = Object.keys(closes).sort()
  const out: number[] = []
  for (let i = 1; i < keys.length; i++) if (keys[i - 1] === prevMonth(keys[i])) out.push(closes[keys[i]] / closes[keys[i - 1]] - 1)
  return out
}

export interface Comparison {
  months: number
  fundTotal: number
  benchTotal: number
  /** Fund return per unit of benchmark return (regression slope). */
  beta: number
  /** Annualized return not explained by beta × benchmark (Jensen, over rf). */
  alpha: number
  correlation: number
  /** Share of months the fund beat the benchmark. */
  beatRate: number
}

/** Fund vs benchmark over the months both have. `pairs` = [fund r, bench r]. */
export function compare(pairs: ReadonlyArray<readonly [number, number]>, rfAnnual = 0): Comparison | null {
  const n = pairs.length
  if (n < 2) return null
  const rfM = Math.pow(1 + rfAnnual, 1 / 12) - 1
  const f = pairs.map(p => p[0] - rfM), b = pairs.map(p => p[1] - rfM)
  const mf = f.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n
  let cov = 0, vb = 0, vf = 0
  for (let i = 0; i < n; i++) { cov += (f[i] - mf) * (b[i] - mb); vb += (b[i] - mb) ** 2; vf += (f[i] - mf) ** 2 }
  const beta = vb > 0 ? cov / vb : 0
  return {
    months: n,
    fundTotal: pairs.reduce((g, p) => g * (1 + p[0]), 1) - 1,
    benchTotal: pairs.reduce((g, p) => g * (1 + p[1]), 1) - 1,
    beta,
    alpha: Math.pow(1 + mf - beta * mb, 12) - 1,
    correlation: vb > 0 && vf > 0 ? cov / Math.sqrt(vb * vf) : 0,
    beatRate: pairs.filter(p => p[0] > p[1]).length / n,
  }
}
