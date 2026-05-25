import { useRef, useState, type CSSProperties } from 'react'
import FeedRow from './FeedRow'
import { useFeedDiff } from './useFeedDiff'
import type { FeedEventInput } from './eventCopy'
import './feed.css'

/**
 * Top-level Activity Feed list. Drop-in replacement for the inline block
 * that used to live in UserCompetitionTab.tsx (now archived at
 * web/src/archive/social-feed-inline/).
 *
 * Responsibilities:
 *   - Clamp to MAX_ENTRIES (200) client-side; server returns at most 50.
 *   - Track which row is expanded (one at a time).
 *   - Delegate diff/slide-in/scroll preservation to useFeedDiff.
 *   - Render empty state when no events.
 *
 * Polling stays in UserCompetitionTab so the leaderboard + user-scores
 * cards continue to share the same 30s tick + visibilitychange handler.
 */

const MAX_ENTRIES = 200

interface Props {
  events: FeedEventInput[]
  currentUserId: string | null
}

const HEADER: CSSProperties = {
  marginBottom: '12px',
  fontSize: '12px',
}

const EMPTY: CSSProperties = {
  textAlign: 'center',
  padding: '32px 16px',
  color: 'var(--color-secondary)',
  fontFamily: "'HitmarkerText', monospace",
  fontSize: '12px',
  opacity: 0.55,
}

const LIST: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  // Keep the feed from spilling past the viewport on the U tab.
  // 320px reserves room for top nav, leaderboard card, and bottom
  // padding so the section header + first rows stay visible.
  maxHeight: 'calc(100vh - 320px)',
  overflowY: 'auto',
}

export default function SocialFeed({ events, currentUserId }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const capped = events.length > MAX_ENTRIES ? events.slice(0, MAX_ENTRIES) : events
  const diffed = useFeedDiff(capped, anchorRef)

  return (
    <div className="glass-card" style={{ padding: '16px', overflow: 'visible' }}>
      <h3 className="section-header" style={HEADER}>Activity Feed</h3>
      {diffed.length === 0 ? (
        <div style={EMPTY}>No activity yet. Listen to something.</div>
      ) : (
        <div ref={anchorRef} style={LIST}>
          {diffed.map((event, i) => (
            <FeedRow
              key={event.id}
              event={event}
              currentUserId={currentUserId}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId(prev => prev === event.id ? null : event.id)}
              isNew={event.isNew}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  )
}
