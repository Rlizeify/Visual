/**
 * Event copy + deterministic verb selection for the U-tab social feed.
 *
 * Visibility (defense in depth):
 *   The server (web/api/scores.ts:handleEvents) sets `source_action` to
 *   null UNLESS BOTH:
 *     1. currentUserId === event.user_id (the viewer owns the event), AND
 *     2. user_score_visibility.reveal_action is true for that user x
 *        score_type (or score_events.visibility_override forces it).
 *   The client cannot widen visibility — by the time we see the payload,
 *   source_action is already null for unauthorized viewers. We re-assert
 *   `isOwnEvent && source_action` here so a future schema/payload change
 *   cannot silently render another user's source line.
 *
 * Verb selection is deterministic by FNV-1a hash of event.id. The same
 * event always picks the same verb across renders and across clients.
 */

export interface FeedEventInput {
  id: string
  user_id?: string
  username: string
  avatar_url?: string | null
  accent_color?: string | null
  score_type: string
  delta: number
  direction: 'up' | 'down' | 'same'
  source_action: string | null
  created_at: string
}

const POSITION_UP_VERBS = ['climbed', 'rose', 'jumped', 'surged']
const POSITION_DOWN_VERBS = ['dropped', 'slipped', 'fell', 'tumbled']
const DERIV_UP_VERBS = ['spiked', 'jumped', 'surged', 'kicked up']
const DERIV_DOWN_VERBS = ['cooled', 'sagged', 'eased', 'dipped']

const SCORE_LABELS: Record<string, string> = {
  position: 'ranks',
  velocity: 'velocity',
  acceleration: 'acceleration',
  jerk: 'jerk',
  snap: 'snap',
}

// FNV-1a 32-bit hash. Deterministic for any string.
export function hashId(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function pickVerb(id: string, pool: string[]): string {
  return pool[hashId(id) % pool.length]
}

// U+2212 MINUS SIGN — not ASCII hyphen-minus.
const MINUS = '\u2212'

export interface MagnitudeInfo {
  value: string             // "+5" or "−3" or "+2.3"
  sign: 'pos' | 'neg' | 'zero'
  suffix?: string           // "σ" for derivative z-scores
}

function formatMagnitude(delta: number, scoreType: string): MagnitudeInfo {
  if (delta === 0) return { value: '0', sign: 'zero' }
  const isPosition = scoreType === 'position'
  if (isPosition) {
    const abs = Math.abs(delta)
    return delta > 0
      ? { value: `+${abs}`, sign: 'pos' }
      : { value: `${MINUS}${abs}`, sign: 'neg' }
  }
  const abs = Math.abs(delta).toFixed(1)
  return delta > 0
    ? { value: `+${abs}`, sign: 'pos', suffix: 'σ' }
    : { value: `${MINUS}${abs}`, sign: 'neg', suffix: 'σ' }
}

export interface EventCopy {
  verb: string                   // "climbed", "spiked", ...
  tail: string                   // text after the magnitude badge
  magnitude: MagnitudeInfo
  sourceLine: string | null      // only non-null when own event AND server included it
}

export function describeEvent(
  event: FeedEventInput,
  currentUserId: string | null,
): EventCopy {
  const isPosition = event.score_type === 'position'
  const label = SCORE_LABELS[event.score_type] ?? event.score_type

  let verb: string
  let tail: string
  if (event.direction === 'same') {
    verb = isPosition ? 'held' : 'flat'
    tail = isPosition ? '' : ` ${label}`
  } else if (isPosition) {
    verb = pickVerb(event.id, event.direction === 'up' ? POSITION_UP_VERBS : POSITION_DOWN_VERBS)
    tail = ` ${label}`
  } else {
    verb = pickVerb(event.id, event.direction === 'up' ? DERIV_UP_VERBS : DERIV_DOWN_VERBS)
    tail = ` ${label}`
  }

  const magnitude = formatMagnitude(event.delta, event.score_type)
  const isOwnEvent = !!currentUserId && event.user_id === currentUserId
  const sourceLine = isOwnEvent && event.source_action ? event.source_action : null

  return { verb, tail, magnitude, sourceLine }
}
