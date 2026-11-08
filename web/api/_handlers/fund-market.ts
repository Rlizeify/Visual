// Market + macro data for /fund (benchmark, risk-free rate, inflation).
// Routes:
//   GET  - cached row; refreshes first if it is older than 12h. Signed-in
//          accounts with the 'fund' grant only: has_feature('fund') runs as
//          the caller's JWT, the same check (signature + expiry) that guards
//          the fund tables. Not auth.getUser(): it also needs the login
//          session to still exist, which rejects tokens the page itself can
//          still use (403 session_not_found after a sign-out elsewhere).
//
// The weekday cron (`/api/cron?job=market-snapshot`) also calls
// refreshFundMarket(). Each source fails on its own: a failed source keeps
// the previous row's value, so one outage never blanks the page. Parsers
// live in src/features/fund/lib/macro.ts.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { service } from '../_admin.js'
import {
  cpiYoY, fredMonthly, latestRate, parseBlsSeries, parseFredSeries, parseYahooMonthly,
  type BenchmarkKind, type FundMarket, type MonthCloses,
} from '../../src/features/fund/lib/macro.js'
import { parseTreasuryCsv, treasuryCsvUrl } from '../../src/lib/options/marketData.js'

const STALE_MS = 12 * 60 * 60 * 1000
const RETRY_MS = 15 * 60 * 1000
const FETCH_TIMEOUT_MS = 8000
// FRED is a fallback and often hangs for Vercel's servers: don't wait long.
const FRED_TIMEOUT_MS = 4000
const BROWSER_UA = 'Mozilla/5.0 (compatible; mheu.lol market snapshot)'
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/'
const FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id='

async function fetchText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err))

async function fetchBenchmark(errors: string[]): Promise<{ closes: MonthCloses; kind: BenchmarkKind; source: string } | null> {
  for (const [sym, kind] of [['%5ESP500TR', 'total-return'], ['%5EGSPC', 'price']] as const) {
    try {
      const closes = parseYahooMonthly(JSON.parse(await fetchText(`${YAHOO}${sym}?range=10y&interval=1mo`)))
      if (closes) return { closes, kind, source: `yahoo:${decodeURIComponent(sym)}` }
      errors.push(`yahoo ${sym}: unparseable`)
    } catch (err) {
      errors.push(`yahoo ${sym}: ${msg(err)}`)
    }
  }
  try {
    const closes = fredMonthly(parseFredSeries(await fetchText(`${FRED}SP500&fq=Monthly&fam=eop`)))
    if (closes) return { closes, kind: 'price', source: 'fred:SP500' }
    errors.push('fred SP500: no observations')
  } catch (err) {
    errors.push(`fred SP500: ${msg(err)}`)
  }
  return null
}

async function fred(id: string, since: string, errors: string[]): Promise<Array<[string, number]>> {
  try {
    const rows = parseFredSeries(await fetchText(`${FRED}${id}&cosd=${since}`, FRED_TIMEOUT_MS))
    if (!rows.length) errors.push(`fred ${id}: no observations`)
    return rows
  } catch (err) {
    errors.push(`fred ${id}: ${msg(err)}`)
    return []
  }
}

/** 3-month T-bill from the Treasury par curve (percent → decimal). */
async function treasuryBill(errors: string[]): Promise<{ rate: number; date: string } | null> {
  const year = new Date().getUTCFullYear()
  for (const y of [year, year - 1]) {
    try {
      const parsed = parseTreasuryCsv(await fetchText(treasuryCsvUrl(y)))
      const pct = parsed?.curve['3 Mo']
      if (parsed && typeof pct === 'number') return { rate: pct / 100, date: parsed.date }
    } catch (err) {
      errors.push(`treasury ${y}: ${msg(err)}`)
    }
  }
  errors.push('treasury: no 3 Mo yield')
  return null
}

async function blsCpi(errors: string[]): Promise<{ yoy: number; date: string } | null> {
  try {
    const yoy = cpiYoY(parseBlsSeries(JSON.parse(await fetchText('https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0'))))
    if (yoy) return yoy
    errors.push('bls cpi: no year-over-year pair')
  } catch (err) {
    errors.push(`bls cpi: ${msg(err)}`)
  }
  return null
}

async function readRow(sb: SupabaseClient): Promise<FundMarket | null> {
  const { data, error } = await sb.from('fund_market').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(`fund_market read failed: ${error.message}`)
  return data as FundMarket | null
}

/** Fetch every source; a failed source keeps `prev`'s value. */
async function fetchFundMarket(prev: FundMarket | null): Promise<{ row: FundMarket & { id: number }; errors: string[] }> {
  const errors: string[] = []
  const now = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const recent = iso(new Date(now.getTime() - 30 * 86_400_000))
  const twoYears = iso(new Date(now.getTime() - 800 * 86_400_000))
  const [bench, tbill, ff, cpi] = await Promise.all([
    fetchBenchmark(errors),
    treasuryBill(errors).then(r => r ?? fred('DGS3MO', recent, errors).then(latestRate)),
    fred('DFF', recent, errors).then(latestRate),
    blsCpi(errors).then(r => r ?? fred('CPIAUCSL', twoYears, errors).then(cpiYoY)),
  ])
  if (!bench && !tbill && !ff && !cpi) throw new Error(`All fund market sources failed: ${errors.join('; ')}`)

  const row = {
    id: 1,
    benchmark: bench?.closes ?? prev?.benchmark ?? null,
    benchmark_kind: bench?.kind ?? prev?.benchmark_kind ?? null,
    tbill_3m: tbill?.rate ?? prev?.tbill_3m ?? null,
    fed_funds: ff?.rate ?? prev?.fed_funds ?? null,
    rates_date: tbill?.date ?? ff?.date ?? prev?.rates_date ?? null,
    cpi_yoy: cpi?.yoy ?? prev?.cpi_yoy ?? null,
    cpi_date: cpi?.date ?? prev?.cpi_date ?? null,
    source: [bench?.source ?? 'benchmark-prev', tbill || ff ? 'rates' : 'rates-prev', cpi ? 'cpi' : 'cpi-prev'].join('+'),
    fetched_at: now.toISOString(),
  }
  return { row, errors }
}

/** Fetch every source and upsert the single row. */
export async function refreshFundMarket(sb: SupabaseClient): Promise<{ market: FundMarket; errors: string[] }> {
  const { row, errors } = await fetchFundMarket(await readRow(sb).catch(() => null))
  const { data, error } = await sb.from('fund_market').upsert(row, { onConflict: 'id' }).select('*').single()
  if (error) throw new Error(`fund_market upsert failed: ${error.message}`)
  if (errors.length) console.warn('[fund-market] source errors', errors)
  return { market: data as FundMarket, errors }
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'missing bearer token' })

  let sb: SupabaseClient
  try { sb = service() } catch (err) { return res.status(500).json({ error: msg(err) }) }

  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY
  if (!url || !anon) return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' })
  const asCaller = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: auth } },
  })
  const { data: allowed, error: grantErr } = await asCaller.rpc('has_feature', { f: 'fund' })
  if (grantErr) return res.status(401).json({ error: 'invalid token' })
  if (allowed !== true) return res.status(403).json({ error: 'forbidden' })

  let latest: FundMarket | null
  try {
    latest = await readRow(sb)
  } catch (err) {
    // Table missing (migration not applied yet): serve live data, unpersisted.
    console.error('[fund-market] table read failed, serving live data:', msg(err))
    try {
      const { row, errors } = await fetchFundMarket(null)
      return res.status(200).json({ market: row, refreshed: true, persisted: false, sourceErrors: errors })
    } catch (liveErr) {
      return res.status(502).json({ error: msg(liveErr) })
    }
  }
  // A row missing a value retries after 15 min instead of waiting out 12h.
  const age = latest ? Date.now() - new Date(latest.fetched_at).getTime() : Infinity
  const partial = !latest?.benchmark || latest.tbill_3m === null || latest.cpi_yoy === null
  if (latest && age < (partial ? RETRY_MS : STALE_MS)) {
    return res.status(200).json({ market: latest, refreshed: false })
  }
  try {
    const { market, errors } = await refreshFundMarket(sb)
    return res.status(200).json({ market, refreshed: true, sourceErrors: errors })
  } catch (err) {
    console.error('[fund-market] refresh failed:', msg(err))
    return res.status(latest ? 200 : 502).json({ market: latest, refreshed: false, refreshError: msg(err) })
  }
}
