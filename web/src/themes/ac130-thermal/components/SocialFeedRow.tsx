import { useState, type CSSProperties } from 'react'
import FeedAvatar from '../../../features/feed/FeedAvatar'
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
 * AC-130 Thermal — SocialFeedRow (HUD log entry).
 *
 * Each row is a single line of a fire-control log:
 *
 *   15:19:17  @username  verb  [+12.4]  tail...
 *
 * Magnitude badge is bracketed: [+12] for up (HUD green), [-04] for
 * down (amber). The avatar keeps its per-user accent color border —
 * the one place that color shows in the feed. Hover/expand lifts the
 * row's border from dim wire to bright bracket.
 */
export default function AC130ThermalSocialFeedRow({
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

  // 15:19:17 timestamp prefix.
  const ts = (() => {
    const d = new Date(event.created_at)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  })()

  const rowStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    background: index % 2 === 0
      ? 'var(--ac-panel)'
      : 'var(--ac-panel-dim)',
    backgroundImage: 'var(--ac-scanline-bg)',
    border: '1px solid',
    borderColor: lifted ? 'var(--ac-frame-bracket)' : 'var(--ac-frame-dim)',
    borderRadius: 0,
    cursor: 'pointer',
    transition: 'border-color 150ms linear, box-shadow 150ms linear',
    boxShadow: lifted ? 'var(--ac-glow-green-soft)' : 'none',
    animation: isNew ? 'ac-fade-in 200ms linear' : undefined,
    fontFamily: 'var(--ac-font-mono)',
  }

  const tsStyle: CSSProperties = {
    fontFamily: 'var(--ac-font-mono)',
    fontSize: '10px',
    letterSpacing: '0.10em',
    color: 'var(--ac-hud-green-dim)',
    flexShrink: 0,
    width: '64px',
  }

  const middleStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    fontSize: '12px',
    color: 'var(--ac-hud-green)',
    fontFamily: 'var(--ac-font-mono)',
    lineHeight: 1.45,
    letterSpacing: '0.04em',
  }

  const usernameStyle: CSSProperties = {
    color: event.accent_color || 'var(--ac-hud-green-bright)',
    fontFamily: 'var(--ac-font-mono)',
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '0.08em',
    textShadow: '0 0 4px currentColor',
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
        <span style={tsStyle}>{ts}</span>
        <FeedAvatar
          username={event.username}
          avatarUrl={event.avatar_url}
          accentColor={event.accent_color}
          size={28}
          glow={lifted}
        />
        <div style={middleStyle}>
          <span style={usernameStyle}>@{event.username}</span>
          <span style={{ color: 'var(--ac-hud-green-dim)' }}>{copy.verb}</span>
          <MagnitudeBracket info={copy.magnitude} />
          {copy.tail && (
            <span style={{ color: 'var(--ac-hud-green-dim)' }}>
              {copy.tail.trim()}
            </span>
          )}
        </div>
      </div>
      {expanded && <FeedRowDetail event={event} copy={copy} />}
    </div>
  )
}

/**
 * Bracketed magnitude badge — `[+12.4]` for up, `[-04]` for down,
 * `[ 00 ]` for same. HUD-green / amber / dim respectively.
 */
function MagnitudeBracket({ info }: { info: MagnitudeInfo }) {
  let color = 'var(--ac-hud-green-dim)'
  let sign = ''
  if (info.sign === 'pos') {
    color = 'var(--ac-hud-green-bright)'
    sign = '+'
  } else if (info.sign === 'neg') {
    color = 'var(--ac-amber)'
    sign = '-'
  }

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    padding: '1px 6px',
    border: `1px solid ${color}`,
    color,
    fontFamily: 'var(--ac-font-mono)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.10em',
    flexShrink: 0,
    textShadow: '0 0 4px currentColor',
  }

  return (
    <span style={style} aria-hidden>
      [&nbsp;{sign}{info.value}{info.suffix || ''}&nbsp;]
    </span>
  )
}
