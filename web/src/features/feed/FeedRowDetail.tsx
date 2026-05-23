import type { CSSProperties } from 'react'
import type { EventCopy, FeedEventInput } from './eventCopy'

/**
 * Inline expanded panel that drops below a row when clicked. Not a modal —
 * stays in the flow so multiple rows could in principle expand, but
 * SocialFeed enforces one-at-a-time via its expandedId state.
 *
 * Renders source_action ("cause") only when EventCopy.sourceLine is set.
 * See eventCopy.ts for the visibility rule (own-event + reveal_action).
 */

interface Props {
  event: FeedEventInput
  copy: EventCopy
}

const PANEL: CSSProperties = {
  margin: '4px 12px 8px 68px',
  padding: '10px 12px',
  background: 'var(--accent-color-bg)',
  border: '1px solid var(--accent-color-border)',
  borderRadius: '6px',
  fontFamily: "'HitmarkerText', monospace",
  fontSize: '11px',
  color: 'var(--color-secondary)',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
}

const LABEL: CSSProperties = {
  color: 'var(--accent-color-dim)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '9px',
  marginRight: '6px',
}

export default function FeedRowDetail({ event, copy }: Props) {
  const when = new Date(event.created_at).toLocaleString()
  return (
    <div style={PANEL}>
      <div><span style={LABEL}>type</span>{event.score_type}</div>
      <div>
        <span style={LABEL}>delta</span>
        {copy.magnitude.value}{copy.magnitude.suffix ?? ''}
      </div>
      <div><span style={LABEL}>when</span>{when}</div>
      {copy.sourceLine && (
        <div><span style={LABEL}>cause</span>{copy.sourceLine}</div>
      )}
    </div>
  )
}
