// Blackjack engine: up to 5 seats, one shared 6-deck shoe, synchronized
// rounds. Dealer stands on all 17s, blackjack pays 3:2, double on any first
// two cards, re-split pairs up to BJ.maxHands hands (split aces get one card
// each), dealer peeks on an ace or ten.
//
// Round: betting (closes BET_MS after the first bet, or as soon as every
// seated player has bet) → playing (seat order; each decision has TURN_MS,
// then the hand stands) → settled (SETTLE_MS, then a new betting round).
// Any client may send 'tick' once a deadline passes; the server applies it.

import { type Card, type RandInt, GameError, must, rankOf, shuffledShoe } from './cards.js'
import { type ChipMove, type Ctx, type Outcome, credit, isChipAmount, pushLog, stake } from './engine.js'

export const BJ = {
  seats: 5,
  decks: 6,
  minBet: 10,
  maxBet: 1_000_000,
  betMs: 12_000,
  turnMs: 30_000,
  settleMs: 7_000,
  /** Missed betting rounds before a seat is cleared. */
  maxIdle: 3,
  /** Re-splitting stops at this many hands per seat. */
  maxHands: 8,
} as const

export type BjResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust'

export interface BjHand {
  cards: Card[]
  bet: number
  doubled: boolean
  split: boolean
  done: boolean
  result: BjResult | null
  payout: number
}

export interface BjSeat {
  user: string
  name: string
  seat: number
  hands: BjHand[]
  /** Index of the hand being played. */
  active: number
  idle: number
  leaving: boolean
}

export interface BjState {
  phase: 'betting' | 'playing' | 'settled'
  seats: BjSeat[]
  /** Face-up dealer cards; while `holeHidden` a face-down card is implied. */
  dealer: Card[]
  holeHidden: boolean
  /** Seat number whose turn it is. */
  turn: number | null
  deadline: number | null
  round: number
  shoeLeft: number
  shoeSize: number
  log: string[]
}

export interface BjSecret { shoe: Card[]; hole: Card | null }

export type BjAction =
  | { type: 'join' }
  | { type: 'leave' }
  | { type: 'bet'; amount: number }
  | { type: 'hit' }
  | { type: 'stand' }
  | { type: 'double' }
  | { type: 'split' }
  | { type: 'tick' }

export function initialBj(): BjState {
  return {
    phase: 'betting', seats: [], dealer: [], holeHidden: false, turn: null, deadline: null,
    round: 0, shoeLeft: 0, shoeSize: BJ.decks * 52, log: [],
  }
}

const TEN = new Set(['T', 'J', 'Q', 'K'])

/** Best total and whether an ace still counts 11. */
export function handValue(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0
  for (const c of cards) {
    const r = rankOf(c)
    if (r === 'A') { aces++; total += 11 } else if (TEN.has(r)) total += 10
    else total += Number(r)
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return { total, soft: aces > 0 }
}

export const isBlackjack = (h: { cards: readonly Card[]; split?: boolean }) =>
  h.cards.length === 2 && !h.split && handValue(h.cards).total === 21

export const cardValue = (c: Card) => (rankOf(c) === 'A' ? 11 : TEN.has(rankOf(c)) ? 10 : Number(rankOf(c)))

const newHand = (bet: number): BjHand =>
  ({ cards: [], bet, doubled: false, split: false, done: false, result: null, payout: 0 })

interface Work { s: BjState; x: BjSecret; chips: ChipMove[]; rand: RandInt; now: number }

function draw(w: Work): Card {
  if (w.x.shoe.length === 0) w.x.shoe = shuffledShoe(BJ.decks, w.rand)
  const c = w.x.shoe.pop()!
  w.s.shoeLeft = w.x.shoe.length
  return c
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function applyBj(state: BjState, secret: BjSecret, action: BjAction, ctx: Ctx): Outcome<BjState, BjSecret> {
  const w: Work = { s: clone(state), x: clone(secret), chips: [], rand: ctx.rand, now: ctx.now }
  if (!w.x.shoe) w.x.shoe = []
  const me = w.s.seats.find(p => p.user === ctx.user)

  switch (action.type) {
    case 'join': {
      if (me) { me.leaving = false; break }
      must(w.s.seats.length < BJ.seats, 'The table is full')
      const taken = new Set(w.s.seats.map(p => p.seat))
      let seat = 0
      while (taken.has(seat)) seat++
      w.s.seats.push({ user: ctx.user, name: ctx.name, seat, hands: [], active: 0, idle: 0, leaving: false })
      w.s.seats.sort((a, b) => a.seat - b.seat)
      w.s.log = pushLog(w.s.log, `${ctx.name} sat down`)
      break
    }
    case 'leave': {
      if (!me) break
      if (w.s.phase === 'betting' && me.hands.length > 0) {
        // Bet not dealt yet: hand it back.
        w.chips.push(credit(me.user, me.hands[0].bet, 'blackjack bet returned'))
        if (w.s.seats.every(p => p === me || p.hands.length === 0)) w.s.deadline = null
      }
      if (w.s.phase === 'playing' && me.hands.length > 0) {
        me.leaving = true
        for (const h of me.hands) h.done = true
        if (w.s.turn === me.seat) advance(w)
      } else {
        w.s.seats = w.s.seats.filter(p => p !== me)
      }
      w.s.log = pushLog(w.s.log, `${ctx.name} left`)
      maybeDeal(w)
      break
    }
    case 'bet': {
      must(me, 'Sit down first')
      if (w.s.phase === 'settled') newRound(w, ctx.user)
      must(w.s.phase === 'betting', 'Wait for the next round')
      const seat = w.s.seats.find(p => p.user === ctx.user)
      must(seat, 'Sit down first')
      must(seat.hands.length === 0, 'Your bet is already in')
      must(isChipAmount(action.amount, BJ.minBet, BJ.maxBet), `Bet ${BJ.minBet}–${BJ.maxBet.toLocaleString()} chips`)
      seat.hands = [newHand(action.amount)]
      seat.idle = 0
      w.chips.push(stake(ctx.user, action.amount, 'blackjack bet'))
      if (w.s.deadline === null) w.s.deadline = w.now + BJ.betMs
      maybeDeal(w)
      break
    }
    case 'hit': case 'stand': case 'double': case 'split': {
      must(w.s.phase === 'playing' && me && w.s.turn === me.seat, 'Not your turn')
      play(w, me!, action.type)
      break
    }
    case 'tick': {
      if (w.s.deadline === null || w.now < w.s.deadline) break
      if (w.s.phase === 'betting') {
        if (w.s.seats.some(p => p.hands.length > 0)) deal(w)
        else w.s.deadline = null
      } else if (w.s.phase === 'playing') {
        const p = w.s.seats.find(q => q.seat === w.s.turn)
        if (p) { p.hands[p.active].done = true; w.s.log = pushLog(w.s.log, `${p.name} timed out (stand)`) }
        advance(w)
      } else {
        newRound(w)
      }
      break
    }
    default:
      throw new GameError('Unknown move')
  }
  return { state: w.s, secret: w.x, hands: null, chips: w.chips }
}

/** Deal once every seated player has a bet in. */
function maybeDeal(w: Work) {
  if (w.s.phase !== 'betting') return
  const active = w.s.seats.filter(p => !p.leaving)
  if (active.length > 0 && active.every(p => p.hands.length > 0)) deal(w)
}

/** Clears the felt. Seats that skipped BJ.maxIdle rounds are removed
 *  (never `keep`, the player starting the round). */
function newRound(w: Work, keep?: string) {
  for (const p of w.s.seats) if (p.hands.length === 0 && p.user !== keep) p.idle++
  w.s.seats = w.s.seats.filter(p => !p.leaving && p.idle < BJ.maxIdle)
  for (const p of w.s.seats) { p.hands = []; p.active = 0 }
  w.s.phase = 'betting'
  w.s.dealer = []
  w.s.holeHidden = false
  w.s.turn = null
  w.s.deadline = null
  w.x.hole = null
}

function deal(w: Work) {
  // Cut card: reshuffle a fresh shoe once three quarters are dealt.
  if (w.x.shoe.length < (BJ.decks * 52) / 4) {
    w.x.shoe = shuffledShoe(BJ.decks, w.rand)
    w.s.log = pushLog(w.s.log, 'New shoe shuffled')
  }
  w.s.round++
  const players = w.s.seats.filter(p => p.hands.length > 0)
  for (const p of players) p.hands[0].cards.push(draw(w))
  w.s.dealer = [draw(w)]
  for (const p of players) p.hands[0].cards.push(draw(w))
  w.x.hole = draw(w)
  w.s.holeHidden = true
  w.s.phase = 'playing'

  for (const p of players) if (isBlackjack(p.hands[0])) p.hands[0].done = true
  // Peek: a dealer blackjack ends the round before anyone acts.
  if (cardValue(w.s.dealer[0]) >= 10 && handValue([w.s.dealer[0], w.x.hole]).total === 21) {
    w.s.log = pushLog(w.s.log, 'Dealer has blackjack')
    return settle(w)
  }
  w.s.turn = null
  advance(w)
}

/** Move the turn to the next unfinished hand, or play the dealer. */
function advance(w: Work) {
  for (const p of w.s.seats) {
    if (w.s.turn !== null && p.seat < w.s.turn) continue
    const i = p.hands.findIndex(h => !h.done)
    if (i >= 0) {
      p.active = i
      w.s.turn = p.seat
      w.s.deadline = w.now + BJ.turnMs
      return
    }
  }
  settle(w)
}

function play(w: Work, p: BjSeat, move: 'hit' | 'stand' | 'double' | 'split') {
  const h = p.hands[p.active]
  if (move === 'hit') {
    h.cards.push(draw(w))
    if (handValue(h.cards).total >= 21) h.done = true
  } else if (move === 'stand') {
    h.done = true
  } else if (move === 'double') {
    must(h.cards.length === 2 && !h.doubled, 'Double only on your first two cards')
    w.chips.push(stake(p.user, h.bet, 'blackjack double'))
    h.bet *= 2
    h.doubled = true
    h.cards.push(draw(w))
    h.done = true
  } else {
    must(h.cards.length === 2 && cardValue(h.cards[0]) === cardValue(h.cards[1]), 'Split a pair')
    must(p.hands.length < BJ.maxHands, `Up to ${BJ.maxHands} hands`)
    w.chips.push(stake(p.user, h.bet, 'blackjack split'))
    const second: BjHand = { ...newHand(h.bet), cards: [h.cards.pop()!], split: true }
    h.split = true
    h.cards.push(draw(w))
    second.cards.push(draw(w))
    // Split aces get one card each.
    if (rankOf(h.cards[0]) === 'A') { h.done = true; second.done = true }
    // Played right after this one; either can be split again if it pairs up.
    p.hands.splice(p.active + 1, 0, second)
  }
  if (!h.done) { w.s.deadline = w.now + BJ.turnMs; return }
  advance(w)
}

function settle(w: Work) {
  const dealer = [...w.s.dealer, w.x.hole!]
  w.s.holeHidden = false
  w.x.hole = null
  const live = w.s.seats.flatMap(p => p.hands).filter(h => handValue(h.cards).total <= 21 && !isBlackjack(h))
  const dealerBj = isBlackjack({ cards: dealer })
  if (live.length > 0 && !dealerBj) {
    while (handValue(dealer).total < 17) dealer.push(draw(w))
  }
  w.s.dealer = dealer
  const d = handValue(dealer).total

  for (const p of w.s.seats) {
    let won = 0
    for (const h of p.hands) {
      const v = handValue(h.cards).total
      if (v > 21) { h.result = 'bust'; h.payout = 0 }
      else if (isBlackjack(h) && !dealerBj) { h.result = 'blackjack'; h.payout = Math.floor(h.bet * 2.5) }
      else if (dealerBj) { h.result = isBlackjack(h) ? 'push' : 'lose'; h.payout = isBlackjack(h) ? h.bet : 0 }
      else if (d > 21 || v > d) { h.result = 'win'; h.payout = h.bet * 2 }
      else if (v === d) { h.result = 'push'; h.payout = h.bet }
      else { h.result = 'lose'; h.payout = 0 }
      h.done = true
      won += h.payout
    }
    if (won > 0) w.chips.push(credit(p.user, won, 'blackjack payout'))
    if (p.hands.length > 0) {
      const net = won - p.hands.reduce((s, h) => s + h.bet, 0)
      w.s.log = pushLog(w.s.log, `${p.name} ${net > 0 ? `+${net.toLocaleString()}` : net < 0 ? net.toLocaleString() : 'pushes'}`)
    }
  }
  w.s.phase = 'settled'
  w.s.turn = null
  w.s.deadline = w.now + BJ.settleMs
}
