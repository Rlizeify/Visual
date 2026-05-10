import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { initiateSpotifyLogin } from '../../services/spotify/auth'
import { isAuthenticated as isSpotifyAuthenticated, getAccessToken as getSpotifyAccessToken } from '../../services/spotify/tokens'
import '../MHEUShell.css'

type TimeScale = 'day' | 'week' | 'month'

const TIME_SCALE_LABELS: Record<TimeScale, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
}

const STORAGE_KEY_TIME_SCALE = 'mheu_time_scale'

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

interface FeedEvent {
  id: string
  username: string
  score_type: string
  delta: number
  direction: 'up' | 'down' | 'same'
  source_action: string | null
  created_at: string
}

const SCORE_LABELS: Record<string, string> = {
  position: 'Position',
  velocity: 'Velocity',
  acceleration: 'Acceleration',
  jerk: 'Jerk',
  snap: 'Snap',
}

const SCORE_SYMBOLS: Record<string, string> = {
  position: 'x',
  velocity: 'v',
  acceleration: 'a',
  jerk: 'j',
  snap: 's',
}

export default function UserCompetitionTab() {
  const { session } = useAuth()
  const isAuthenticated = !!session
  const spotifyConnected = isSpotifyAuthenticated()
  const lastRecomputeRef = useRef<number>(0)
  const lastStaleSweepRef = useRef<number>(0)

  // Load time scale from localStorage, default to 'week'
  const [timeScale, setTimeScale] = useState<TimeScale>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_TIME_SCALE)
      if (stored && ['day', 'week', 'month'].includes(stored)) {
        return stored as TimeScale
      }
    }
    return 'week'
  })

  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([])
  const [leaderboardPage, setLeaderboardPage] = useState(0)
  const [userScores, setUserScores] = useState<UserScores | null>(null)
  const [tooltips, setTooltips] = useState<Record<string, string>>({})
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const LEADERBOARD_PAGE_SIZE = 10
  const FEED_MAX_ENTRIES = 200
  const RECOMPUTE_COOLDOWN_MS = 60_000  // client-side throttle; server enforces 5-min lock

  // Fire-and-forget: ask the server to recompute this user's score (with Spotify sync)
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
    } catch {
      /* swallow — leaderboard refresh will retry implicitly on next visibility */
    }
  }, [session])

  // Find users on the leaderboard whose computed_at is >5min old and ask server to refresh them
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
    } catch {
      /* swallow */
    }
  }, [session])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch leaderboard
      const leaderboardRes = await fetch('/api/scores')
      let leaderboardRows: ScoreEntry[] = []
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        leaderboardRows = data.scores || []
        setLeaderboard(leaderboardRows)
      }

      // Fetch user scores if authenticated
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

      // Fetch feed events
      const feedRes = await fetch('/api/scores?action=events', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      if (feedRes.ok) {
        const data = await feedRes.json()
        setFeedEvents(data.events || [])
      }

      // Leaderboard self-heal: ask server to recompute stale users
      if (leaderboardRows.length > 0) triggerStaleSweep(leaderboardRows)

      setError(null)
    } catch (e) {
      console.warn('[competition] fetch failed:', (e as Error).message)
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, timeScale, triggerStaleSweep])

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start the 30s auto-refresh interval
  const startInterval = useCallback(() => {
    if (intervalRef.current) return // Already running
    intervalRef.current = setInterval(fetchData, 30000)
  }, [fetchData])

  // Stop the interval
  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])


  // Persist time scale to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TIME_SCALE, timeScale)
  }, [timeScale])

  // Initial fetch and interval setup with visibility handling.
  // Also fires `triggerRecompute` on every visibility/focus event so the
  // user's score advances in real time without relying on the daily cron.
  useEffect(() => {
    triggerRecompute()
    fetchData()
    startInterval()

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval()
      } else {
        triggerRecompute()
        fetchData()
        startInterval()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchData, startInterval, stopInterval, triggerRecompute])

  useEffect(() => {
    const handleFocus = () => {
      if (!document.hidden) {
        triggerRecompute()
        fetchData()
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData, triggerRecompute])

  const handleSpotifyConnect = () => {
    if (!spotifyConnected) {
      initiateSpotifyLogin()
    }
  }

  const formatDelta = (delta: number) => {
    if (delta > 0) return `+${delta}`
    return String(delta)
  }

  // Format derivative z-scores with sign and 2 decimals
  const formatZScore = (value: number | null): string => {
    if (value === null || value === undefined) return '—'
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}`
  }

  // Get prestige glow style for position card
  const getPrestigeStyle = (tier: number): CSSProperties => {
    switch (tier) {
      case 1: // 100-149: subtle teal glow
        return {
          boxShadow: '0 0 12px rgba(0, 220, 200, 0.3), inset 0 0 8px rgba(0, 220, 200, 0.1)',
          borderColor: 'rgba(0, 220, 200, 0.5)',
        }
      case 2: // 150-179: stronger teal/cyan glow
        return {
          boxShadow: '0 0 20px rgba(0, 220, 200, 0.5), 0 0 40px rgba(0, 220, 200, 0.2)',
          borderColor: 'rgba(0, 220, 200, 0.7)',
        }
      case 3: // 180+: strongest glow with pulse
        return {
          boxShadow: '0 0 30px rgba(0, 220, 200, 0.7), 0 0 60px rgba(0, 220, 200, 0.3)',
          borderColor: 'rgba(0, 220, 200, 0.9)',
          animation: 'prestigePulse 2s ease-in-out infinite',
        }
      default:
        return {}
    }
  }

  const handleTimeScaleChange = (newScale: TimeScale) => {
    setTimeScale(newScale)
  }

  const formatTimeAgo = (isoDate: string) => {
    const diff = Date.now() - new Date(isoDate).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const containerStyle: CSSProperties = {
    padding: 'clamp(16px, 4vw, 32px)',
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    // No internal scroll - let page scroll naturally
    overflow: 'visible',
  }

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 56px)',
        padding: '24px',
      }}>
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-color)', marginBottom: '16px', fontFamily: "'HitmarkerText', monospace" }}>
            Sign in to compete
          </h2>
          <p style={{ color: 'rgba(180, 240, 235, 0.7)', marginBottom: '24px' }}>
            Connect your accounts to track your Life Score
          </p>
          <button className="aero-button" onClick={handleSpotifyConnect}>
            Connect with Spotify
          </button>
        </div>
      </div>
    )
  }

  // Calculate paginated leaderboard
  const leaderboardStart = leaderboardPage * LEADERBOARD_PAGE_SIZE
  const leaderboardEnd = leaderboardStart + LEADERBOARD_PAGE_SIZE
  const paginatedLeaderboard = leaderboard.slice(leaderboardStart, leaderboardEnd)
  const totalLeaderboardPages = Math.ceil(leaderboard.length / LEADERBOARD_PAGE_SIZE)

  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '4px' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--accent-color)',
          fontFamily: "'HitmarkerText', monospace",
          marginBottom: '4px',
        }}>
          User Competition
        </h1>
        <p style={{
          fontSize: '12px',
          color: 'var(--color-secondary)',
          fontFamily: "'HitmarkerText', monospace",
        }}>
          Compete with friends based on your listening activity
        </p>
      </header>

      {/* Leaderboard - fixed height, no internal scroll, pagination */}
      <div className="glass-card" style={{ padding: '16px', overflow: 'visible' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 className="section-header" style={{ marginBottom: 0, fontSize: '12px' }}>Leaderboard</h3>
          {totalLeaderboardPages > 1 && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setLeaderboardPage(p => Math.max(0, p - 1))}
                disabled={leaderboardPage === 0}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--accent-color-border)',
                  color: leaderboardPage === 0 ? 'rgba(180, 240, 235, 0.3)' : 'var(--accent-color)',
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: leaderboardPage === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                ←
              </button>
              <span style={{ color: 'var(--color-secondary)', fontSize: '10px' }}>
                {leaderboardPage + 1}/{totalLeaderboardPages}
              </span>
              <button
                onClick={() => setLeaderboardPage(p => Math.min(totalLeaderboardPages - 1, p + 1))}
                disabled={leaderboardPage >= totalLeaderboardPages - 1}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--accent-color-border)',
                  color: leaderboardPage >= totalLeaderboardPages - 1 ? 'rgba(180, 240, 235, 0.3)' : 'var(--accent-color)',
                  padding: '4px 8px',
                  fontSize: '10px',
                  cursor: leaderboardPage >= totalLeaderboardPages - 1 ? 'not-allowed' : 'pointer',
                }}
              >
                →
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-secondary)' }}>
            Loading...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255, 100, 100, 0.8)' }}>
            Failed to load
          </div>
        ) : leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-secondary)' }}>
            No users yet
          </div>
        ) : (
          <table className="leaderboard-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>User</th>
                <th style={{ width: '80px' }}>Score</th>
                <th style={{ width: '80px' }}>Minutes</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeaderboard.map((row, i) => {
                const initial = (row.display_name || '?')[0].toUpperCase()
                const avatarBorder = row.accent_color || 'var(--accent-color)'
                return (
                  <tr key={row.user_id || row.spotify_user_id}>
                    <td style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{leaderboardStart + i + 1}</td>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: `1.5px solid ${avatarBorder}`,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 20, 30, 0.6)',
                          flexShrink: 0,
                        }}>
                          {row.avatar_url ? (
                            <img src={row.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '11px', color: avatarBorder, fontWeight: 600 }}>{initial}</span>
                          )}
                        </div>
                        <span>{row.display_name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--accent-color)' }}>{row.score}</td>
                    <td>{row.listening_minutes}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Score Card with Time Scale + Derivatives */}
      <div className="glass-card" style={{ padding: '16px' }}>
        {/* Time Scale Selector */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}>
          {(['day', 'week', 'month'] as TimeScale[]).map(scale => (
            <button
              key={scale}
              onClick={() => handleTimeScaleChange(scale)}
              style={{
                background: timeScale === scale
                  ? 'var(--accent-color-bg)'
                  : 'transparent',
                border: `1px solid ${timeScale === scale ? 'var(--accent-color-dim)' : 'var(--accent-color-border)'}`,
                borderRadius: '6px',
                padding: '6px 16px',
                color: timeScale === scale ? 'var(--accent-color)' : 'var(--color-secondary)',
                fontFamily: "'HitmarkerText', monospace",
                fontSize: '11px',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {TIME_SCALE_LABELS[scale]}
            </button>
          ))}
        </div>

        {/* Five Score Readouts */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px',
          marginBottom: '12px',
        }}>
          {(['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const).map(scoreType => {
            const value = userScores?.[scoreType]
            const tooltip = tooltips[scoreType]
            const isPosition = scoreType === 'position'
            const prestigeTier = userScores?.prestigeTier ?? 0
            const prestigeStyle = isPosition ? getPrestigeStyle(prestigeTier) : {}

            // Format value: position as number, derivatives as z-scores
            const displayValue = isPosition
              ? (value !== null && value !== undefined ? value : '—')
              : formatZScore(value ?? null)

            return (
              <div
                key={scoreType}
                className="stat-card"
                style={{
                  padding: '12px',
                  position: 'relative',
                  ...prestigeStyle,
                }}
              >
                <div className="stat-value" style={{ fontSize: '24px' }}>
                  {displayValue}
                </div>
                <div className="stat-label" style={{ fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {SCORE_LABELS[scoreType]} ({SCORE_SYMBOLS[scoreType]})
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
                        border: '1px solid rgba(180, 240, 235, 0.4)',
                        fontSize: '9px',
                        color: 'var(--color-secondary)',
                        cursor: 'help',
                      }}
                    >
                      i
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
    </div>
  )
}
