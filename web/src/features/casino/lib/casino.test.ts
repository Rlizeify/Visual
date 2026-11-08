import { describe, expect, it } from 'vitest'
import { seededRand, shuffledShoe } from './cards'
import type { ChipMove, Ctx } from './engine'
import { BJ, applyBj, handValue, initialBj, type BjSecret, type BjState } from './blackjack'
import { applyHoldem, initialHoldem, type HeSecret, type HeState } from './holdem'
import { bestHand } from './pokerHands'
import { payout, spin, validateBets } from './roulette'
import { applyRtb, guessRight, initialRtb } from './rideTheBus'

const ctx = (user: string, now = 0, seed = 1): Ctx => ({ user, name: user, now, rand: seededRand(seed) })
const net = (moves: ChipMove[], user: string) => moves.filter(m => m.user === user).reduce((s, m) => s + m.delta, 0)

describe('cards', () => {
  it('a 6-deck shoe has 312 cards, 24 of each rank', () => {
    const shoe = shuffledShoe(6, seededRand(7))
    expect(shoe).toHaveLength(312)
    expect(shoe.filter(c => c[0] === 'A')).toHaveLength(24)
  })
})

describe('blackjack', () => {
  it('values hands with soft aces', () => {
    expect(handValue(['As', 'Kd'])).toEqual({ total: 21, soft: true })
    expect(handValue(['As', 'Ad', '9c'])).toEqual({ total: 21, soft: true })
    expect(handValue(['Ts', '6d', 'Ac'])).toEqual({ total: 17, soft: false })
  })

  it('two players share one shoe and play a synchronized round', () => {
    let s: BjState = initialBj()
    let x: BjSecret = { shoe: [], hole: null }
    const moves: ChipMove[] = []
    const run = (user: string, a: Parameters<typeof applyBj>[2], now = 0) => {
      const o = applyBj(s, x, a, ctx(user, now, 42))
      s = o.state; x = o.secret; moves.push(...o.chips)
      // Public state never carries the shoe or the face-down card.
      expect(s).not.toHaveProperty('shoe')
      if (s.holeHidden) expect(s.dealer).toHaveLength(1)
    }
    run('a', { type: 'join' })
    run('b', { type: 'join' })
    run('a', { type: 'bet', amount: 100 })
    expect(s.phase).toBe('betting')
    run('b', { type: 'bet', amount: 200 })
    // Both bets in → dealt from the same shoe: 2 + 2 + dealer 2.
    expect(s.shoeLeft).toBe(BJ.decks * 52 - 6)
    expect(s.holeHidden || s.phase === 'settled').toBe(true)
    for (let guard = 0; s.phase === 'playing' && guard < 20; guard++) {
      const p = s.seats.find(q => q.seat === s.turn)!
      run(p.user, { type: 'stand' })
    }
    expect(s.phase).toBe('settled')
    expect(s.holeHidden).toBe(false)
    expect(s.dealer.length).toBeGreaterThanOrEqual(2)
    // Stakes left the wallets; payouts (if any) came back.
    expect(moves.filter(m => m.delta < 0).map(m => -m.delta).sort()).toEqual([100, 200])
    for (const p of s.seats) {
      const paid = p.hands.reduce((t, h) => t + h.payout, 0)
      expect(net(moves, p.user)).toBe(paid - p.hands[0].bet)
    }
    // Next round starts on the next bet.
    run('a', { type: 'bet', amount: 50 })
    expect(s.phase).toBe('betting')
    expect(s.seats.find(p => p.user === 'b')!.hands).toEqual([])
  })

  it('rejects moves out of turn and times out a slow player', () => {
    let s = initialBj(); let x: BjSecret = { shoe: [], hole: null }
    for (const [u, a] of [['a', { type: 'join' }], ['b', { type: 'join' }], ['a', { type: 'bet', amount: 10 }], ['b', { type: 'bet', amount: 10 }]] as const) {
      const o = applyBj(s, x, a, ctx(u, 0, 3)); s = o.state; x = o.secret
    }
    if (s.phase !== 'playing') return // dealer blackjack on this seed
    const waiting = s.seats.find(p => p.seat !== s.turn)!
    expect(() => applyBj(s, x, { type: 'hit' }, ctx(waiting.user, 0, 3))).toThrow('Not your turn')
    const o = applyBj(s, x, { type: 'tick' }, ctx('b', BJ.turnMs + 1, 3))
    expect(o.state.turn).not.toBe(s.turn)
  })

  it('refunds an undealt bet when the player leaves', () => {
    let s = initialBj(); let x: BjSecret = { shoe: [], hole: null }
    for (const [u, a] of [['a', { type: 'join' }], ['b', { type: 'join' }], ['a', { type: 'bet', amount: 75 }]] as const) {
      const o = applyBj(s, x, a, ctx(u)); s = o.state; x = o.secret
    }
    const o = applyBj(s, x, { type: 'leave' }, ctx('a'))
    expect(o.chips).toEqual([expect.objectContaining({ user: 'a', delta: 75 })])
    expect(o.state.seats.map(p => p.user)).toEqual(['b'])
  })
})

describe('poker hands', () => {
  const name = (c: string) => bestHand(c.split(' ')).name
  it('ranks categories', () => {
    expect(name('As Ks Qs Js Ts 2d 3c')).toBe('Straight flush')
    expect(name('9s 9d 9c 9h 2s 3d 4c')).toBe('Four of a kind')
    expect(name('9s 9d 9c 2h 2s 3d 4c')).toBe('Full house')
    expect(name('As 2s 3d 4c 5h 9d Kc')).toBe('Straight')
    expect(name('2s 7s 9s Js Ks 3d 4c')).toBe('Flush')
  })
  it('breaks ties with kickers and the wheel', () => {
    const a = bestHand('As Ad Kc 7h 3s 2d 4c'.split(' '))
    const b = bestHand('Ah Ac Qc 7d 3h 2s 4d'.split(' '))
    expect(a.score).toBeGreaterThan(b.score)
    const wheel = bestHand('As 2s 3d 4c 5h'.split(' '))
    const six = bestHand('2s 3d 4c 5h 6d'.split(' '))
    expect(six.score).toBeGreaterThan(wheel.score)
  })
})

describe('holdem', () => {
  const setup = () => {
    let s: HeState = initialHoldem(50, 100)
    let x: HeSecret = { deck: [], holes: {} }
    const moves: ChipMove[] = []
    let hands: Record<string, unknown> | null = null
    let now = 0
    const run = (user: string, a: Parameters<typeof applyHoldem>[2]) => {
      const o = applyHoldem(s, x, a, ctx(user, now, 9))
      s = o.state; x = o.secret; moves.push(...o.chips)
      if (o.hands) hands = o.hands
    }
    return { run, get: () => ({ s, x, moves, hands }), tickAt: (t: number) => { now = t } }
  }

  it('deals private hole cards and settles a fold', () => {
    const t = setup()
    t.run('a', { type: 'join', buyIn: 5000 })
    t.run('b', { type: 'join', buyIn: 5000 })
    t.tickAt(5000)
    t.run('a', { type: 'tick' })
    const { s, hands } = t.get()
    expect(s.phase).toBe('preflop')
    expect(Object.keys(hands!).sort()).toEqual(['a', 'b'])
    expect(JSON.stringify(s)).not.toMatch(/"shown":\[/)
    expect(s.pot).toBe(150)
    const toAct = s.players.find(p => p.seat === s.turn)!
    t.run(toAct.user, { type: 'fold' })
    const after = t.get().s
    expect(after.phase).toBe('showdown')
    expect(after.players.reduce((n, p) => n + p.stack, 0)).toBe(10000)
  })

  it('runs a called all-in to showdown and conserves chips', () => {
    const t = setup()
    t.run('a', { type: 'join', buyIn: 2000 })
    t.run('b', { type: 'join', buyIn: 9000 })
    t.run('c', { type: 'join', buyIn: 4000 })
    t.tickAt(5000)
    t.run('a', { type: 'tick' })
    for (let guard = 0; t.get().s.phase !== 'showdown' && guard < 30; guard++) {
      const s = t.get().s
      const p = s.players.find(q => q.seat === s.turn)!
      if (p.bet + p.stack > s.currentBet) t.run(p.user, { type: 'raise', to: p.bet + p.stack })
      else t.run(p.user, { type: 'call' })
    }
    const s = t.get().s
    expect(s.phase).toBe('showdown')
    expect(s.board).toHaveLength(5)
    expect(s.players.reduce((n, p) => n + p.stack, 0)).toBe(15000)
    expect(s.players.filter(p => p.shown).length).toBeGreaterThanOrEqual(2)
  })

  it('cashes out a leaving player at the end of the hand', () => {
    const t = setup()
    t.run('a', { type: 'join', buyIn: 3000 })
    t.run('b', { type: 'join', buyIn: 3000 })
    t.tickAt(5000)
    t.run('a', { type: 'tick' })
    t.run('a', { type: 'leave' })
    const { s, moves } = t.get()
    expect(s.phase).toBe('showdown')
    t.tickAt(5000 + 60_000)
    t.run('b', { type: 'tick' })
    const out = moves.concat(t.get().moves).filter(m => m.user === 'a' && m.delta > 0)
    expect(out.length).toBeGreaterThan(0)
    expect(t.get().s.players.map(p => p.user)).toEqual(['b'])
  })
})

describe('roulette', () => {
  it('pays by bet kind', () => {
    expect(payout({ kind: 'number', n: 17, amount: 10 }, 17)).toBe(360)
    expect(payout({ kind: 'red', amount: 10 }, 0)).toBe(0)
    expect(payout({ kind: 'dozen', n: 3, amount: 10 }, 36)).toBe(30)
    expect(payout({ kind: 'column', n: 1, amount: 10 }, 34)).toBe(30)
    expect(payout({ kind: 'even', amount: 10 }, 0)).toBe(0)
  })
  it('validates and spins', () => {
    expect(() => validateBets([{ kind: 'number', n: 37, amount: 10 }])).toThrow()
    const r = spin(validateBets([{ kind: 'black', amount: 100 }]), seededRand(5))
    expect(r.staked).toBe(100)
    expect(r.n).toBeGreaterThanOrEqual(0)
    expect(r.n).toBeLessThanOrEqual(36)
  })
})

describe('ride the bus', () => {
  it('judges each call', () => {
    expect(guessRight([], 'Hd', 'red')).toBe(true)
    expect(guessRight(['5s'], '5d', 'higher')).toBe(false)
    expect(guessRight(['5s', 'Ts'], '7d', 'inside')).toBe(true)
    expect(guessRight(['5s', 'Ts', '7d'], 'Tc', 'c')).toBe(true)
  })
  it('stakes, then cashes out at the step multiplier', () => {
    let o = applyRtb(initialRtb(), { deck: [] }, { type: 'start', bet: 100 }, ctx('a'))
    expect(o.chips[0].delta).toBe(-100)
    const first = o.secret.deck[o.secret.deck.length - 1]
    o = applyRtb(o.state, o.secret, { type: 'guess', guess: first[1] === 'h' || first[1] === 'd' ? 'red' : 'black' }, ctx('a'))
    o = applyRtb(o.state, o.secret, { type: 'cashout' }, ctx('a'))
    expect(o.state.phase).toBe('cashed')
    expect(o.chips[0].delta).toBe(200)
  })
})
