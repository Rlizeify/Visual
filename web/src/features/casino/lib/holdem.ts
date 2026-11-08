// No-limit Texas Hold'em engine: up to 6 seats, chips bought in from the
// wallet and cashed back on leaving. Fresh shuffled deck every hand; hole
// cards go to casino_hands (each player reads only their own) and are
// copied into public state only at showdown.
//
// Turns have TURN_MS; a timeout checks if free, else folds. Two timeouts in
// a row stand the player up at the end of the hand. Side pots are built
// from what each player committed; ties split, odd chips go to the first
// winner left of the button.

import { type Card, GameError, must, shuffledShoe } from './cards'
import { type ChipMove, type Ctx, type Outcome, credit, isChipAmount, pushLog, stake } from './engine'
import { bestHand } from './pokerHands'

export const HOLDEM = {
  seats: 6,
  turnMs: 30_000,
  startMs: 3_000,
  showdownMs: 8_000,
  maxTimeouts: 2,
} as const

export interface HePlayer {
  user: string
  name: string
  seat: number
  stack: number
  /** Chips put in on this street. */
  bet: number
  /** Chips put in this hand. */
  committed: number
  inHand: boolean
  folded: boolean
  allIn: boolean
  acted: boolean
  timeouts: number
  leaving: boolean
  /** Hole cards, public only after showdown. */
  shown: Card[] | null
  won: number
  handName: string | null
}

export type HePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

export interface HeState {
  phase: HePhase
  players: HePlayer[]
  board: Card[]
  button: number
  turn: number | null
  deadline: number | null
  sb: number
  bb: number
  minBuy: number
  maxBuy: number
  currentBet: number
  minRaise: number
  pot: number
  handNo: number
  log: string[]
}

export interface HeSecret { deck: Card[]; holes: Record<string, Card[]> }

export type HeAction =
  | { type: 'join'; buyIn: number }
  | { type: 'leave' }
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number }
  | { type: 'tick' }

/** Blinds per shared table (ids seeded by migration 20261108000004). */
export const HOLDEM_BLINDS: Record<string, [number, number]> = { 'holdem-1': [50, 100], 'holdem-2': [250, 500] }

export function initialHoldem(sb: number, bb: number): HeState {
  return {
    phase: 'waiting', players: [], board: [], button: -1, turn: null, deadline: null,
    sb, bb, minBuy: bb * 20, maxBuy: bb * 200, currentBet: 0, minRaise: bb, pot: 0, handNo: 0, log: [],
  }
}

interface Work {
  s: HeState
  x: HeSecret
  chips: ChipMove[]
  hands: Outcome<HeState, HeSecret>['hands']
  ctx: Ctx
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const bySeat = (ps: HePlayer[]) => [...ps].sort((a, b) => a.seat - b.seat)
const live = (s: HeState) => s.players.filter(p => p.inHand && !p.folded)
const canAct = (p: HePlayer) => p.inHand && !p.folded && !p.allIn
const ready = (s: HeState) => s.players.filter(p => !p.leaving && p.stack > 0)
const betting = (ph: HePhase) => ph === 'preflop' || ph === 'flop' || ph === 'turn' || ph === 'river'

/** First player after `seat` (cyclic) matching `pred`; `inclusive` starts at `seat`. */
function nextAfter(ps: HePlayer[], seat: number, pred: (p: HePlayer) => boolean, inclusive = false): HePlayer | undefined {
  const sorted = bySeat(ps)
  const start = sorted.findIndex(p => (inclusive ? p.seat >= seat : p.seat > seat))
  for (let k = 0; k < sorted.length; k++) {
    const p = sorted[((start < 0 ? 0 : start) + k) % sorted.length]
    if (pred(p)) return p
  }
  return undefined
}

export function applyHoldem(state: HeState, secret: HeSecret, action: HeAction, ctx: Ctx): Outcome<HeState, HeSecret> {
  const w: Work = { s: clone(state), x: clone(secret), chips: [], hands: null, ctx }
  if (!w.x.deck) w.x = { deck: [], holes: {} }
  const me = w.s.players.find(p => p.user === ctx.user)

  switch (action.type) {
    case 'join': {
      must(!me, 'You are already seated')
      must(w.s.players.length < HOLDEM.seats, 'The table is full')
      must(isChipAmount(action.buyIn, w.s.minBuy, w.s.maxBuy),
        `Buy in for ${w.s.minBuy.toLocaleString()}–${w.s.maxBuy.toLocaleString()} chips`)
      const taken = new Set(w.s.players.map(p => p.seat))
      let seat = 0
      while (taken.has(seat)) seat++
      w.s.players.push({
        user: ctx.user, name: ctx.name, seat, stack: action.buyIn, bet: 0, committed: 0,
        inHand: false, folded: true, allIn: false, acted: false, timeouts: 0, leaving: false,
        shown: null, won: 0, handName: null,
      })
      w.chips.push(stake(ctx.user, action.buyIn, 'holdem buy-in'))
      w.s.log = pushLog(w.s.log, `${ctx.name} sat down with ${action.buyIn.toLocaleString()}`)
      if (w.s.phase === 'waiting' && ready(w.s).length >= 2 && w.s.deadline === null) {
        w.s.deadline = ctx.now + HOLDEM.startMs
      }
      break
    }
    case 'leave': {
      if (!me) break
      if (betting(w.s.phase) && me.inHand && !me.folded) {
        me.leaving = true
        me.folded = true
        me.acted = true
        w.s.log = pushLog(w.s.log, `${me.name} folds and leaves`)
        if (w.s.turn === me.seat) progress(w)
        else if (live(w.s).length === 1) showdown(w)
      } else if (betting(w.s.phase) && me.inHand) {
        me.leaving = true // folded this hand: cash out at the end of it
      } else {
        cashOut(w, me)
        if (w.s.phase === 'waiting' && ready(w.s).length < 2) w.s.deadline = null
      }
      break
    }
    case 'fold': case 'check': case 'call': case 'raise': {
      must(betting(w.s.phase) && me && w.s.turn === me.seat, 'Not your turn')
      me!.timeouts = 0
      act(w, me!, action)
      break
    }
    case 'tick': {
      if (w.s.deadline === null || ctx.now < w.s.deadline) break
      if (w.s.phase === 'waiting') {
        if (ready(w.s).length >= 2) startHand(w)
        else w.s.deadline = null
      } else if (w.s.phase === 'showdown') {
        endHand(w)
      } else {
        const p = w.s.players.find(q => q.seat === w.s.turn)
        if (!p) { progress(w); break }
        p.timeouts++
        const free = p.bet === w.s.currentBet
        w.s.log = pushLog(w.s.log, `${p.name} timed out (${free ? 'check' : 'fold'})`)
        if (p.timeouts >= HOLDEM.maxTimeouts) {
          p.leaving = true
          w.s.log = pushLog(w.s.log, `${p.name} will stand up after this hand`)
        }
        act(w, p, { type: free ? 'check' : 'fold' })
      }
      break
    }
    default:
      throw new GameError('Unknown move')
  }
  w.s.pot = w.s.players.reduce((t, p) => t + p.committed, 0)
  return { state: w.s, secret: w.x, hands: w.hands, chips: w.chips }
}

function cashOut(w: Work, p: HePlayer) {
  if (p.stack > 0) w.chips.push(credit(p.user, p.stack, 'holdem cash-out'))
  w.s.players = w.s.players.filter(q => q !== p)
  w.s.log = pushLog(w.s.log, `${p.name} left with ${p.stack.toLocaleString()}`)
}

function post(p: HePlayer, amount: number) {
  const a = Math.min(amount, p.stack)
  p.stack -= a
  p.bet += a
  p.committed += a
  if (p.stack === 0) p.allIn = true
}

function startHand(w: Work) {
  const s = w.s
  const inHand = new Set(ready(s).map(p => p.user))
  for (const p of s.players) {
    Object.assign(p, {
      inHand: inHand.has(p.user), folded: !inHand.has(p.user), bet: 0, committed: 0,
      allIn: false, acted: false, shown: null, won: 0, handName: null,
    })
  }
  const dealt = bySeat(s.players.filter(p => p.inHand))
  s.handNo++
  s.board = []
  s.button = nextAfter(dealt, s.button, () => true)!.seat
  w.x.deck = shuffledShoe(1, w.ctx.rand)
  w.x.holes = {}
  for (const p of dealt) w.x.holes[p.user] = [w.x.deck.pop()!, w.x.deck.pop()!]
  w.hands = Object.fromEntries(dealt.map(p => [p.user, { hand_no: s.handNo, cards: w.x.holes[p.user] }]))

  const headsUp = dealt.length === 2
  const sbP = headsUp ? dealt.find(p => p.seat === s.button)! : nextAfter(dealt, s.button, () => true)!
  const bbP = nextAfter(dealt, sbP.seat, () => true)!
  post(sbP, s.sb)
  post(bbP, s.bb)
  s.currentBet = Math.max(sbP.bet, bbP.bet)
  s.minRaise = s.bb
  s.phase = 'preflop'
  s.log = pushLog(s.log, `Hand #${s.handNo}: ${sbP.name} posts ${s.sb}, ${bbP.name} posts ${s.bb}`)
  s.turn = bbP.seat
  progress(w)
}

function act(w: Work, p: HePlayer, a: { type: 'fold' | 'check' | 'call' | 'raise'; to?: number }) {
  const s = w.s
  if (a.type === 'fold') {
    p.folded = true
    s.log = pushLog(s.log, `${p.name} folds`)
  } else if (a.type === 'check') {
    must(p.bet === s.currentBet, 'You can’t check — call or fold')
    s.log = pushLog(s.log, `${p.name} checks`)
  } else if (a.type === 'call') {
    must(s.currentBet > p.bet, 'Nothing to call — check')
    post(p, s.currentBet - p.bet)
    s.log = pushLog(s.log, `${p.name} calls${p.allIn ? ' (all in)' : ''}`)
  } else {
    const to = a.to
    const max = p.bet + p.stack
    must(isChipAmount(to, 1, max) && to > s.currentBet, 'Raise above the current bet, up to your stack')
    must(to - s.currentBet >= s.minRaise || to === max,
      `Raise to at least ${(s.currentBet + s.minRaise).toLocaleString()}`)
    if (to - s.currentBet >= s.minRaise) {
      s.minRaise = to - s.currentBet
      for (const q of s.players) if (q !== p && canAct(q)) q.acted = false
    }
    s.currentBet = to
    post(p, to - p.bet)
    s.log = pushLog(s.log, `${p.name} ${to === max ? 'is all in' : 'raises'} to ${to.toLocaleString()}`)
  }
  p.acted = true
  progress(w)
}

/** Next turn, next street, or showdown. */
function progress(w: Work) {
  const s = w.s
  if (live(s).length <= 1) return showdown(w)
  const actors = s.players.filter(canAct)
  // Owes a decision: facing a bet, or hasn't acted while someone can still bet back.
  const owes = (p: HePlayer) => canAct(p) && (p.bet < s.currentBet || (!p.acted && actors.length > 1))
  const next = nextAfter(s.players, s.turn ?? s.button, owes)
  if (next) {
    s.turn = next.seat
    s.deadline = w.ctx.now + HOLDEM.turnMs
    return
  }
  // Street over: deal on (running the board out if nobody can bet).
  for (;;) {
    for (const p of s.players) { p.bet = 0; p.acted = false }
    s.currentBet = 0
    s.minRaise = s.bb
    if (s.phase === 'river') return showdown(w)
    w.x.deck.pop() // burn
    if (s.phase === 'preflop') { s.board.push(w.x.deck.pop()!, w.x.deck.pop()!, w.x.deck.pop()!); s.phase = 'flop' }
    else if (s.phase === 'flop') { s.board.push(w.x.deck.pop()!); s.phase = 'turn' }
    else { s.board.push(w.x.deck.pop()!); s.phase = 'river' }
    if (s.players.filter(canAct).length >= 2) break
  }
  s.turn = nextAfter(s.players, s.button, canAct)!.seat
  s.deadline = w.ctx.now + HOLDEM.turnMs
}

function showdown(w: Work) {
  const s = w.s
  const contenders = live(s)
  const holes = w.x.holes
  s.turn = null
  s.phase = 'showdown'
  s.deadline = w.ctx.now + HOLDEM.showdownMs
  for (const p of s.players) { p.bet = 0 }

  if (contenders.length === 1) {
    const total = s.players.reduce((t, p) => t + p.committed, 0)
    contenders[0].won = total
    contenders[0].stack += total
    s.log = pushLog(s.log, `${contenders[0].name} wins ${total.toLocaleString()}`)
    return
  }

  const rank = new Map(contenders.map(p => [p.user, bestHand([...holes[p.user], ...s.board])]))
  for (const p of contenders) { p.shown = holes[p.user]; p.handName = rank.get(p.user)!.name }

  // Side pots by commitment level.
  const levels = [...new Set(s.players.map(p => p.committed).filter(c => c > 0))].sort((a, b) => a - b)
  let prev = 0, carry = 0
  let lastWinners: HePlayer[] = []
  const order = (ps: HePlayer[]) => {
    const sorted = bySeat(ps)
    const i = sorted.findIndex(p => p.seat > s.button)
    return i <= 0 ? sorted : [...sorted.slice(i), ...sorted.slice(0, i)]
  }
  for (const level of levels) {
    let amount = carry
    for (const p of s.players) amount += Math.min(p.committed, level) - Math.min(p.committed, prev)
    prev = level
    const eligible = contenders.filter(p => p.committed >= level)
    if (eligible.length === 0) { carry = amount; continue }
    carry = 0
    const top = Math.max(...eligible.map(p => rank.get(p.user)!.score))
    const winners = order(eligible.filter(p => rank.get(p.user)!.score === top))
    award(winners, amount)
    lastWinners = winners
  }
  if (carry > 0 && lastWinners.length) award(lastWinners, carry)
  for (const p of contenders) {
    if (p.won > 0) s.log = pushLog(s.log, `${p.name} wins ${p.won.toLocaleString()} with ${p.handName?.toLowerCase()}`)
  }
}

function award(winners: HePlayer[], amount: number) {
  const each = Math.floor(amount / winners.length)
  winners.forEach((p, i) => {
    const share = each + (i === 0 ? amount - each * winners.length : 0)
    p.won += share
    p.stack += share
  })
}

function endHand(w: Work) {
  const s = w.s
  for (const p of [...s.players]) {
    if (p.leaving || p.stack === 0) cashOut(w, p)
  }
  for (const p of s.players) {
    Object.assign(p, { inHand: false, folded: true, bet: 0, committed: 0, allIn: false, acted: false, shown: null, won: 0, handName: null })
  }
  s.board = []
  s.turn = null
  s.currentBet = 0
  w.x = { deck: [], holes: {} }
  w.hands = {}
  s.phase = 'waiting'
  s.deadline = null
  if (ready(s).length >= 2) startHand(w)
}
