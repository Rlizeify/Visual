// Motion for the tables: cards slide in face down, then turn over; new
// cards are staggered so a deal plays out one card at a time.
//
// useStagger keeps an absolute "appear at" time per card key, so re-renders
// (and React's double render in dev) never restart or skip an animation.
// Users who ask for reduced motion get every card at once.

import { useEffect, useRef, useState } from 'react'
import type { Card } from '../lib/cards'
import { sfx } from '../lib/sound'
import PlayingCard from './PlayingCard'

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** How long a card takes to land and turn over after its delay. */
export const FLIP_MS = 520

/**
 * A card slot. `card` null = face down. When `card` arrives (on mount or
 * later, e.g. the dealer's hole card) it turns face up after `delay` ms.
 */
export function FlipCard({ card, delay = 0, size = 'md', dealt = true, waiting = false }: {
  card: Card | null; delay?: number; size?: 'sm' | 'md' | 'lg'; dealt?: boolean
  /** Wobble while the next card is on its way. */
  waiting?: boolean
}) {
  const [up, setUp] = useState(card !== null && (delay <= 0 || reduced()))
  const [face, setFace] = useState<Card | null>(card)
  const upRef = useRef(up)
  upRef.current = up
  // The slide off the shoe (only for cards that animate in).
  useEffect(() => {
    if (!dealt || delay <= 0 || reduced()) return
    const t = window.setTimeout(sfx.deal, delay)
    return () => window.clearTimeout(t)
  }, []) // once, on mount
  useEffect(() => {
    if (card === null) { setUp(false); return }
    setFace(card)
    if (reduced()) { setUp(true); return }
    if (upRef.current) return // already showing (first render)
    const t = window.setTimeout(() => { setUp(true); sfx.flip() }, Math.max(0, delay) + 180)
    return () => window.clearTimeout(t)
  }, [card, delay])

  return (
    <span className={`fcard fcard--${size}${up ? ' is-up' : ''}${dealt ? ' is-dealt' : ''}${waiting ? ' is-waiting' : ''}`}
      style={{ animationDelay: `${Math.max(0, delay)}ms` }}>
      <span className="fcard__inner">
        <span className="fcard__front"><PlayingCard card={face ?? 'As'} size={size} /></span>
        <span className="fcard__back"><PlayingCard card={null} size={size} /></span>
      </span>
      {!up && <span className="sr-only">{card ? 'card being turned' : 'face-down card'}</span>}
    </span>
  )
}

/**
 * Staggers cards that are new since the last render.
 *   items  every card slot on the table: a stable key and its face
 *          (null = face down), in deal order.
 * Returns each slot's remaining delay and when the last animation ends.
 * Whatever is on the table at the first render is shown instantly.
 */
export function useStagger(items: { key: string; card: Card | null }[], step = 450) {
  const appear = useRef(new Map<string, number>())
  const primed = useRef(false)
  const now = Date.now()
  let next = now
  for (const it of items) {
    const id = `${it.key}=${it.card ?? '?'}`
    if (appear.current.has(id)) continue
    if (!primed.current || reduced()) { appear.current.set(id, 0); continue }
    // Queue behind anything still animating.
    for (const t of appear.current.values()) if (t + step > next) next = t + step
    appear.current.set(id, next)
    next += step
  }
  primed.current = true

  const delays = new Map<string, number>()
  let end = 0
  for (const it of items) {
    const t = appear.current.get(`${it.key}=${it.card ?? '?'}`) ?? 0
    delays.set(it.key, Math.max(0, t - now))
    end = Math.max(end, t + FLIP_MS)
  }
  return { delays, end }
}

/** True until the time `until` has passed; re-renders once it does. */
export function useUntil(until: number): boolean {
  const [, tick] = useState(0)
  const waiting = until > Date.now()
  useEffect(() => {
    if (!waiting) return
    const t = window.setTimeout(() => tick(n => n + 1), until - Date.now() + 20)
    return () => window.clearTimeout(t)
  }, [until, waiting])
  return waiting
}
