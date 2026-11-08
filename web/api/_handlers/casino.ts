// Casino: the only place cards are shuffled or dealt.
//
// POST /api/casino  { op, ... }  — any signed-in account.
//   wallet                      chips + fund-pull status (creates the wallet)
//   fund-pull                   fund members: chips := own capital share,
//                               once per newer ledger row
//   table   { table, action }   shared Blackjack / Hold'em tables
//   rtb     { action }          the caller's Ride the Bus game
//   roulette { bets }           one spin
//
// Identity comes from casino_wallet() run as the caller's JWT (the same
// signature + expiry check RLS uses). Moves load the table with the service
// role, run the engine in src/features/casino/lib, and write state, secret
// deck, hole cards and chip moves in one casino_commit() transaction that
// fails on a version mismatch; on a clash we reload and retry.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomInt } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { service } from '../_admin.js'
import { GameError } from '../../src/features/casino/lib/cards.js'
import type { Ctx, Outcome } from '../../src/features/casino/lib/engine.js'
import { applyBj, initialBj, type BjAction, type BjSecret, type BjState } from '../../src/features/casino/lib/blackjack.js'
import { applyHoldem, initialHoldem, type HeAction, type HeSecret, type HeState } from '../../src/features/casino/lib/holdem.js'
import { applyRtb, initialRtb, type RtbAction, type RtbSecret, type RtbState } from '../../src/features/casino/lib/rideTheBus.js'
import { spin, validateBets } from '../../src/features/casino/lib/roulette.js'
import { buildLedger, type FundEntry, type FundMember } from '../../src/features/fund/lib/ledger.js'

const HOLDEM_BLINDS: Record<string, [number, number]> = { 'holdem-1': [50, 100], 'holdem-2': [250, 500] }
const MAX_TRIES = 4

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err))

interface Player { id: string; name: string; chips: number }
interface TableRow { id: string; game: string; owner: string | null; version: number; state: Record<string, unknown> }

type AnyOutcome = Outcome<unknown, unknown>

/** Runs one move on a table with optimistic retries. */
async function move(
  sb: SupabaseClient, tableId: string, apply: (row: TableRow, secret: Record<string, unknown>) => AnyOutcome,
): Promise<{ state: unknown; version: number }> {
  for (let attempt = 0; ; attempt++) {
    const [{ data: row, error: e1 }, { data: sec, error: e2 }] = await Promise.all([
      sb.from('casino_tables').select('id, game, owner, version, state').eq('id', tableId).maybeSingle(),
      sb.from('casino_secrets').select('secret').eq('table_id', tableId).maybeSingle(),
    ])
    if (e1 || e2) throw new Error((e1 ?? e2)!.message)
    if (!row) throw new GameError('No such table')
    const t = row as TableRow
    const secret = (sec?.secret ?? {}) as Record<string, unknown>
    const out = apply(t, secret)
    // Nothing changed (e.g. an early tick): don't wake every client.
    if (out.chips.length === 0 && out.hands === null
      && JSON.stringify(out.state) === JSON.stringify(t.state)
      && JSON.stringify(out.secret) === JSON.stringify(secret)) {
      return { state: t.state, version: t.version }
    }
    const { data: version, error } = await sb.rpc('casino_commit', {
      p_table: tableId, p_version: t.version, p_state: out.state, p_secret: out.secret,
      p_hands: out.hands, p_chips: out.chips,
    })
    if (!error) return { state: out.state, version: version as number }
    if (error.code === '40001' && attempt < MAX_TRIES) continue
    if (error.hint === 'casino_chips' || error.message.includes('Not enough chips')) throw new GameError('Not enough chips')
    throw new Error(error.message)
  }
}

const isEmpty = (o: Record<string, unknown>) => Object.keys(o).length === 0

async function tableMove(sb: SupabaseClient, me: Player, tableId: unknown, action: unknown) {
  if (typeof tableId !== 'string' || !action || typeof action !== 'object') throw new GameError('Missing table or action')
  return move(sb, tableId, (t, secret) => {
    if (t.owner !== null) throw new GameError('No such table')
    const ctx: Ctx = { user: me.id, name: me.name, now: Date.now(), rand: randomInt }
    if (t.game === 'blackjack') {
      const s = isEmpty(t.state) ? initialBj() : (t.state as unknown as BjState)
      return applyBj(s, secret as unknown as BjSecret, action as BjAction, ctx) as AnyOutcome
    }
    if (t.game === 'holdem') {
      const [sbl, bbl] = HOLDEM_BLINDS[t.id] ?? [50, 100]
      const s = isEmpty(t.state) ? initialHoldem(sbl, bbl) : (t.state as unknown as HeState)
      return applyHoldem(s, secret as unknown as HeSecret, action as HeAction, ctx) as AnyOutcome
    }
    throw new GameError('No such table')
  })
}

async function rtbMove(sb: SupabaseClient, me: Player, action: unknown) {
  if (!action || typeof action !== 'object') throw new GameError('Missing action')
  const { data, error } = await sb.rpc('casino_solo_table', { p_user: me.id, p_game: 'ridethebus' })
  if (error) throw new Error(error.message)
  const tableId = (data as TableRow).id
  return move(sb, tableId, (t, secret) => {
    const s = isEmpty(t.state) ? initialRtb() : (t.state as unknown as RtbState)
    const ctx: Ctx = { user: me.id, name: me.name, now: Date.now(), rand: randomInt }
    return applyRtb(s, secret as unknown as RtbSecret, action as RtbAction, ctx) as AnyOutcome
  })
}

async function roulette(sb: SupabaseClient, me: Player, bets: unknown) {
  const valid = validateBets(bets)
  const r = spin(valid, randomInt)
  const { error } = await sb.rpc('casino_commit', {
    p_table: null, p_version: 0, p_state: {}, p_secret: {}, p_hands: null,
    p_chips: [{ user: me.id, delta: r.returned - r.staked, need: r.staked, reason: `roulette (${r.n})` }],
  })
  if (error) {
    if (error.hint === 'casino_chips' || error.message.includes('Not enough chips')) throw new GameError('Not enough chips')
    throw new Error(error.message)
  }
  return r
}

/** Fund members: their own capital account, as whole chips. */
async function fundShare(sb: SupabaseClient, asCaller: SupabaseClient, userId: string) {
  const { data: allowed } = await asCaller.rpc('has_feature', { f: 'fund' })
  if (allowed !== true) return null
  const [m, e] = await Promise.all([
    sb.from('fund_members').select('user_id, label, position'),
    sb.from('fund_entries').select('id, entry_date, kind, amount, note, split, created_by, created_at, updated_by, updated_at'),
  ])
  if (m.error || e.error) throw new Error((m.error ?? e.error)!.message)
  const members = (m.data ?? []) as FundMember[]
  if (!members.some(x => x.user_id === userId)) return null
  const entries = (e.data ?? []).map(r => ({ ...r, amount: Number(r.amount) })) as FundEntry[]
  if (!entries.length) return { share: 0, through: null as string | null }
  const ledger = buildLedger(entries, members)
  const mine = ledger.members.find(x => x.member.user_id === userId)
  const through = entries.reduce((d, x) => (x.entry_date > d ? x.entry_date : d), entries[0].entry_date)
  return { share: Math.max(0, Math.floor(mine?.balance ?? 0)), through }
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
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

  const { data: wallet, error: wErr } = await asCaller.rpc('casino_wallet')
  if (wErr || !wallet) return res.status(401).json({ error: 'invalid token' })
  const w = wallet as { user_id: string; chips: number; fund_pulled_through: string | null }
  const { data: prof } = await sb.from('profiles').select('username').eq('id', w.user_id).maybeSingle()
  const me: Player = { id: w.user_id, name: (prof?.username as string | undefined) ?? 'Player', chips: Number(w.chips) }

  const body = (req.body ?? {}) as Record<string, unknown>
  try {
    switch (body.op) {
      case 'wallet': {
        const fund = await fundShare(sb, asCaller, me.id)
        return res.status(200).json({
          chips: me.chips,
          name: me.name,
          fund: fund && {
            share: fund.share,
            through: fund.through,
            pulledThrough: w.fund_pulled_through,
            canPull: !!fund.through && (!w.fund_pulled_through || w.fund_pulled_through < fund.through),
          },
        })
      }
      case 'fund-pull': {
        const fund = await fundShare(sb, asCaller, me.id)
        if (!fund) return res.status(403).json({ error: 'Only fund members can do that' })
        if (!fund.through) return res.status(400).json({ error: 'The fund has no rows yet' })
        const { data, error } = await sb.rpc('casino_fund_pull', { p_user: me.id, p_chips: fund.share, p_through: fund.through })
        if (error) {
          if (error.hint === 'casino_pulled') return res.status(409).json({ error: 'Already pulled — wait for the next fund row' })
          throw new Error(error.message)
        }
        return res.status(200).json({ chips: Number((data as { chips: number }).chips) })
      }
      case 'table':
        return res.status(200).json(await tableMove(sb, me, body.table, body.action))
      case 'rtb':
        return res.status(200).json(await rtbMove(sb, me, body.action))
      case 'roulette':
        return res.status(200).json(await roulette(sb, me, body.bets))
      default:
        return res.status(400).json({ error: 'Unknown op' })
    }
  } catch (err) {
    if (err instanceof GameError) return res.status(400).json({ error: err.message })
    console.error('[casino]', msg(err))
    return res.status(500).json({ error: msg(err) })
  }
}
