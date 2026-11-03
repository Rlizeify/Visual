/**
 * Cron job: daily Supabase keepalive.
 *
 * Schedule: `0 0 * * *` (vercel.json). Supabase free tier pauses a
 * project after 7 days without activity; this guarantees one read and
 * one write per day regardless of user traffic.
 *
 * - Read: a head-only count on `profiles` (KEEP table, no rows returned).
 * - Write: bump the singleton `keepalive` heartbeat row.
 *
 * Standalone since 2026-11-03 — it used to ride inside the Life Scores
 * recompute job, which was cut. Returns 500 on failure so a broken
 * keepalive shows up in Vercel cron logs instead of failing silently.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = getServiceSupabase()

    const { count: profileCount, error: readErr } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
    if (readErr) throw new Error(`profiles read failed: ${readErr.message}`)

    const { data: row, error: selErr } = await supabase
      .from('keepalive')
      .select('ping_count')
      .eq('id', 1)
      .maybeSingle()
    if (selErr) throw new Error(`keepalive read failed: ${selErr.message}`)

    const pingCount = (row?.ping_count ?? 0) + 1
    const lastPingedAt = new Date().toISOString()
    const { error: writeErr } = await supabase
      .from('keepalive')
      .upsert({ id: 1, last_pinged_at: lastPingedAt, ping_count: pingCount }, { onConflict: 'id' })
    if (writeErr) throw new Error(`keepalive write failed: ${writeErr.message}`)

    console.log('[cron] keepalive', { pingCount, profileCount })
    return res.status(200).json({ ok: true, last_pinged_at: lastPingedAt, ping_count: pingCount })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron] keepalive failed:', msg)
    return res.status(500).json({ ok: false, error: msg })
  }
}
