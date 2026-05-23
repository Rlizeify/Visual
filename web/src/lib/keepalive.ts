// Supabase keepalive — fires once per session.
// Prevents the free-tier project from auto-pausing after 7 days of inactivity.
// Failures are swallowed: keepalive must never break the app.

import { supabase } from './supabase'

let pingedThisSession = false

export async function pingKeepalive(): Promise<void> {
  if (pingedThisSession) return
  pingedThisSession = true

  try {
    const { data, error: readErr } = await supabase
      .from('keepalive')
      .select('ping_count')
      .eq('id', 1)
      .maybeSingle()

    if (readErr) {
      console.warn('[keepalive] read failed:', readErr.message)
      return
    }

    const nextCount = (data?.ping_count ?? 0) + 1
    const { error: writeErr } = await supabase
      .from('keepalive')
      .update({ last_pinged_at: new Date().toISOString(), ping_count: nextCount })
      .eq('id', 1)

    if (writeErr) console.warn('[keepalive] update failed:', writeErr.message)
  } catch (err) {
    console.warn('[keepalive] unexpected error:', err)
  }
}
