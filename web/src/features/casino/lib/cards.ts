// Cards and shoes. A card is two characters: rank (23456789TJQKA) + suit
// (s h d c), e.g. 'Td'. Shuffling takes a random-int source so the server
// can pass crypto.randomInt and tests can pass a seeded one.

export type Card = string
export type RandInt = (maxExclusive: number) => number

export const RANKS = '23456789TJQKA'
export const SUITS = 'shdc'

export const rankOf = (c: Card) => c[0]
export const suitOf = (c: Card) => c[1]
/** 2..14 (ace high). */
export const rankValue = (c: Card) => RANKS.indexOf(c[0]) + 2
export const isRed = (c: Card) => c[1] === 'h' || c[1] === 'd'

export function freshDeck(): Card[] {
  const d: Card[] = []
  for (const s of SUITS) for (const r of RANKS) d.push(r + s)
  return d
}

/** Fisher–Yates over `decks` full decks. */
export function shuffledShoe(decks: number, rand: RandInt): Card[] {
  const shoe: Card[] = []
  for (let i = 0; i < decks; i++) shoe.push(...freshDeck())
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = rand(i + 1)
    ;[shoe[i], shoe[j]] = [shoe[j], shoe[i]]
  }
  return shoe
}

/** Deterministic source for tests (mulberry32). */
export function seededRand(seed: number): RandInt {
  let a = seed >>> 0
  return max => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max)
  }
}

/** Thrown for a move the rules don't allow; the API answers 400 with it. */
export class GameError extends Error {}
export function must(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new GameError(msg)
}
