// Shared shapes for the game engines. An engine is a pure function
// (state, secret, action, ctx) → Outcome; the API persists the outcome with
// casino_commit() in one transaction. `state` is public (every viewer of
// the table gets it); `secret` holds the shoe/deck and is never sent to a
// browser; `hands` are private hole cards, each readable only by its owner.

import type { Card, RandInt } from './cards'

export interface Ctx {
  user: string
  name: string
  now: number
  rand: RandInt
}

export interface ChipMove {
  user: string
  /** Negative = chips onto the table, positive = back to the wallet. */
  delta: number
  /** Wallet balance required before the move (the stake). */
  need: number
  reason: string
}

export interface Outcome<S, X> {
  state: S
  secret: X
  /** null = leave stored hole cards unchanged. */
  hands: Record<string, { hand_no: number; cards: Card[] }> | null
  chips: ChipMove[]
}

export const stake = (user: string, amount: number, reason: string): ChipMove =>
  ({ user, delta: -amount, need: amount, reason })
export const credit = (user: string, amount: number, reason: string): ChipMove =>
  ({ user, delta: amount, need: 0, reason })

/** Positive whole chips within [min, max]. */
export function isChipAmount(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max
}

/** Keeps the last few table events for the feed. */
export function pushLog(log: string[], line: string, keep = 8): string[] {
  return [...log, line].slice(-keep)
}
