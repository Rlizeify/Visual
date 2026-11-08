// Single-zero roulette. One spin settles every bet on the layout at once.
// Returns include the stake: a straight-up pays 35 to 1 (×36 back).

import { GameError, type RandInt } from './cards.js'
import { isChipAmount } from './engine.js'

export const ROULETTE = { minBet: 10, maxBet: 500_000, maxBets: 40 } as const

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

/** Where chips sit on the layout. */
export type RouletteSpot =
  | { kind: 'number'; n: number }
  | { kind: 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' }
  | { kind: 'dozen' | 'column'; n: 1 | 2 | 3 }

export type RouletteBet = RouletteSpot & { amount: number }

export function pocketColor(n: number): 'green' | 'red' | 'black' {
  return n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black'
}

/** Chips returned for `bet` when the ball lands on `n` (0 = lost). */
export function payout(bet: RouletteBet, n: number): number {
  const hit = (() => {
    switch (bet.kind) {
      case 'number': return bet.n === n
      case 'red': return pocketColor(n) === 'red'
      case 'black': return pocketColor(n) === 'black'
      case 'odd': return n > 0 && n % 2 === 1
      case 'even': return n > 0 && n % 2 === 0
      case 'low': return n >= 1 && n <= 18
      case 'high': return n >= 19
      case 'dozen': return n > 0 && Math.ceil(n / 12) === bet.n
      case 'column': return n > 0 && ((n - 1) % 3) + 1 === bet.n
    }
  })()
  if (!hit) return 0
  const mult = bet.kind === 'number' ? 36 : bet.kind === 'dozen' || bet.kind === 'column' ? 3 : 2
  return bet.amount * mult
}

export function validateBets(bets: unknown): RouletteBet[] {
  if (!Array.isArray(bets) || bets.length === 0 || bets.length > ROULETTE.maxBets) {
    throw new GameError(`Place 1–${ROULETTE.maxBets} bets`)
  }
  return bets.map(b => {
    const bet = b as RouletteBet
    if (!isChipAmount(bet?.amount, ROULETTE.minBet, ROULETTE.maxBet)) {
      throw new GameError(`Each bet is ${ROULETTE.minBet}–${ROULETTE.maxBet.toLocaleString()} chips`)
    }
    switch (bet.kind) {
      case 'number':
        if (!Number.isInteger(bet.n) || bet.n < 0 || bet.n > 36) throw new GameError('Pick a number 0–36')
        return { kind: 'number', n: bet.n, amount: bet.amount }
      case 'dozen': case 'column':
        if (![1, 2, 3].includes(bet.n)) throw new GameError('Pick 1, 2 or 3')
        return { kind: bet.kind, n: bet.n, amount: bet.amount }
      case 'red': case 'black': case 'odd': case 'even': case 'low': case 'high':
        return { kind: bet.kind, amount: bet.amount }
      default:
        throw new GameError('Unknown bet')
    }
  })
}

export function spin(bets: RouletteBet[], rand: RandInt): { n: number; staked: number; returned: number } {
  const n = rand(37)
  const staked = bets.reduce((s, b) => s + b.amount, 0)
  const returned = bets.reduce((s, b) => s + payout(b, n), 0)
  return { n, staked, returned }
}
