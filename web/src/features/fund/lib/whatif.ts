// What-if engine: scenarios made of one-time or recurring deposits and
// withdrawals, run through the same market model and random draws as the
// forecast (projection.ts), so scenarios differ only by their cash flows.
//
// Each month, per simulated future: every member's capital account grows by
// the same factor, then that month's flows are applied by their split. A
// withdrawal larger than a member's balance pays out only what is there;
// the rest is a shortfall and the account sits at zero.

import { logParams, meanAt, normals, PATHS, quantile, type ProjectionInput } from './projection'

export type Repeat = 'once' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'custom'

export interface Flow {
  id: string
  kind: 'deposit' | 'withdrawal'
  amount: number
  /** First month it happens, 1 = the month after the last ledger month. */
  start: number
  repeat: Repeat
  /** For 'custom': every N months. */
  every: number
  /** How many times; null = until the horizon. */
  times: number | null
  /** Amount grows by this much a year (0.03 = 3%, e.g. inflation). */
  raise: number
  /** null = equal split. */
  split: Record<string, number> | null
}

export interface Scenario { id: string; name: string; flows: Flow[] }

export const INTERVAL: Record<Exclude<Repeat, 'custom'>, number> = { once: 0, monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }

export function flowInterval(f: Flow): number {
  return f.repeat === 'custom' ? Math.max(1, Math.round(f.every)) : INTERVAL[f.repeat]
}

/** Signed amount (deposit +, withdrawal −) of `f` at month k, or 0. */
export function flowAt(f: Flow, k: number): number {
  if (k < f.start || f.amount <= 0) return 0
  const step = flowInterval(f)
  const n = step === 0 ? (k === f.start ? 0 : -1) : (k - f.start) % step === 0 ? (k - f.start) / step : -1
  if (n < 0 || (f.times !== null && n >= f.times)) return 0
  const amt = f.amount * Math.pow(1 + f.raise, (k - f.start) / 12)
  return f.kind === 'deposit' ? amt : -amt
}

export interface MemberStart { user_id: string; label: string; balance: number }

export interface ScenarioResult {
  bands: { p5: number[]; p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[]; p95: number[] }
  mean: number[]
  /** Planned cash in/out over the horizon (before shortfalls). */
  planned: { deposits: number; withdrawals: number }
  /** Median cash actually paid out to members (withdrawals that were funded). */
  paidOut: number
  /** Chance a withdrawal can't be fully paid at some point. */
  probShortfall: number
  /** Chance the fund is at $0 at the horizon. */
  probEmpty: number
  /** Median of (end balance + cash paid out − deposits): what you are ahead by. */
  netWorth: number
  members: { user_id: string; label: string; p50: number; p5: number; p95: number; paidOut: number; share: number }[]
}

function weights(split: Record<string, number> | null, members: readonly MemberStart[]): number[] {
  if (!split) return members.map(() => 1 / members.length)
  const total = members.reduce((s, m) => s + (split[m.user_id] ?? 0), 0)
  return members.map(m => total > 0 ? (split[m.user_id] ?? 0) / total : 1 / members.length)
}

export function runScenario(s: Scenario, p: ProjectionInput, members: readonly MemberStart[]): ScenarioResult {
  const H = Math.max(1, Math.round(p.months))
  const M = members.length
  const z = normals(H)
  const params = Array.from({ length: H }, (_, k) => logParams(meanAt(p, k), p.sd))
  // Per month: net flow per member (already split).
  const sched = Array.from({ length: H + 1 }, (_, k) => {
    const per = new Float64Array(M)
    for (const f of s.flows) {
      const a = flowAt(f, k)
      if (a === 0) continue
      const w = weights(f.split, members)
      for (let j = 0; j < M; j++) per[j] += a * w[j]
    }
    return per
  })
  let deposits = 0, withdrawals = 0
  for (const per of sched) for (const a of per) { if (a > 0) deposits += a; else withdrawals -= a }

  const byMonth = Array.from({ length: H }, () => new Float64Array(PATHS))
  const memberEnd = members.map(() => new Float64Array(PATHS))
  const memberPaid = members.map(() => new Float64Array(PATHS))
  const net = new Float64Array(PATHS)
  const paid = new Float64Array(PATHS)
  let shortfall = 0, empty = 0
  const bal = new Float64Array(M)

  for (let i = 0; i < PATHS; i++) {
    for (let j = 0; j < M; j++) bal[j] = members[j].balance
    let short = false, cashOut = 0, cashIn = 0
    for (let k = 1; k <= H; k++) {
      const { m, s: sig } = params[k - 1]
      const g = Math.exp(m + sig * z[i * H + (k - 1)])
      let total = 0
      for (let j = 0; j < M; j++) {
        let b = bal[j] * g
        const a = sched[k][j]
        if (a > 0) { b += a; cashIn += a }
        else if (a < 0) {
          const want = -a, got = Math.min(want, Math.max(0, b))
          if (got < want - 0.005) short = true
          b -= got; cashOut += got; memberPaid[j][i] += got
        }
        bal[j] = b
        total += b
      }
      byMonth[k - 1][i] = total
    }
    for (let j = 0; j < M; j++) memberEnd[j][i] = bal[j]
    const end = byMonth[H - 1][i]
    if (short) shortfall++
    if (end <= 0.005) empty++
    paid[i] = cashOut
    net[i] = end + cashOut - cashIn
  }

  const start = members.reduce((s, m) => s + m.balance, 0)
  const bands = { p5: [start], p10: [start], p25: [start], p50: [start], p75: [start], p90: [start], p95: [start] }
  const mean = [start]
  for (const col of byMonth) {
    mean.push(col.reduce((s, x) => s + x, 0) / PATHS)
    col.sort()
    bands.p5.push(quantile(col, 0.05)); bands.p10.push(quantile(col, 0.1)); bands.p25.push(quantile(col, 0.25))
    bands.p50.push(quantile(col, 0.5)); bands.p75.push(quantile(col, 0.75)); bands.p90.push(quantile(col, 0.9))
    bands.p95.push(quantile(col, 0.95))
  }
  const endMedian = bands.p50[H]
  const med = (a: Float64Array) => { a.sort(); return quantile(a, 0.5) }
  return {
    bands, mean,
    planned: { deposits, withdrawals },
    paidOut: med(paid),
    probShortfall: shortfall / PATHS,
    probEmpty: empty / PATHS,
    netWorth: med(net),
    members: members.map((mb, j) => {
      const e = memberEnd[j].sort()
      const p50 = quantile(e, 0.5)
      return {
        user_id: mb.user_id, label: mb.label, p50, p5: quantile(e, 0.05), p95: quantile(e, 0.95),
        paidOut: med(memberPaid[j]), share: endMedian > 0 ? p50 / endMedian : 0,
      }
    }),
  }
}

/**
 * Largest steady monthly withdrawal (split equally, starting next month)
 * that leaves money in the fund in at least `confidence` of futures through
 * the horizon. Bisection on the simulation.
 */
export function safeWithdrawal(p: ProjectionInput, members: readonly MemberStart[], confidence = 0.95): number {
  const start = members.reduce((s, m) => s + m.balance, 0)
  const test = (amt: number) => runScenario({
    id: 'safe', name: 'safe',
    flows: [{ id: 'w', kind: 'withdrawal', amount: amt, start: 1, repeat: 'monthly', every: 1, times: null, raise: 0, split: null }],
  }, p, members).probShortfall <= 1 - confidence
  let lo = 0, hi = Math.max(1000, start)
  if (test(hi)) return hi
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (test(mid)) lo = mid
    else hi = mid
  }
  return Math.floor(lo / 10) * 10
}

/** Steady monthly withdrawal that keeps the median balance at today's level. */
export function flatWithdrawal(p: ProjectionInput, members: readonly MemberStart[]): number {
  const start = members.reduce((s, m) => s + m.balance, 0)
  const end = (amt: number) => runScenario({
    id: 'flat', name: 'flat',
    flows: [{ id: 'w', kind: 'withdrawal', amount: amt, start: 1, repeat: 'monthly', every: 1, times: null, raise: 0, split: null }],
  }, p, members).bands.p50.at(-1)!
  let lo = 0, hi = Math.max(1000, start)
  if (end(0) < start) return 0
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (end(mid) >= start) lo = mid
    else hi = mid
  }
  return Math.floor(lo / 10) * 10
}
