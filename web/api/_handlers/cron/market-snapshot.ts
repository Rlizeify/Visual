/**
 * Cron job: daily market snapshot for /investing, plus the /fund market +
 * macro row (benchmark, rates, CPI).
 *
 * Schedule: `30 21 * * 1-5` (vercel.json) — weekdays after the US close
 * (16:00 ET = 20:00/21:00 UTC). Hobby-tier crons fire once a day within
 * the scheduled hour, which is all this needs. The /api/market-snapshot
 * and /api/fund-market GETs also refresh on demand when stale. The two
 * refreshes are independent: one failing doesn't skip the other.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { refreshMarketSnapshot } from '../market-snapshot.js'
import { refreshFundMarket } from '../fund-market.js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err))

export async function handler(_req: VercelRequest, res: VercelResponse) {
  let sb: ReturnType<typeof getServiceSupabase>
  try { sb = getServiceSupabase() } catch (err) { return res.status(500).json({ ok: false, error: msg(err) }) }

  const [snap, fund] = await Promise.allSettled([refreshMarketSnapshot(sb), refreshFundMarket(sb)])
  const out: Record<string, unknown> = {}
  if (snap.status === 'fulfilled') {
    const { snapshot, errors } = snap.value
    console.log('[cron] market snapshot', { as_of: snapshot.as_of, spx: snapshot.spx_close, source: snapshot.source })
    out.snapshot = snapshot
    out.sourceErrors = errors
  } else {
    console.error('[cron] market snapshot failed:', msg(snap.reason))
    out.error = msg(snap.reason)
  }
  if (fund.status === 'fulfilled') {
    console.log('[cron] fund market', { source: fund.value.market.source })
    out.fundSource = fund.value.market.source
    out.fundSourceErrors = fund.value.errors
  } else {
    console.error('[cron] fund market failed:', msg(fund.reason))
    out.fundError = msg(fund.reason)
  }
  const ok = snap.status === 'fulfilled' && fund.status === 'fulfilled'
  return res.status(ok ? 200 : 500).json({ ok, ...out })
}
