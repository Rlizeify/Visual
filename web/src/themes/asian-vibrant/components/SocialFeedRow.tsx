import { useState, type CSSProperties } from 'react'
import FeedAvatar from '../../../features/feed/FeedAvatar'
import RelativeTimestamp from '../../../features/feed/RelativeTimestamp'
import FeedRowDetail from '../../../features/feed/FeedRowDetail'
import { describeEvent, type FeedEventInput, type MagnitudeInfo } from '../../../features/feed/eventCopy'

interface Props {
  event: FeedEventInput
  currentUserId: string | null
  expanded: boolean
  onToggle: () => void
  isNew: boolean
  index: number
}

/**
 * Asian Vibrant feed row.
 *
 * A small paper card that lifts on hover. The accent_color on the
 * avatar is the per-user identity signal and stays untouched. The
 * username sits in calligraphic ink; verb / tail are body type.
 *
 * Magnitudes appear as a small seal: crimson for up, ink-night for
 * down, hairline for same. Each seal carries one of three single
 * glyphs (上 / 下 / 同) — this is the row's tiny kanji budget; the
 * surrounding feed panel already spent its budget on the 記 hanko.
 *
 * Lifted-state shadow uses the shared --av-shadow-lift token so the
 * lift weight matches every other paper card in the theme.
 */
export default function AsianVibrantSocialFeedRow({
  event,
  currentUserId,
  expanded,
  onToggle,
  isNew,
  index,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const copy = describeEvent(event, currentUserId)

  const lifted = hovered || expanded
  const bg = index % 2 === 0
    ? 'linear-gradient(180deg, var(--av-paper) 0%, var(--av-paper-soft) 100%)'
    : 'linear-gradient(180deg, var(--av-paper-soft) 0%, var(--av-paper) 100%)'

  const rowStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: bg,
    border: '1px solid',
    borderColor: expanded ? 'var(--av-gold-deep)' : 'var(--av-gold-faint)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
    transform: lifted ? 'translateY(-1px)' : 'translateY(0)',
    boxShadow: lifted
      ? 'var(--av-shadow-lift)'
      : '0 1px 0 rgba(26,20,16,0.08)',
    animation: isNew ? 'feedRowSlideIn 200ms ease-out' : undefined,
    fontFamily: 'var(--av-font-body)',
  }

  const middleStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    fontSize: '12.5px',
    color: 'var(--av-ink-soft)',
    lineHeight: 1.45,
  }

  const usernameStyle: CSSProperties = {
    color: event.accent_color || 'var(--av-crimson-deep)',
    fontFamily: 'var(--av-font-display)',
    fontWeight: 400,
    fontSize: '15px',
    letterSpacing: '0.04em',
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
          size={42}
          glow={lifted}
        />
        <div style={middleStyle}>
          <span style={usernameStyle}>@{event.username}</span>
          <span>{copy.verb}</span>
          <MagnitudeSeal info={copy.magnitude} />
          {copy.tail && <span>{copy.tail.trim()}</span>}
        </div>
        <RelativeTimestamp iso={event.created_at} />
      </div>
      {expanded && <FeedRowDetail event={event} copy={copy} />}
    </div>
  )
}

/**
 * Carved seal stamp magnitude badge.
 * Crimson = up, ink-night = down, hairline-faint = same.
 */
function MagnitudeSeal({ info }: { info: MagnitudeInfo }) {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '3px',
    fontFamily: 'var(--av-font-body)',
    fontSize: '11px',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '0.02em',
    flexShrink: 0,
    boxShadow: '0 1px 0 rgba(26,20,16,0.15), inset 0 0 0 1px rgba(244,236,216,0.18)',
  }

  let style: CSSProperties
  let mark = ''
  if (info.sign === 'pos') {
    style = { ...base, background: 'var(--av-crimson)', color: 'var(--av-paper)' }
    mark = '上'
  } else if (info.sign === 'neg') {
    style = { ...base, background: 'var(--av-night)', color: 'var(--av-paper)' }
    mark = '下'
  } else {
    style = {
      ...base,
      background: 'transparent',
      color: 'var(--av-ink-soft)',
      border: '1px solid var(--av-gold-faint)',
      boxShadow: 'none',
    }
    mark = '同'
  }

  return (
    <span style={style} aria-hidden>
      <span style={{ fontFamily: 'var(--av-font-display)', fontSize: '12px' }}>{mark}</span>
      <span>
        {info.value}
        {info.suffix && <span style={{ marginLeft: '1px' }}>{info.suffix}</span>}
      </span>
    </span>
  )
}
