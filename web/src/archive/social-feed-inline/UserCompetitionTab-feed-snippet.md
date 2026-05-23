# Archived: Inline social feed (UserCompetitionTab.tsx)

**Replaced by**: `web/src/features/feed/SocialFeed.tsx` and siblings
(`FeedRow`, `FeedRowDetail`, `FeedAvatar`, `MagnitudeBadge`,
`RelativeTimestamp`, `useFeedDiff`, `eventCopy`, `feed.css`).

**Replaced on**: 2026-05-23 (T4 — Redesign U-tab social feed)

**Why archived**: The inline block worked, but the spec required avatars,
slide-in animation on new arrivals, scroll preservation across the 30s
poll, deterministic verb pool, inline expand/collapse detail panel, and
per-event accent coloring (other users' accents, not the viewer's). Each
concern got its own file.

**Original location**: lines 564-607 of UserCompetitionTab.tsx
(immediately after the score-card block, before the closing container).

```tsx
{/* Social Feed - no internal scroll, extends page vertically, capped at 200 entries */}
<div className="glass-card" style={{ padding: '16px', overflow: 'visible' }}>
  <h3 className="section-header" style={{ marginBottom: '12px', fontSize: '12px' }}>Activity Feed</h3>
  {feedEvents.length === 0 ? (
    <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(180, 240, 235, 0.5)' }}>
      No activity yet
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {feedEvents.slice(0, FEED_MAX_ENTRIES).map(event => (
        <div
          key={event.id}
          style={{
            padding: '10px 12px',
            background: 'rgba(0, 20, 30, 0.4)',
            border: '1px solid var(--accent-color-bg)',
            borderRadius: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-color)', fontWeight: 600, fontSize: '13px' }}>
              @{event.username}
            </span>
            <span style={{ color: 'rgba(180, 240, 235, 0.7)', fontSize: '12px' }}>
              {event.direction === 'up' ? '↑' : event.direction === 'down' ? '↓' : '→'}
              {' '}{formatDelta(event.delta)} {event.score_type}
            </span>
            {event.source_action && (
              <span style={{ color: 'rgba(180, 240, 235, 0.4)', fontSize: '11px', fontStyle: 'italic' }}>
                ({event.source_action})
              </span>
            )}
          </div>
          <span style={{ color: 'rgba(180, 240, 235, 0.4)', fontSize: '11px' }}>
            {formatTimeAgo(event.created_at)}
          </span>
        </div>
      ))}
    </div>
  )}
</div>
```

Also archived: the `formatDelta`, `formatTimeAgo` helpers and the
`FEED_MAX_ENTRIES = 200` const were used only here; they're inlined into
the new modules (`eventCopy.ts`, `RelativeTimestamp.tsx`,
`SocialFeed.tsx`) and removed from UserCompetitionTab.
