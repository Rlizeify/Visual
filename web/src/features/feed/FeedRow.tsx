import { useState, type CSSProperties } from 'react'
import FeedAvatar from './FeedAvatar'
import MagnitudeBadge from './MagnitudeBadge'
import RelativeTimestamp from './RelativeTimestamp'
import FeedRowDetail from './FeedRowDetail'
import { describeEvent, type FeedEventInput } from './eventCopy'

/**
 * Single feed row. Three regions:
 *   left:   FeedAvatar (44px circle, accent border, glows on hover)
 *   middle: @username + verb + MagnitudeBadge + tail (no gaps)
 *   right:  RelativeTimestamp (flush right, smaller + dimmer)
 *
 * Clicking the row toggles its expanded state via the onToggle callback.
 * Parent (SocialFeed) enforces one-row-expanded-at-a-time.
 */

interface Props {
  event: FeedEventInput
  currentUserId: string | null
  expanded: boolean
  onToggle: () => void
  isNew: boolean
  index: number
}

export default function FeedRow({
  event,
  currentUserId,
  expanded,
  onToggle,
  isNew,
  index,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const copy = describeEvent(event, currentUserId)
  const isEven = index % 2 === 0

  const baseBg = isEven ? 'var(--row-tint)' : 'transparent'
  const bg = hovered || expanded ? 'var(--row-tint-hover)' : baseBg

  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: bg,
    border: '1px solid',
    borderColor: expanded ? 'var(--accent-color-border)' : 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 160ms ease, border-color 160ms ease',
    animation: isNew ? 'feedRowSlideIn 200ms ease-out' : undefined,
    fontFamily: "'HitmarkerText', monospace",
  }

  const middleStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    fontSize: '12px',
    color: 'var(--color-secondary)',
    lineHeight: 1.4,
  }

  const usernameStyle: CSSProperties = {
    color: event.accent_color || 'var(--accent-color)',
    fontWeight: 600,
    fontSize: '13px',
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={rowStyle}
      >
        <FeedAvatar
          username={event.username}
          avatarUrl={event.avatar_url}
          accentColor={event.accent_color}
          size={44}
          glow={hovered || expanded}
        />
        <div style={middleStyle}>
          <span style={usernameStyle}>@{event.username}</span>
          <span>{copy.verb}</span>
          <MagnitudeBadge info={copy.magnitude} />
          {copy.tail && <span>{copy.tail.trim()}</span>}
        </div>
        <RelativeTimestamp iso={event.created_at} />
      </div>
      {expanded && <FeedRowDetail event={event} copy={copy} />}
    </div>
  )
}
