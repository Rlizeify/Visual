// Market + macro data for /fund (benchmark, risk-free rate, inflation).
// Routes:
//   GET  - cached row; refreshes first if it is older than 12h. Signed-in
//          accounts with the 'fund' grant only (Bearer JWT, checked here).
//
// The weekday cron (`/api/cron?job=market-snapshot`) also calls
// refreshFundMarket(). Each source fails on its own: a failed source keeps
// the previous row's value, so one outage never blanks the page. Parsers
// live in src/features/fund/lib/macro.ts.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { SupabaseClient } from '@supabase/supabase-js'
import { service } from '../_admin.js'
import {
  cpiYoY, fredMonthly, latestRate, parseFredSeries, parseYahooMonthly,
  type BenchmarkKind, type FundMarket, type MonthCloses,
} from '../../src/features/fund/lib/macro.js'

const STALE_MS = 12 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 8000
const BROWSER_UA = 'Mozilla/5.0 (compatible; mheu.lol market snapshot)'
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/'
const FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id='

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
    const rows = parseFredSeries(await fetchText(`${FRED}${id}&cosd=${since}`))
    if (!rows.length) errors.push(`fred ${id}: no observations`)
    return rows
  } catch (err) {
    errors.push(`fred ${id}: ${msg(err)}`)
    return []
  }
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
    fred('DGS3MO', recent, errors).then(latestRate),
    fred('DFF', recent, errors).then(latestRate),
    fred('CPIAUCSL', twoYears, errors).then(cpiYoY),
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
    source: [bench?.source ?? 'benchmark-prev', tbill || ff ? 'fred:rates' : 'rates-prev', cpi ? 'fred:cpi' : 'cpi-prev'].join('+'),
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

  const { data: u, error: authErr } = await sb.auth.getUser(auth.slice(7))
  if (authErr || !u?.user) return res.status(401).json({ error: 'invalid token' })
  const { data: grant, error: grantErr } = await sb.from('feature_access')
    .select('feature').eq('user_id', u.user.id).eq('feature', 'fund').maybeSingle()
  if (grantErr) return res.status(500).json({ error: grantErr.message })
  if (!grant) return res.status(403).json({ error: 'forbidden' })

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
  if (latest && Date.now() - new Date(latest.fetched_at).getTime() < STALE_MS) {
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
