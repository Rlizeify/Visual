// Market snapshot (SPX close + US Treasury par yield curve) for /investing.
// Routes:
//   GET  ?force=1 - same, but refreshes if older than 60s (refresh button)
//   GET  - latest snapshot (public — /investing works without an
//          account). Refreshes on demand if the latest row was fetched
//          more than 6h ago, so anonymous traffic can trigger at most one
//          upstream fetch per 6h window; a failed refresh still returns
//          the stale row with `refreshError` set.
//
// The daily cron (`/api/cron?job=market-snapshot`) calls
// refreshMarketSnapshot() directly.
//
// SPX: Yahoo chart API first, FRED SP500 CSV as fallback. If both fail
// the previous snapshot's SPX close/as_of is carried forward (so the
// "as of" shown in the UI stays honest) and the UI lets the user type
// spot manually. Treasury curve failure likewise carries the previous
// curve forward.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  parseYahooChart,
  parseFredCsv,
  parseTreasuryCsv,
  treasuryCsvUrl,
  type SpxQuote,
  type ParsedCurve,
} from '../../src/lib/options/marketData.js'

const STALE_MS = 6 * 60 * 60 * 1000
// `?force=1` (the page's refresh button) re-fetches if older than this —
// short enough to feel live, long enough that a public endpoint can't be
// used to hammer the upstream sources.
const FORCE_MIN_MS = 60 * 1000
const FETCH_TIMEOUT_MS = 8000
const BROWSER_UA = 'Mozilla/5.0 (compatible; mheu.lol market snapshot)'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export interface MarketSnapshotRow {
  id: string
  as_of: string
  spx_close: number | null
  treasury_curve: Record<string, number> | null
  curve_date: string | null
  source: string
  fetched_at: string
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: '*/*' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function fetchSpx(errors: string[]): Promise<{ quote: SpxQuote; source: string } | null> {
  try {
    const text = await fetchText('https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=5d&interval=1d')
    const quote = parseYahooChart(JSON.parse(text))
    if (quote) return { quote, source: 'yahoo' }
    errors.push('yahoo: unparseable response')
  } catch (err) {
    errors.push(`yahoo: ${err instanceof Error ? err.message : String(err)}`)
  }
  try {
    const quote = parseFredCsv(await fetchText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500'))
    if (quote) return { quote, source: 'fred' }
    errors.push('fred: no observations')
  } catch (err) {
    errors.push(`fred: ${err instanceof Error ? err.message : String(err)}`)
  }
  return null
}

async function fetchCurve(errors: string[]): Promise<ParsedCurve | null> {
  // Current-year CSV is empty for the first business days of January,
  // so fall back to the prior year.
  const year = new Date().getUTCFullYear()
  for (const y of [year, year - 1]) {
    try {
      const parsed = parseTreasuryCsv(await fetchText(treasuryCsvUrl(y)))
      if (parsed) return parsed
    } catch (err) {
      errors.push(`treasury ${y}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  errors.push('treasury: no curve rows')
  return null
}

async function latestSnapshot(supabase: SupabaseClient): Promise<MarketSnapshotRow | null> {
  const { data, error } = await supabase
    .from('market_snapshot')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`market_snapshot read failed: ${error.message}`)
  return data as MarketSnapshotRow | null
}

/** Fetch fresh data and upsert a snapshot row. Returns the row + per-source errors. */
export async function refreshMarketSnapshot(
  supabase: SupabaseClient,
): Promise<{ snapshot: MarketSnapshotRow; errors: string[] }> {
  const errors: string[] = []
  const [spx, curve, prev] = await Promise.all([
    fetchSpx(errors),
    fetchCurve(errors),
    latestSnapshot(supabase).catch(() => null),
  ])

  if (!spx && !curve) {
    throw new Error(`All market sources failed: ${errors.join('; ')}`)
  }

  const prevSpxSource = prev?.source?.split('+')[0]
  const spxSource = spx?.source ?? (prev?.spx_close != null ? prevSpxSource : 'none') ?? 'none'
  const row = {
    as_of: spx?.quote.asOf ?? prev?.as_of ?? new Date().toISOString(),
    spx_close: spx?.quote.close ?? prev?.spx_close ?? null,
    treasury_curve: curve?.curve ?? prev?.treasury_curve ?? null,
    curve_date: curve?.date ?? prev?.curve_date ?? null,
    source: `${spxSource}+${curve ? 'treasury' : prev?.treasury_curve ? 'treasury-prev' : 'no-curve'}`,
    fetched_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('market_snapshot')
    .upsert(row, { onConflict: 'as_of' })
    .select('*')
    .single()
  if (error) throw new Error(`market_snapshot upsert failed: ${error.message}`)

  if (errors.length) console.warn('[market-snapshot] source errors', errors)
  return { snapshot: data as MarketSnapshotRow, errors }
}

// Used only when the market_snapshot table can't be read (e.g. the
// migration isn't applied yet): fetch live, don't persist. Cached per
// warm instance for the same 6h window so public traffic can't hammer
// the upstream sources.
let liveCache: { snapshot: Omit<MarketSnapshotRow, 'id'>; at: number } | null = null

async function fetchLiveSnapshot(maxAgeMs: number): Promise<{ snapshot: Omit<MarketSnapshotRow, 'id'>; errors: string[] }> {
  if (liveCache && Date.now() - liveCache.at < maxAgeMs) return { snapshot: liveCache.snapshot, errors: [] }
  const errors: string[] = []
  const [spx, curve] = await Promise.all([fetchSpx(errors), fetchCurve(errors)])
  if (!spx && !curve) throw new Error(`All market sources failed: ${errors.join('; ')}`)
  const snapshot = {
    as_of: spx?.quote.asOf ?? new Date().toISOString(),
    spx_close: spx?.quote.close ?? null,
    treasury_curve: curve?.curve ?? null,
    curve_date: curve?.date ?? null,
    source: `${spx?.source ?? 'none'}+${curve ? 'treasury' : 'no-curve'}`,
    fetched_at: new Date().toISOString(),
  }
  liveCache = { snapshot, at: Date.now() }
  return { snapshot, errors }
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const maxAgeMs = req.query.force === '1' ? FORCE_MIN_MS : STALE_MS

  let supabase: ReturnType<typeof getServiceSupabase>
  try {
    supabase = getServiceSupabase()
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Database configuration error' })
  }

  let latest: MarketSnapshotRow | null
  try {
    latest = await latestSnapshot(supabase)
  } catch (err) {
    console.error('[market-snapshot] table read failed, serving live data unpersisted:', err instanceof Error ? err.message : err)
    try {
      const { snapshot, errors } = await fetchLiveSnapshot(maxAgeMs)
      return res.status(200).json({ snapshot, refreshed: true, persisted: false, sourceErrors: errors })
    } catch (liveErr) {
      return res.status(502).json({ error: liveErr instanceof Error ? liveErr.message : String(liveErr) })
    }
  }

  const stale = !latest || Date.now() - new Date(latest.fetched_at).getTime() > maxAgeMs
  if (!stale) return res.status(200).json({ snapshot: latest, refreshed: false })

  try {
    const { snapshot, errors } = await refreshMarketSnapshot(supabase)
    return res.status(200).json({ snapshot, refreshed: true, sourceErrors: errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[market-snapshot] refresh failed:', msg)
    return res.status(latest ? 200 : 502).json({ snapshot: latest, refreshed: false, refreshError: msg })
  }
}
