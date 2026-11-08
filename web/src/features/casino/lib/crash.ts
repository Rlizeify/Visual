// Liftoff (solo crash game). The bust point is drawn when the round starts
// and kept server-side; the multiplier climbs with server time as
// e^(GROWTH·ms), so 2× takes ~11.5 s and 10× ~38 s. Cash out before the
// bust to win stake × multiplier; set an auto cash-out to bank it hands-off.
//
// Bust point: 1 / (1 − u) with a 3% edge, floored to cents, so about 3% of
// rounds bust at 1.00× and half bust before ~1.94×. Capped at MAX_MULT.

import { GameError, must, type RandInt } from './cards.js'
import { type ChipMove, type Ctx, type Outcome, credit, isChipAmount, stake } from './engine.js'

export const CRASH = {
  minBet: 10,
  maxBet: 250_000,
  growth: 0.00006,
  edge: 0.03,
  maxMult: 10_000,
  history: 12,
  /** Countdown on the pad before the climb (a cash-out then returns the stake). */
  launchMs: 2_000,
} as const

export interface CrashState {
  phase: 'idle' | 'flying' | 'busted' | 'cashed'
  bet: number
  /** Server time the climb starts (ms), after the launch countdown. */
  startedAt: number
  auto: number | null
  /** Revealed when the round ends. */
  bustAt: number | null
  cashedAt: number | null
  payout: number
  history: number[]
}

export interface CrashSecret { bust?: number }

export type CrashAction =
  | { type: 'start'; bet: number; auto?: number | null }
  | { type: 'cashout' }
  | { type: 'tick' }

export const initialCrash = (): CrashState => ({
  phase: 'idle', bet: 0, startedAt: 0, auto: null, bustAt: null, cashedAt: null, payout: 0, history: [],
})

/** Multiplier `ms` after liftoff, floored to cents. */
export function multAt(ms: number): number {
  return Math.floor(100 * Math.exp(CRASH.growth * Math.max(0, ms))) / 100
}

/** Milliseconds after liftoff when the multiplier reaches `m`. */
export const msFor = (m: number) => Math.log(m) / CRASH.growth

export function drawBust(rand: RandInt): number {
  const u = rand(1_000_000) / 1_000_000
  const m = Math.floor((100 * (1 - CRASH.edge)) / (1 - u)) / 100
  return Math.min(CRASH.maxMult, Math.max(1, m))
}

export function applyCrash(state: CrashState, secret: CrashSecret, action: CrashAction, ctx: Ctx): Outcome<CrashState, CrashSecret> {
  const s: CrashState = { ...state, history: [...state.history] }
  let x: CrashSecret = { ...secret }
  const chips: ChipMove[] = []

  const end = (phase: 'busted' | 'cashed', at: number | null) => {
    s.phase = phase
    s.bustAt = x.bust ?? null
    s.cashedAt = at
    s.history = [s.bustAt ?? 1, ...s.history].slice(0, CRASH.history)
    x = {}
  }
  const cashAt = (m: number) => {
    s.payout = Math.floor(s.bet * m)
    chips.push(credit(ctx.user, s.payout, `liftoff ${m.toFixed(2)}x`))
    end('cashed', m)
  }

  if (action.type === 'start') {
    must(s.phase !== 'flying', 'This round is still flying')
    must(isChipAmount(action.bet, CRASH.minBet, CRASH.maxBet), `Bet ${CRASH.minBet}–${CRASH.maxBet.toLocaleString()} chips`)
    const auto = action.auto ?? null
    must(auto === null || (typeof auto === 'number' && auto >= 1.01 && auto <= CRASH.maxMult), 'Auto cash-out is 1.01× or more')
    chips.push(stake(ctx.user, action.bet, 'liftoff bet'))
    x = { bust: drawBust(ctx.rand) }
    Object.assign(s, {
      phase: 'flying', bet: action.bet, startedAt: ctx.now + CRASH.launchMs, auto: auto === null ? null : Math.floor(auto * 100) / 100,
      bustAt: null, cashedAt: null, payout: 0,
    })
    return { state: s, secret: x, hands: null, chips }
  }

  if (s.phase !== 'flying') {
    if (action.type === 'tick') return { state: s, secret: x, hands: null, chips }
    throw new GameError('No round in the air')
  }
  const bust = x.bust ?? 1
  const now = multAt(ctx.now - s.startedAt)
  const lifted = ctx.now >= s.startedAt
  // Auto cash-out wins if it was reached before the bust. A 1.00× bust
  // goes at the moment of liftoff.
  if (s.auto !== null && s.auto < bust && now >= s.auto) cashAt(s.auto)
  else if (lifted && now >= bust) end('busted', null)
  else if (action.type === 'cashout') cashAt(now)
  return { state: s, secret: x, hands: null, chips }
}
