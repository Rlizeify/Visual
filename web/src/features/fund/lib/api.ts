// Fund data access. RLS (has_feature('fund')) decides who can read and
// write; triggers stamp the author and write fund_entry_history.

import { supabase } from '../../../lib/supabase'
import type { EntryKind, FundEntry, FundMember } from './ledger'
import type { FundMarket } from './macro'

const ENTRY_COLS = 'id, entry_date, kind, amount, note, split, created_by, created_at, updated_by, updated_at'

export interface EntryDraft {
  entry_date: string
  kind: EntryKind
  amount: number
  note: string | null
  split: Record<string, number> | null
}

export interface HistoryRow {
  id: number
  entry_id: string
  action: 'insert' | 'update' | 'delete'
  before: Partial<FundEntry> | null
  after: Partial<FundEntry> | null
  actor: string | null
  at: string
}

function toEntry(r: Record<string, unknown>): FundEntry {
  return { ...(r as unknown as FundEntry), amount: Number(r.amount) }
}

function fail(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`)
}

export async function loadFund(): Promise<{ members: FundMember[]; entries: FundEntry[] }> {
  const [m, e] = await Promise.all([
    supabase.from('fund_members').select('user_id, label, position').order('position'),
    supabase.from('fund_entries').select(ENTRY_COLS).order('entry_date'),
  ])
  fail(m.error, 'Loading members')
  fail(e.error, 'Loading entries')
  return { members: (m.data ?? []) as FundMember[], entries: (e.data ?? []).map(toEntry) }
}

export async function loadHistory(limit = 100): Promise<HistoryRow[]> {
  const { data, error } = await supabase.from('fund_entry_history')
    .select('id, entry_id, action, before, after, actor, at').order('at', { ascending: false }).limit(limit)
  fail(error, 'Loading history')
  return (data ?? []) as HistoryRow[]
}

export async function addEntry(d: EntryDraft): Promise<FundEntry> {
  const { data, error } = await supabase.from('fund_entries').insert(d).select(ENTRY_COLS).single()
  fail(error, 'Saving row')
  return toEntry(data as Record<string, unknown>)
}

export async function updateEntry(id: string, d: EntryDraft): Promise<FundEntry> {
  const { data, error } = await supabase.from('fund_entries').update(d).eq('id', id).select(ENTRY_COLS).single()
  fail(error, 'Saving row')
  return toEntry(data as Record<string, unknown>)
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('fund_entries').delete().eq('id', id)
  fail(error, 'Deleting row')
}

/** Live changes from the other member. Returns an unsubscribe. */
export function subscribeEntries(onChange: () => void): () => void {
  const ch = supabase.channel('fund_entries')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_entries' }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}

/**
 * Benchmark, rates and CPI. The server refreshes the cached row when stale;
 * if the API is unreachable (e.g. `vite` dev without functions) the cached
 * row is read straight from the table (same has_feature('fund') gate).
 */
export async function loadMarket(): Promise<FundMarket | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    try {
      const res = await fetch('/api/fund-market', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
      if (res.ok) {
        const body = (await res.json()) as { market: FundMarket | null }
        if (body.market) return body.market
      }
    } catch { /* fall through to the table */ }
  }
  const { data } = await supabase.from('fund_market').select('*').eq('id', 1).maybeSingle()
  return (data as FundMarket | null) ?? null
}
