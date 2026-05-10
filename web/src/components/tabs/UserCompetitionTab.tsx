import { useEffect, useState, useCallback, useRef, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { initiateSpotifyLogin } from '../../services/spotify/auth'
import { isAuthenticated as isSpotifyAuthenticated } from '../../services/spotify/tokens'
import '../MHEUShell.css'

type TimeScale = 'day' | 'week' | 'month'

const TIME_SCALE_LABELS: Record<TimeScale, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
}

const STORAGE_KEY_TIME_SCALE = 'mheu_time_scale'

interface ScoreEntry {
  spotify_user_id: string
  display_name: string
  score: number
  listening_minutes: number
  top_genre: string | null
  updated_at: string
  prestige_tier?: number
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

interface OAuthConnection {
  provider: string
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
  const { session, user } = useAuth()
  const isAuthenticated = !!session
  const spotifyConnected = isSpotifyAuthenticated()

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
  const [userScores, setUserScores] = useState<UserScores | null>(null)
  const [tooltips, setTooltips] = useState<Record<string, string>>({})
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [connections, setConnections] = useState<OAuthConnection[]>([])
  const [connectionsOpen, setConnectionsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recomputeTriggered, setRecomputeTriggered] = useState(false)

  // Trigger recompute once per session
  const triggerRecompute = useCallback(async () => {
    if (!session?.access_token || recomputeTriggered) return

    try {
      const res = await fetch('/api/scoring/recompute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      // 429 is expected if rate limited, don't treat as error
      if (res.ok || res.status === 429) {
        setRecomputeTriggered(true)
      }
    } catch (e) {
      console.warn('[competition] recompute failed:', e)
    }
  }, [session, recomputeTriggered])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch leaderboard
      const leaderboardRes = await fetch('/api/scores')
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        setLeaderboard(data.scores || [])
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

      // Fetch connections if authenticated
      if (user) {
        const { data: connData } = await supabase
          .from('oauth_connections')
          .select('provider')
          .eq('user_id', user.id)
        setConnections(connData || [])
      }

      setError(null)
    } catch (e) {
      console.warn('[competition] fetch failed:', (e as Error).message)
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [session, user, timeScale])

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

  // Trigger recompute on mount
  useEffect(() => {
    triggerRecompute()
  }, [triggerRecompute])

  // Persist time scale to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TIME_SCALE, timeScale)
  }, [timeScale])

  // Initial fetch and interval setup with visibility handling
  useEffect(() => {
    fetchData()
    startInterval()

    // Pause polling when tab is hidden, resume when visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopInterval()
      } else {
        fetchData() // Immediate fetch on return
        startInterval()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchData, startInterval, stopInterval])

  // Refresh on window focus (handles alt-tab, etc.)
  useEffect(() => {
    const handleFocus = () => {
      if (!document.hidden) fetchData()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData])

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
    // Ensure top block doesn't exceed half viewport on 1440px display
    maxHeight: 'calc(100vh - 56px)',
    overflow: 'auto',
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
          <h2 style={{ color: '#00dcc8', marginBottom: '16px', fontFamily: "'HitmarkerText', monospace" }}>
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

  return (
    <div style={containerStyle}>
      {/* Top block: Header + Leaderboard + Scores - max half viewport */}
      <div style={{ maxHeight: 'calc(50vh - 28px)', overflow: 'auto' }}>
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: '12px' }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#00dcc8',
            fontFamily: "'HitmarkerText', monospace",
            marginBottom: '4px',
          }}>
            User Competition
          </h1>
          <p style={{
            fontSize: '12px',
            color: 'rgba(180, 240, 235, 0.6)',
            fontFamily: "'HitmarkerText', monospace",
          }}>
            Compete with friends based on your listening activity
          </p>
        </header>

        {/* Leaderboard */}
        <div className="glass-card" style={{ padding: '16px', marginBottom: '12px' }}>
          <h3 className="section-header" style={{ marginBottom: '12px', fontSize: '12px' }}>Leaderboard</h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(180, 240, 235, 0.6)' }}>
              Loading...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255, 100, 100, 0.8)' }}>
              Failed to load
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(180, 240, 235, 0.6)' }}>
              No users yet
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Score</th>
                    <th>Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.slice(0, 5).map((row, i) => (
                    <tr key={row.spotify_user_id}>
                      <td style={{ color: '#00dcc8', fontWeight: 600 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{row.display_name}</td>
                      <td style={{ color: '#00dcc8' }}>{row.score}</td>
                      <td>{row.listening_minutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
                  ? 'rgba(0, 220, 200, 0.2)'
                  : 'transparent',
                border: `1px solid ${timeScale === scale ? 'rgba(0, 220, 200, 0.5)' : 'rgba(0, 220, 200, 0.2)'}`,
                borderRadius: '6px',
                padding: '6px 16px',
                color: timeScale === scale ? '#00dcc8' : 'rgba(180, 240, 235, 0.6)',
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
                        color: 'rgba(180, 240, 235, 0.6)',
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

      {/* Connections - Collapsible */}
      <div className="glass-card" style={{ padding: '0' }}>
        <button
          onClick={() => setConnectionsOpen(!connectionsOpen)}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'transparent',
            border: 'none',
            color: '#00dcc8',
            fontFamily: "'HitmarkerText', monospace",
            fontSize: '12px',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>CONNECTIONS</span>
          <span style={{ transform: connectionsOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
            ▼
          </span>
        </button>
        {connectionsOpen && (
          <div style={{ borderTop: '1px solid rgba(0, 220, 200, 0.2)' }}>
            {[
              { key: 'spotify', name: 'Spotify', icon: '🎵', color: '#1DB954' },
              { key: 'discord', name: 'Discord', icon: '💬', color: '#5865F2' },
              { key: 'mynetdiary', name: 'MyNet Diary', icon: '🥗', color: '#4CAF50' },
              { key: 'apple', name: 'Apple Health', icon: '🍎', color: '#FF2D55' },
            ].map(service => {
              const connected = service.key === 'spotify'
                ? spotifyConnected
                : connections.some(c => c.provider === service.key)

              return (
                <div key={service.key} className="connection-row">
                  <div className="connection-source">
                    <div className="connection-icon" style={{ background: `${service.color}20`, color: service.color }}>
                      {service.icon}
                    </div>
                    <span style={{ color: '#00dcc8', fontSize: '13px' }}>{service.name}</span>
                    {connected && <span style={{ color: '#4ade80', fontSize: '10px', marginLeft: '6px' }}>✓</span>}
                  </div>
                  {service.key === 'apple' ? (
                    <span style={{ color: 'rgba(180, 240, 235, 0.4)', fontSize: '11px' }}>iOS Only</span>
                  ) : connected ? (
                    <span style={{ color: 'rgba(180, 240, 235, 0.4)', fontSize: '11px' }}>Connected</span>
                  ) : (
                    <button
                      className="aero-button"
                      onClick={() => {
                        if (service.key === 'spotify') initiateSpotifyLogin()
                        else if (service.key === 'discord') window.location.href = '/api/oauth?provider=discord'
                      }}
                      style={{ padding: '4px 12px', fontSize: '10px' }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Social Feed */}
      <div className="glass-card" style={{ padding: '16px', flex: 1, minHeight: '200px', overflow: 'auto' }}>
        <h3 className="section-header" style={{ marginBottom: '12px', fontSize: '12px' }}>Activity Feed</h3>
        {feedEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'rgba(180, 240, 235, 0.5)' }}>
            No activity yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {feedEvents.map(event => (
              <div
                key={event.id}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(0, 20, 30, 0.4)',
                  border: '1px solid rgba(0, 220, 200, 0.15)',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#00dcc8', fontWeight: 600, fontSize: '13px' }}>
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
