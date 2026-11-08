// House card art: a squared-off face with a corner index and one large pip,
// and a back made of the accent color cut by diagonal hatching and an
// "M" monogram. Colors come from the --card-* tokens.

import type { Card } from '../lib/cards'
import { isRed } from '../lib/cards'
import { FlipCard, useStagger } from './motion'

const SUIT: Record<string, { glyph: string; name: string }> = {
  s: { glyph: '♠', name: 'spades' },
  h: { glyph: '♥', name: 'hearts' },
  d: { glyph: '♦', name: 'diamonds' },
  c: { glyph: '♣', name: 'clubs' },
}
const RANK_NAME: Record<string, string> = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' }
const RANK_WORD: Record<string, string> = { T: 'ten', J: 'jack', Q: 'queen', K: 'king', A: 'ace' }

export function cardLabel(c: Card): string {
  return `${RANK_WORD[c[0]] ?? c[0]} of ${SUIT[c[1]].name}`
}

export default function PlayingCard({ card, size = 'md', dim = false }: { card: Card | null; size?: 'sm' | 'md' | 'lg'; dim?: boolean }) {
  if (!card) {
    return (
      <svg className={`pcard pcard--${size} pcard--back`} viewBox="0 0 60 84" role="img" aria-label="face-down card">
        <rect x="1" y="1" width="58" height="82" rx="5" className="pcard__edge" />
        <rect x="5" y="5" width="50" height="74" rx="3" className="pcard__backfill" />
        <path d="M5 21 L21 5 M5 37 L37 5 M5 53 L53 5 M5 69 L55 19 M11 79 L55 35 M27 79 L55 51 M43 79 L55 67"
          className="pcard__hatch" />
        <path d="M20 52 V32 L30 44 L40 32 V52" className="pcard__mono" />
      </svg>
    )
  }
  const rank = RANK_NAME[card[0]] ?? card[0]
  const suit = SUIT[card[1]]
  return (
    <svg className={`pcard pcard--${size}${isRed(card) ? ' pcard--red' : ''}${dim ? ' pcard--dim' : ''}`}
      viewBox="0 0 60 84" role="img" aria-label={cardLabel(card)}>
      <rect x="1" y="1" width="58" height="82" rx="5" className="pcard__face" />
      <text x="6" y="17" className="pcard__rank">{rank}</text>
      <text x="6" y="29" className="pcard__pip">{suit.glyph}</text>
      <text x="30" y="58" className="pcard__big" textAnchor="middle">{suit.glyph}</text>
      <text x="54" y="78" className="pcard__rank" textAnchor="end">{rank}</text>
    </svg>
  )
}

/**
 * A row of card slots. New cards are dealt in face down and turned over,
 * staggered in order; pass `delays` (ms per slot) to set the order yourself.
 * `hidden` adds face-down slots after the cards.
 */
export function CardRow({ cards, hidden = 0, size, delays, slotKey = 'c' }: {
  cards: readonly (Card | null)[]; hidden?: number; size?: 'sm' | 'md' | 'lg'
  delays?: readonly number[]; slotKey?: string
}) {
  const slots = [...cards, ...Array<Card | null>(hidden).fill(null)]
  const auto = useStagger(slots.map((c, i) => ({ key: `${slotKey}${i}`, card: c })), 260)
  return (
    <div className="pcards">
      {slots.map((c, i) => (
        <FlipCard key={i} card={c} size={size} delay={delays?.[i] ?? auto.delays.get(`${slotKey}${i}`) ?? 0} />
      ))}
    </div>
  )
}

/** Bet amount picker: number field plus quick chips. */
export function BetInput({ value, onChange, min, max, label = 'Bet', id }: {
  value: number; onChange: (n: number) => void; min: number; max: number; label?: string; id: string
}) {
  const quick = [min, min * 10, min * 100, min * 1000].filter(q => q <= max)
  return (
    <div className="casino-bet">
      <label className="field" htmlFor={id}>
        <span>{label}</span>
        <input id={id} className="input" type="number" inputMode="numeric" min={min} max={max} step={min}
          value={Number.isFinite(value) ? value : ''} onChange={e => onChange(Math.floor(Number(e.target.value)))} />
      </label>
      <div className="casino-bet__quick" role="group" aria-label="Quick amounts">
        {quick.map(q => (
          <button key={q} type="button" className="chip-btn" onClick={() => onChange(q)}>{q.toLocaleString()}</button>
        ))}
      </div>
    </div>
  )
}
