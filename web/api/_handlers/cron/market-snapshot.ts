/**
 * Cron job: daily market snapshot for /investing.
 *
 * Schedule: `30 21 * * 1-5` (vercel.json) — weekdays after the US close
 * (16:00 ET = 20:00/21:00 UTC). Hobby-tier crons fire once a day within
 * the scheduled hour, which is all this needs. The /api/market-snapshot
 * GET also refreshes on demand when the latest row is >6h old.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { refreshMarketSnapshot } from '../market-snapshot.js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const { snapshot, errors } = await refreshMarketSnapshot(getServiceSupabase())
    console.log('[cron] market snapshot', { as_of: snapshot.as_of, spx: snapshot.spx_close, source: snapshot.source })
    return res.status(200).json({ ok: true, snapshot, sourceErrors: errors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron] market snapshot failed:', msg)
    return res.status(500).json({ ok: false, error: msg })
  }
}
