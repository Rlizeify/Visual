// Casino data access. Every move goes through POST /api/casino (the server
// deals); reads come straight from the tables, where RLS shows shared
// tables, your own solo game, your own hole cards and your own wallet.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { Card } from './cards'

export interface WalletInfo {
  chips: number
  name: string
  fund: { share: number; through: string | null; pulledThrough: string | null; canPull: boolean } | null
}

export interface ChipRequest {
  id: string
  amount: number
  note: string | null
  status: 'pending' | 'approved' | 'denied'
  granted: number | null
  created_at: string
}

export async function casino<T = unknown>(op: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in first')
  const res = await fetch('/api/casino', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op, ...body }),
    keepalive: op === 'table' && (body.action as { type?: string })?.type === 'leave',
  })
  const out = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(out.error ?? `The casino is unreachable (${res.status})`)
  return out
}

/** Wallet + fund-pull status; refreshes when the wallet row changes. */
export function useWallet() {
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(() => {
    casino<WalletInfo>('wallet').then(w => { setWallet(w); setError(null) }, e => setError((e as Error).message))
  }, [])
  useEffect(() => {
    refresh()
    const ch = supabase.channel('casino_wallet')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_wallets' }, payload => {
        const chips = (payload.new as { chips?: number })?.chips
        if (typeof chips === 'number') setWallet(w => (w ? { ...w, chips: Number(chips) } : w))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh])
  return { wallet, error, refresh, setWallet }
}

export async function loadRequests(): Promise<ChipRequest[]> {
  const { data, error } = await supabase.from('casino_chip_requests')
    .select('id, amount, note, status, granted, created_at').order('created_at', { ascending: false }).limit(5)
  if (error) throw new Error(error.message)
  return (data ?? []).map(r => ({ ...r, amount: Number(r.amount), granted: r.granted === null ? null : Number(r.granted) })) as ChipRequest[]
}

export async function requestChips(amount: number, note: string): Promise<void> {
  const { error } = await supabase.rpc('casino_request_chips', { p_amount: amount, p_note: note })
  if (error) throw new Error(error.message)
}

interface Deadlined { deadline: number | null }

/**
 * Live state of one shared table, your hole cards on it, and a `send` for
 * moves. When the table's deadline passes this client asks the server to
 * advance it (any seated client may; the server ignores early ticks).
 */
export function useTable<S extends Deadlined>(tableId: string, seated: (s: S) => boolean) {
  const [state, setState] = useState<S | null>(null)
  const [hole, setHole] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const version = useRef(-1)

  const load = useCallback(async () => {
    const [{ data: t }, { data: h }] = await Promise.all([
      supabase.from('casino_tables').select('state, version').eq('id', tableId).maybeSingle(),
      supabase.from('casino_hands').select('cards').eq('table_id', tableId).maybeSingle(),
    ])
    if (t && t.version >= version.current) {
      version.current = t.version
      setState(t.state as S)
    }
    setHole((h?.cards as Card[] | undefined) ?? null)
  }, [tableId])

  useEffect(() => {
    version.current = -1
    setState(null)
    load()
    const ch = supabase.channel(`casino_table_${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_tables', filter: `id=eq.${tableId}` }, () => { load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_hands', filter: `table_id=eq.${tableId}` }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tableId, load])

  const send = useCallback(async (action: Record<string, unknown>) => {
    setBusy(true)
    try {
      const out = await casino<{ state: S; version: number }>('table', { table: tableId, action })
      if (out.version >= version.current) { version.current = out.version; setState(out.state) }
      setError(null)
      if (action.type !== 'tick') load()
    } catch (e) {
      if (action.type !== 'tick') setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [tableId, load])

  // Advance the table when its timer runs out (clocks may disagree a little,
  // so keep nudging every few seconds while it's overdue).
  const deadline = state?.deadline ?? null
  const amSeated = state ? seated(state) : false
  useEffect(() => {
    if (deadline === null || !amSeated) return
    const wait = Math.max(0, deadline - Date.now() + 300)
    let iv: number | undefined
    const t = window.setTimeout(() => {
      send({ type: 'tick' })
      iv = window.setInterval(() => send({ type: 'tick' }), 4000)
    }, wait)
    return () => { window.clearTimeout(t); window.clearInterval(iv) }
  }, [deadline, amSeated, send])

  // Leaving the page or the table gives the seat up (Hold'em cashes out).
  const seatedRef = useRef(false)
  seatedRef.current = amSeated
  useEffect(() => {
    const bye = () => { if (seatedRef.current) casino('table', { table: tableId, action: { type: 'leave' } }).catch(() => {}) }
    window.addEventListener('pagehide', bye)
    return () => { window.removeEventListener('pagehide', bye); bye() }
  }, [tableId])

  return { state, hole, error, busy, send, setError }
}

/** Seconds left until `deadline`, ticking. */
export function useCountdown(deadline: number | null): number | null {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (deadline === null) return
    const iv = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(iv)
  }, [deadline])
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}

export const fmt = (n: number) => Math.round(n).toLocaleString()
