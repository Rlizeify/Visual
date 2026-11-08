// Fund ledger engine: replays fund_entries in date order into a running
// total and one capital account per member.
//
//   deposit / withdrawal  split by entry.split ({ user_id: percent }) or
//                         equally across members when split is null.
//   gain                  unrealized gain/loss for the period, shared in
//                         proportion to each member's balance just before
//                         it (equally if the balance is zero).
//
// Same-day order: deposits, then withdrawals, then gains — a month-end
// gain is earned on that month's money.

export type EntryKind = 'deposit' | 'withdrawal' | 'gain'

export interface FundEntry {
  id: string
  entry_date: string // YYYY-MM-DD
  kind: EntryKind
  amount: number // > 0 for deposit/withdrawal; signed for gain
  note: string | null
  split: Record<string, number> | null
  created_by: string | null
  created_at: string
  updated_by: string | null
  updated_at: string | null
}

export interface FundMember { user_id: string; label: string; position: number }

export interface LedgerRow {
  entry: FundEntry
  /** Total fund balance after this row. */
  balance: number
  /** Balance just before this row. */
  before: number
  /** Gain rows: gain ÷ balance before (null if that was 0). */
  pct: number | null
  /** Per-member change from this row and balance after it. */
  delta: Record<string, number>
  memberBalance: Record<string, number>
}

export interface MemberSummary {
  member: FundMember
  deposited: number
  withdrawn: number
  gains: number
  balance: number
  /** Share of the fund now, 0..1. */
  share: number
}

export interface Ledger {
  rows: LedgerRow[]
  members: MemberSummary[]
  balance: number
  deposited: number
  withdrawn: number
  gains: number
}

const ORDER: Record<EntryKind, number> = { deposit: 0, withdrawal: 1, gain: 2 }

export function sortEntries(entries: readonly FundEntry[]): FundEntry[] {
  return [...entries].sort((a, b) =>
    a.entry_date.localeCompare(b.entry_date) || ORDER[a.kind] - ORDER[b.kind] || a.created_at.localeCompare(b.created_at))
}

/** Split weights (sum 1) for a deposit/withdrawal. */
export function splitWeights(split: Record<string, number> | null, members: readonly FundMember[]): Record<string, number> {
  const w: Record<string, number> = {}
  if (!split) {
    for (const m of members) w[m.user_id] = 1 / members.length
    return w
  }
  const total = members.reduce((s, m) => s + (split[m.user_id] ?? 0), 0)
  for (const m of members) w[m.user_id] = total > 0 ? (split[m.user_id] ?? 0) / total : 1 / members.length
  return w
}

const cents = (x: number) => Math.round(x * 100) / 100

export function buildLedger(entries: readonly FundEntry[], members: readonly FundMember[]): Ledger {
  const ms = [...members].sort((a, b) => a.position - b.position)
  const bal: Record<string, number> = Object.fromEntries(ms.map(m => [m.user_id, 0]))
  const sums = Object.fromEntries(ms.map(m => [m.user_id, { deposited: 0, withdrawn: 0, gains: 0 }]))
  let total = 0
  const rows: LedgerRow[] = []

  for (const e of sortEntries(entries)) {
    const before = total
    const delta: Record<string, number> = {}
    if (e.kind === 'gain') {
      for (const m of ms) {
        const w = before > 0 ? bal[m.user_id] / before : 1 / ms.length
        delta[m.user_id] = e.amount * w
        sums[m.user_id].gains += delta[m.user_id]
      }
      total += e.amount
    } else {
      const w = splitWeights(e.split, ms)
      const sign = e.kind === 'deposit' ? 1 : -1
      for (const m of ms) {
        delta[m.user_id] = sign * e.amount * w[m.user_id]
        if (sign > 0) sums[m.user_id].deposited += e.amount * w[m.user_id]
        else sums[m.user_id].withdrawn += e.amount * w[m.user_id]
      }
      total += sign * e.amount
    }
    for (const m of ms) bal[m.user_id] += delta[m.user_id]
    total = cents(total)
    rows.push({
      entry: e, before, balance: total,
      pct: e.kind === 'gain' && before > 0 ? e.amount / before : null,
      delta, memberBalance: { ...bal },
    })
  }

  const summaries = ms.map(m => ({
    member: m,
    ...sums[m.user_id],
    balance: bal[m.user_id],
    share: total > 0 ? bal[m.user_id] / total : 1 / ms.length,
  }))
  return {
    rows, members: summaries, balance: total,
    deposited: summaries.reduce((s, m) => s + m.deposited, 0),
    withdrawn: summaries.reduce((s, m) => s + m.withdrawn, 0),
    gains: summaries.reduce((s, m) => s + m.gains, 0),
  }
}

/** Balance a gain dated `date` would be earned on (turns a typed % into $).
 *  Pass entries without the row being edited. */
export function balanceBefore(entries: readonly FundEntry[], date: string): number {
  let b = 0
  for (const e of sortEntries(entries)) {
    if (e.entry_date > date || (e.entry_date === date && e.kind === 'gain')) break
    b += e.kind === 'withdrawal' ? -e.amount : e.amount
  }
  return cents(b)
}
