import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { initiateSpotifyLogin } from '../../../services/spotify/auth'
import { isAuthenticated as isSpotifyAuthenticated, getAccessToken as getSpotifyAccessToken } from '../../../services/spotify/tokens'
import type { FeedEventInput } from '../../../features/feed/eventCopy'
import { useFeedDiff } from '../../../features/feed/useFeedDiff'
import AsianVibrantSocialFeedRow from './SocialFeedRow'
import { Hanko } from './BrushIcons'

type TimeScale = 'day' | 'week' | 'month'

const TIME_SCALE_LABELS: Record<TimeScale, string> = { day: 'Day', week: 'Week', month: 'Month' }
const TIME_SCALE_GLYPH: Record<TimeScale, string> = { day: '日', week: '週', month: '月' }
const STORAGE_KEY_TIME_SCALE = 'mheu_time_scale'
const LEADERBOARD_PAGE_SIZE = 10
const RECOMPUTE_COOLDOWN_MS = 60_000
const MAX_FEED = 200

interface ScoreEntry {
  user_id?: string
  spotify_user_id: string
  display_name: string
  score: number
  position?: number | null
  listening_minutes: number
  top_genre: string | null
  updated_at: string
  computed_at?: string | null
  prestige_tier?: number
  avatar_url?: string | null
  accent_color?: string | null
}

interface UserScores {
  position: number | null
  velocity: number | null
  acceleration: number | null
  jerk: number | null
  snap: number | null
  prestigeTier?: number
  isPrestige?: boolean
  last_updated: string | null
}

const SCORE_LABELS: Record<string, string> = {
  position: 'Position',
  velocity: 'Velocity',
  acceleration: 'Acceleration',
  jerk: 'Jerk',
  snap: 'Snap',
}
const SCORE_KANJI: Record<string, string> = {
  position: '位',
  velocity: '速',
  acceleration: '加',
  jerk: '衝',
  snap: '撃',
}

/**
 * Asian Vibrant UTab — leaderboard, score readouts, and social feed.
 *
 * Same data fetching and 30s polling as Frutiger Aero's
 * UserCompetitionTab. Visuals re-skinned: paper cards with deckled
 * edges, calligraphic section headers, gold underlines, hanko stamps
 * for the time-scale selector and prestige indicators. Feed rows are
 * rendered through the Asian Vibrant SocialFeedRow.
 */
export default function AsianVibrantUTab() {
  const { session } = useAuth()
  const isAuthenticated = !!session
  const spotifyConnected = isSpotifyAuthenticated()
  const lastRecomputeRef = useRef<number>(0)
  const lastStaleSweepRef = useRef<number>(0)

  const [timeScale, setTimeScale] = useState<TimeScale>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_TIME_SCALE)
      if (stored && ['day', 'week', 'month'].includes(stored)) return stored as TimeScale
    }
    return 'week'
  })

  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([])
  const [leaderboardPage, setLeaderboardPage] = useState(0)
  const [userScores, setUserScores] = useState<UserScores | null>(null)
  const [tooltips, setTooltips] = useState<Record<string, string>>({})
  const [feedEvents, setFeedEvents] = useState<FeedEventInput[]>([])
  const [expandedFeedId, setExpandedFeedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const feedAnchorRef = useRef<HTMLDivElement>(null)

  const triggerRecompute = useCallback(async () => {
    if (!session?.access_token) return
    const now = Date.now()
    if (now - lastRecomputeRef.current < RECOMPUTE_COOLDOWN_MS) return
    lastRecomputeRef.current = now
    try {
      const spotifyToken = getSpotifyAccessToken()
      await fetch('/api/scores?action=recompute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(spotifyToken ? { spotifyAccessToken: spotifyToken } : {}),
      })
    } catch { /* swallow */ }
  }, [session])

  const triggerStaleSweep = useCallback(async (rows: ScoreEntry[]) => {
    if (!session?.access_token) return
    const now = Date.now()
    if (now - lastStaleSweepRef.current < RECOMPUTE_COOLDOWN_MS) return
    const stale = rows
      .filter(r => r.user_id && (!r.computed_at || (now - new Date(r.computed_at).getTime()) > 5 * 60_000))
      .map(r => r.user_id!) as string[]
    if (stale.length === 0) return
    lastStaleSweepRef.current = now
    try {
      await fetch('/api/scores?action=recompute-stale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_ids: stale.slice(0, 25) }),
      })
    } catch { /* swallow */ }
  }, [session])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const leaderboardRes = await fetch('/api/scores')
      let leaderboardRows: ScoreEntry[] = []
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        leaderboardRows = data.scores || []
        setLeaderboard(leaderboardRows)
      }
      if (session?.access_token) {
        const scoresRes = await fetch(`/api/scores?action=user-scores&timeScale=${timeScale}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (scoresRes.ok) {
          const data = await scoresRes.json()
          setUserScores(data.scores || null)
          setTooltips(data.tooltips || {})
        }
      }
      const feedRes = await fetch('/api/scores?action=events', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (feedRes.ok) {
        const data = await feedRes.json()
        setFeedEvents(data.events || [])
      }
      if (leaderboardRows.length > 0) triggerStaleSweep(leaderboardRows)
      setError(null)
    } catch (e) {
      console.warn('[av-utab] fetch failed:', (e as Error).message)
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, timeScale, triggerStaleSweep])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startInterval = useCallback(() => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(fetchData, 30000)
  }, [fetchData])
  const stopInterval = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  useEffect(() => { localStorage.setItem(STORAGE_KEY_TIME_SCALE, timeScale) }, [timeScale])

  useEffect(() => {
    triggerRecompute()
    fetchData()
    startInterval()
    const handleVisibilityChange = () => {
      if (document.hidden) { stopInterval() }
      else { triggerRecompute(); fetchData(); startInterval() }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchData, startInterval, stopInterval, triggerRecompute])

  useEffect(() => {
    const handleFocus = () => {
      if (!document.hidden) { triggerRecompute(); fetchData() }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData, triggerRecompute])

  const handleSpotifyConnect = () => {
    if (!spotifyConnected) initiateSpotifyLogin()
  }

  const formatZScore = (value: number | null): string => {
    if (value === null || value === undefined) return '—'
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}`
  }

  const cappedEvents = feedEvents.length > MAX_FEED ? feedEvents.slice(0, MAX_FEED) : feedEvents
  const diffedFeed = useFeedDiff(cappedEvents, feedAnchorRef)

  // ---- styles ---------------------------------------------------------

  const containerStyle: CSSProperties = {
    padding: 'clamp(16px, 4vw, 32px)',
    maxWidth: '1100px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    paddingTop: '24px',
    color: 'var(--av-ink)',
    fontFamily: 'var(--av-font-body)',
  }

  const sectionTitleStyle: CSSProperties = {
    fontFamily: "'Ma Shan Zheng', serif",
    color: 'var(--av-crimson-deep)',
    fontSize: '20px',
    letterSpacing: '0.08em',
    margin: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 80px)',
        padding: '24px',
      }}>
        <div className="av-paper-card" style={{
          padding: '48px 56px',
          textAlign: 'center',
          maxWidth: '460px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <span style={{
            fontFamily: "'Ma Shan Zheng', serif",
            fontSize: '54px',
            color: 'var(--av-crimson-deep)',
            lineHeight: 1,
          }}>
            競
          </span>
          <h2 style={{ ...sectionTitleStyle, fontSize: '24px' }}>Sign in to compete</h2>
          <p style={{ color: 'var(--av-ink-soft)', fontSize: '14px', lineHeight: 1.6 }}>
            Connect Spotify to begin tracking your Life Score.
          </p>
          <button
            onClick={handleSpotifyConnect}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              background: 'var(--av-crimson)',
              color: 'var(--av-paper)',
              border: '1px solid var(--av-gold)',
              borderRadius: '3px',
              fontFamily: "'Ma Shan Zheng', serif",
              fontSize: '14px',
              letterSpacing: '0.12em',
              cursor: 'pointer',
            }}
          >
            Connect with Spotify
          </button>
        </div>
      </div>
    )
  }

  const leaderboardStart = leaderboardPage * LEADERBOARD_PAGE_SIZE
  const paginatedLeaderboard = leaderboard.slice(leaderboardStart, leaderboardStart + LEADERBOARD_PAGE_SIZE)
  const totalLeaderboardPages = Math.max(1, Math.ceil(leaderboard.length / LEADERBOARD_PAGE_SIZE))

  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '4px' }}>
        <h1 style={{
          fontFamily: "'Ma Shan Zheng', serif",
          fontSize: '34px',
          color: 'var(--av-crimson-deep)',
          letterSpacing: '0.1em',
          margin: 0,
        }}>
          競 — User Competition
        </h1>
        <p style={{
          fontSize: '13px',
          color: 'var(--av-ink-soft)',
          marginTop: '6px',
        }}>
          Compete with friends based on your listening activity
        </p>
      </header>

      {/* Leaderboard */}
      <div className="av-paper-card" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={sectionTitleStyle}>
            <Hanko glyph="榜" size={24} />
            Leaderboard
          </h3>
          {totalLeaderboardPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setLeaderboardPage(p => Math.max(0, p - 1))}
                disabled={leaderboardPage === 0}
                style={pagerBtnStyle(leaderboardPage === 0)}
              >←</button>
              <span style={{ color: 'var(--av-ink-soft)', fontSize: '11px', minWidth: '36px', textAlign: 'center' }}>
                {leaderboardPage + 1}/{totalLeaderboardPages}
              </span>
              <button
                onClick={() => setLeaderboardPage(p => Math.min(totalLeaderboardPages - 1, p + 1))}
                disabled={leaderboardPage >= totalLeaderboardPages - 1}
                style={pagerBtnStyle(leaderboardPage >= totalLeaderboardPages - 1)}
              >→</button>
            </div>
          )}
        </div>

        {loading ? (
          <div style={emptyStyle}>Loading…</div>
        ) : error ? (
          <div style={{ ...emptyStyle, color: 'var(--av-vermillion)' }}>Failed to load</div>
        ) : leaderboard.length === 0 ? (
          <div style={emptyStyle}>No users yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '48px' }}>#</th>
                <th style={thStyle}>User</th>
                <th style={{ ...thStyle, width: '90px', textAlign: 'right' }}>Score</th>
                <th style={{ ...thStyle, width: '90px', textAlign: 'right' }}>Minutes</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeaderboard.map((row, i) => {
                const initial = (row.display_name || '?')[0].toUpperCase()
                const avatarBorder = row.accent_color || 'var(--av-gold-deep)'
                const rank = leaderboardStart + i + 1
                return (
                  <tr key={row.user_id || row.spotify_user_id} style={{ borderTop: '1px solid var(--av-gold-faint)' }}>
                    <td style={{ ...tdStyle, color: 'var(--av-crimson)', fontWeight: 600 }}>{rank}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          border: `1.5px solid ${avatarBorder}`,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--av-paper-soft)',
                          flexShrink: 0,
                        }}>
                          {row.avatar_url ? (
                            <img src={row.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '11px', color: avatarBorder, fontWeight: 700 }}>{initial}</span>
                          )}
                        </div>
                        <span style={{ color: 'var(--av-ink)', fontWeight: 500 }}>{row.display_name}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--av-crimson-deep)', fontWeight: 600 }}>
                      {row.score}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{row.listening_minutes}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Score readouts */}
      <div className="av-paper-card" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          {(['day', 'week', 'month'] as TimeScale[]).map(scale => {
            const active = timeScale === scale
            return (
              <button
                key={scale}
                onClick={() => setTimeScale(scale)}
                style={{
                  background: active ? 'var(--av-crimson)' : 'transparent',
                  border: `1px solid ${active ? 'var(--av-gold)' : 'var(--av-ink-soft)'}`,
                  borderRadius: '3px',
                  padding: '6px 18px',
                  color: active ? 'var(--av-paper)' : 'var(--av-ink)',
                  fontFamily: "'Ma Shan Zheng', serif",
                  fontSize: '14px',
                  letterSpacing: '0.10em',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '15px' }}>{TIME_SCALE_GLYPH[scale]}</span>
                {TIME_SCALE_LABELS[scale]}
              </button>
            )
          })}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '10px',
        }}>
          {(['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const).map(scoreType => {
            const value = userScores?.[scoreType]
            const tooltip = tooltips[scoreType]
            const isPosition = scoreType === 'position'
            const displayValue = isPosition
              ? (value !== null && value !== undefined ? value : '—')
              : formatZScore(value ?? null)
            const prestigeTier = userScores?.prestigeTier ?? 0
            const prestigeGlow = isPosition && prestigeTier > 0
              ? {
                boxShadow: `0 0 ${10 + prestigeTier * 6}px rgba(201,162,39,${0.2 + prestigeTier * 0.15}), inset 0 0 0 1px var(--av-gold)`,
                borderColor: 'var(--av-gold)',
              }
              : {}
            return (
              <div
                key={scoreType}
                style={{
                  padding: '14px 10px',
                  textAlign: 'center',
                  background: 'var(--av-paper-soft)',
                  border: '1px solid var(--av-gold-faint)',
                  borderRadius: '4px',
                  position: 'relative',
                  ...prestigeGlow,
                }}
              >
                <div style={{ position: 'absolute', top: '6px', right: '8px', opacity: 0.5, fontFamily: "'Ma Shan Zheng', serif", fontSize: '14px', color: 'var(--av-crimson-deep)' }}>
                  {SCORE_KANJI[scoreType]}
                </div>
                <div style={{
                  fontSize: '26px',
                  fontFamily: "'Ma Shan Zheng', serif",
                  color: 'var(--av-ink)',
                  lineHeight: 1.1,
                  marginBottom: '4px',
                }}>
                  {displayValue}
                </div>
                <div style={{
                  fontSize: '10px',
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  color: 'var(--av-ink-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}>
                  {SCORE_LABELS[scoreType]}
                  {tooltip && (
                    <span
                      title={tooltip}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        border: '1px solid var(--av-ink-soft)',
                        fontSize: '9px',
                        color: 'var(--av-ink-soft)',
                        cursor: 'help',
                      }}
                    >i</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Activity Feed — rendered with Asian Vibrant SocialFeedRow */}
      <div className="av-paper-card" style={{ padding: '18px 22px' }}>
        <h3 style={{ ...sectionTitleStyle, marginBottom: '12px' }}>
          <Hanko glyph="記" size={24} />
          Activity Feed
        </h3>
        {diffedFeed.length === 0 ? (
          <div style={emptyStyle}>No activity yet. Listen to something.</div>
        ) : (
          <div ref={feedAnchorRef} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {diffedFeed.map((event, i) => (
              <AsianVibrantSocialFeedRow
                key={event.id}
                event={event}
                currentUserId={session?.user?.id ?? null}
                expanded={expandedFeedId === event.id}
                onToggle={() => setExpandedFeedId(prev => prev === event.id ? null : event.id)}
                isNew={event.isNew}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const pagerBtnStyle = (disabled: boolean): CSSProperties => ({
  background: 'transparent',
  border: '1px solid var(--av-ink-soft)',
  color: disabled ? 'var(--av-gold-faint)' : 'var(--av-ink)',
  padding: '4px 10px',
  fontSize: '12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  borderRadius: '3px',
})

const emptyStyle: CSSProperties = {
  textAlign: 'center',
  padding: '24px 16px',
  color: 'var(--av-ink-soft)',
  fontSize: '13px',
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 6px',
  fontFamily: "'Ma Shan Zheng', serif",
  fontSize: '13px',
  letterSpacing: '0.08em',
  color: 'var(--av-crimson-deep)',
  fontWeight: 400,
  borderBottom: '1px solid var(--av-gold-deep)',
}

const tdStyle: CSSProperties = {
  padding: '10px 6px',
  fontSize: '13px',
  color: 'var(--av-ink)',
}
