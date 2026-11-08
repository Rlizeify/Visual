// Poker hand ranking: best five of up to seven cards. Scores compare as
// plain numbers (higher wins): category × 15⁵ + kickers in base 15.

import { type Card, rankValue, suitOf } from './cards.js'

export const HAND_NAMES = [
  'High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight',
  'Flush', 'Full house', 'Four of a kind', 'Straight flush',
] as const

const B = 15

function score5(cards: readonly Card[]): number {
  const ranks = cards.map(rankValue).sort((a, b) => b - a)
  const flush = cards.every(c => suitOf(c) === suitOf(cards[0]))
  const uniq = [...new Set(ranks)]
  let straightHigh = 0
  if (uniq.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0]
    else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5 // wheel A-2-3-4-5
  }
  // Group by count, then rank: [[count, rank], ...]
  const counts = new Map<number, number>()
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1)
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const kick = (rs: number[]) => rs.reduce((s, r) => s * B + r, 0)
  const ordered = groups.flatMap(([r, n]) => Array(n).fill(r) as number[])

  let cat: number
  if (straightHigh && flush) return 8 * B ** 5 + straightHigh
  if (groups[0][1] === 4) cat = 7
  else if (groups[0][1] === 3 && groups[1][1] === 2) cat = 6
  else if (flush) cat = 5
  else if (straightHigh) return 4 * B ** 5 + straightHigh
  else if (groups[0][1] === 3) cat = 3
  else if (groups[0][1] === 2 && groups[1][1] === 2) cat = 2
  else if (groups[0][1] === 2) cat = 1
  else cat = 0
  return cat * B ** 5 + kick(ordered)
}

export interface HandRank { score: number; name: string; best: Card[] }

export function bestHand(cards: readonly Card[]): HandRank {
  let best = -1, bestCards: Card[] = []
  const n = cards.length
  const pick = (start: number, chosen: Card[]) => {
    if (chosen.length === 5) {
      const s = score5(chosen)
      if (s > best) { best = s; bestCards = [...chosen] }
      return
    }
    for (let i = start; i <= n - (5 - chosen.length); i++) pick(i + 1, [...chosen, cards[i]])
  }
  if (n < 5) throw new Error('need five cards')
  pick(0, [])
  return { score: best, name: HAND_NAMES[Math.floor(best / B ** 5)], best: bestCards }
}
