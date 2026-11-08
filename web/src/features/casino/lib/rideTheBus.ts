// Ride the Bus (solo). Four calls on a freshly shuffled deck:
//   1. red or black            → ×2
//   2. higher or lower than #1 → ×3   (equal loses)
//   3. inside or outside #1–#2 → ×4   (matching either end loses)
//   4. the suit                → ×20
// Cash out after any correct call; a wrong call loses the stake.

import { type Card, GameError, isRed, must, rankValue, shuffledShoe, suitOf } from './cards.js'
import { type Ctx, type Outcome, credit, isChipAmount, stake } from './engine.js'

export const RTB = { minBet: 10, maxBet: 250_000, multipliers: [1, 2, 3, 4, 20] } as const

export type RtbGuess =
  | 'red' | 'black' | 'higher' | 'lower' | 'inside' | 'outside'
  | 's' | 'h' | 'd' | 'c'

export interface RtbState {
  phase: 'idle' | 'playing' | 'won' | 'lost' | 'cashed'
  bet: number
  /** Cards turned so far (also how many calls were right). */
  cards: Card[]
  payout: number
  games: number
}

export interface RtbSecret { deck: Card[] }

export type RtbAction =
  | { type: 'start'; bet: number }
  | { type: 'guess'; guess: RtbGuess }
  | { type: 'cashout' }

export const initialRtb = (): RtbState => ({ phase: 'idle', bet: 0, cards: [], payout: 0, games: 0 })

const STEP_GUESSES: RtbGuess[][] = [
  ['red', 'black'], ['higher', 'lower'], ['inside', 'outside'], ['s', 'h', 'd', 'c'],
]

export function guessRight(cards: readonly Card[], next: Card, g: RtbGuess): boolean {
  switch (cards.length) {
    case 0: return (g === 'red') === isRed(next)
    case 1: {
      const a = rankValue(cards[0]), b = rankValue(next)
      return g === 'higher' ? b > a : b < a
    }
    case 2: {
      const lo = Math.min(rankValue(cards[0]), rankValue(cards[1]))
      const hi = Math.max(rankValue(cards[0]), rankValue(cards[1]))
      const v = rankValue(next)
      return g === 'inside' ? v > lo && v < hi : v < lo || v > hi
    }
    default: return suitOf(next) === g
  }
}

export function applyRtb(state: RtbState, secret: RtbSecret, action: RtbAction, ctx: Ctx): Outcome<RtbState, RtbSecret> {
  const s: RtbState = { ...state, cards: [...state.cards] }
  let x: RtbSecret = { deck: [...(secret.deck ?? [])] }
  const chips = []

  if (action.type === 'start') {
    must(s.phase !== 'playing', 'Finish this ride first')
    must(isChipAmount(action.bet, RTB.minBet, RTB.maxBet), `Bet ${RTB.minBet}–${RTB.maxBet.toLocaleString()} chips`)
    chips.push(stake(ctx.user, action.bet, 'ride the bus bet'))
    x = { deck: shuffledShoe(1, ctx.rand) }
    Object.assign(s, { phase: 'playing', bet: action.bet, cards: [], payout: 0, games: s.games + 1 })
  } else if (action.type === 'guess') {
    must(s.phase === 'playing', 'Start a ride first')
    must(STEP_GUESSES[s.cards.length].includes(action.guess), 'That call isn’t on this card')
    const next = x.deck.pop()!
    const right = guessRight(s.cards, next, action.guess)
    s.cards.push(next)
    if (!right) {
      s.phase = 'lost'
    } else if (s.cards.length === 4) {
      s.phase = 'won'
      s.payout = s.bet * RTB.multipliers[4]
      chips.push(credit(ctx.user, s.payout, 'ride the bus win'))
    }
  } else if (action.type === 'cashout') {
    must(s.phase === 'playing' && s.cards.length > 0, 'Nothing to cash out yet')
    s.phase = 'cashed'
    s.payout = s.bet * RTB.multipliers[s.cards.length]
    chips.push(credit(ctx.user, s.payout, 'ride the bus cash-out'))
  } else {
    throw new GameError('Unknown move')
  }
  if (s.phase !== 'playing') x = { deck: [] }
  return { state: s, secret: x, hands: null, chips }
}
