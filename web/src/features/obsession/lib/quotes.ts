// Daily quote rotation for the Obsession landing watermark.
//
// Quote selection is deterministic per (user_id, ISO date) so:
//   - The same user sees the same quote all day.
//   - Different users may see different quotes the same day.
//   - The quote rotates every day.
//
// Index = hash(userId + date) modulo pool length.

import { supabase } from '../../../lib/supabase'
import type { ObsessionQuotePoolRow } from './types'
import { todayLocalISODate } from './localDate'

// FNV-1a 32-bit, stable hashing for ASCII inputs.
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export async function fetchQuotePool(): Promise<ObsessionQuotePoolRow[]> {
  const { data, error } = await supabase
    .from('obsession_quote_pool')
    .select('id, quote_text, created_at')
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[obsession] quote pool fetch failed:', error.message)
    return []
  }
  return (data ?? []) as ObsessionQuotePoolRow[]
}

export function pickQuoteFor(userId: string, pool: ObsessionQuotePoolRow[], date: string = todayLocalISODate()): ObsessionQuotePoolRow | null {
  if (pool.length === 0) return null
  const idx = fnv1a(`${userId}|${date}`) % pool.length
  return pool[idx]
}
