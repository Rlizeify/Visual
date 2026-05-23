import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { FeedEventInput } from './eventCopy'

/**
 * useFeedDiff
 *
 * Wraps a feed events array and:
 *   1. Marks events with `isNew=true` for one render cycle the first time
 *      they appear. SocialFeed uses this to trigger the 200ms slide-in
 *      animation defined in feed.css.
 *   2. Preserves page scroll position when new events are prepended above
 *      the user's current viewport. Without this, fresh entries would push
 *      the user's reading position down on every 30s poll.
 *
 * The initial event list (first poll) is NOT animated — those rows are
 * pre-existing as far as the user is concerned.
 */

const SLIDE_IN_MS = 200

export interface DiffedEvent extends FeedEventInput {
  isNew: boolean
}

export function useFeedDiff(
  events: FeedEventInput[],
  scrollAnchorRef: RefObject<HTMLDivElement>,
): DiffedEvent[] {
  const seenIdsRef = useRef<Set<string>>(new Set())
  const firstRenderRef = useRef(true)
  const prevHeightRef = useRef<number>(0)
  const [diffed, setDiffed] = useState<DiffedEvent[]>([])

  useEffect(() => {
    const seen = seenIdsRef.current

    if (firstRenderRef.current) {
      // First snapshot — treat all as pre-existing, no animation.
      events.forEach(e => seen.add(e.id))
      setDiffed(events.map(e => ({ ...e, isNew: false })))
      firstRenderRef.current = false
      return
    }

    const next: DiffedEvent[] = events.map(e => ({
      ...e,
      isNew: !seen.has(e.id),
    }))
    setDiffed(next)

    // Clear the isNew flag after the animation finishes so we don't keep
    // re-running it on subsequent renders.
    const timer = window.setTimeout(() => {
      events.forEach(e => seen.add(e.id))
      setDiffed(prev => prev.map(e => ({ ...e, isNew: false })))
    }, SLIDE_IN_MS + 16)

    return () => window.clearTimeout(timer)
  }, [events])

  // Scroll preservation. Runs synchronously after DOM mutation so the
  // adjustment happens before the next paint — the user never sees a jump.
  useLayoutEffect(() => {
    const el = scrollAnchorRef.current
    if (!el) return
    const newHeight = el.offsetHeight
    const prev = prevHeightRef.current
    if (prev > 0 && newHeight > prev) {
      const rect = el.getBoundingClientRect()
      // Only compensate when the top of the feed is above the viewport —
      // i.e. the user has scrolled past it. Otherwise the new rows are
      // visible and animating in; no scroll compensation needed.
      if (rect.top < 0) {
        window.scrollBy(0, newHeight - prev)
      }
    }
    prevHeightRef.current = newHeight
  })

  return diffed
}
