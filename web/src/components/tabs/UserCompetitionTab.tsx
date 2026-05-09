import { useEffect, useState, type CSSProperties } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../../context/AuthContext'
import { initiateSpotifyLogin } from '../../services/spotify/auth'
import { isAuthenticated as isSpotifyAuthenticated } from '../../services/spotify/tokens'
import { supabase } from '../../lib/supabase'
import '../MHEUShell.css'

interface LeaderboardEntry {
  user_id: string
  name: string
  position: number
  velocity: number
  acceleration: number
  jerk: number
  snap: number
}

const DERIVATIVES = [
  { key: 'position', label: 'Position', symbol: 'x' },
  { key: 'velocity', label: 'Velocity', symbol: 'v' },
  { key: 'acceleration', label: 'Acceleration', symbol: 'a' },
  { key: 'jerk', label: 'Jerk', symbol: 'j' },
  { key: 'snap', label: 'Snap', symbol: 's' },
] as const

const SOURCES = [
  { key: 'spotify', name: 'Spotify', icon: '🎵', color: '#1DB954', enabled: true },
  { key: 'discord', name: 'Discord', icon: '💬', color: '#5865F2', enabled: false },
  { key: 'mynetdiary', name: 'MyNetDiary', icon: '🥗', color: '#4CAF50', enabled: false },
  { key: 'apple', name: 'Apple Health', icon: '🍎', color: '#FF2D55', enabled: false },
] as const

const MOCK_LEADERBOARD = [
  { name: 'CB', position: 87, velocity: 12, acceleration: 3, jerk: 1, snap: 0.5 },
  { name: 'John', position: 72, velocity: 8, acceleration: -2, jerk: 0, snap: 0.1 },
  { name: 'Caden', position: 65, velocity: 15, acceleration: 5, jerk: 2, snap: 0.8 },
  { name: 'Jeffrey', position: 58, velocity: 6, acceleration: 1, jerk: -1, snap: 0.2 },
]

const MOCK_HISTORY = [
  { day: 'Mon', you: 45, cb: 50, john: 40, caden: 35, jeffrey: 30 },
  { day: 'Tue', you: 52, cb: 55, john: 42, caden: 40, jeffrey: 35 },
  { day: 'Wed', you: 58, cb: 60, john: 45, caden: 48, jeffrey: 40 },
  { day: 'Thu', you: 63, cb: 65, john: 50, caden: 55, jeffrey: 45 },
  { day: 'Fri', you: 70, cb: 72, john: 55, caden: 60, jeffrey: 50 },
  { day: 'Sat', you: 75, cb: 78, john: 60, caden: 62, jeffrey: 55 },
  { day: 'Sun', you: 82, cb: 87, john: 72, caden: 65, jeffrey: 58 },
]

export default function UserCompetitionTab() {
  const { session } = useAuth()
  const isAuthenticated = !!session
  const spotifyConnected = isSpotifyAuthenticated()

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null)
  const [usingMock, setUsingMock] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: cfg, error: cfgErr } = await supabase
          .from('leaderboard_config')
          .select('user_id, position, profiles(username, display_name)')
          .eq('visible', true)
          .order('position', { ascending: true })

        if (cfgErr || !cfg || cfg.length === 0) {
          if (!cancelled) {
            setLeaderboard(null)
            setUsingMock(true)
          }
          return
        }

        const userIds = cfg.map(c => c.user_id)
        const { data: derivs } = await supabase
          .from('life_score_derivatives')
          .select('user_id, position, velocity, acceleration, jerk, snap')
          .in('user_id', userIds)

        // life_score_derivatives is one row per (user_id, metric); aggregate
        // (sum) across metrics for the leaderboard's single-row-per-user view.
        const totals = new Map<string, { position: number; velocity: number; acceleration: number; jerk: number; snap: number }>()
        for (const d of derivs ?? []) {
          const t = totals.get(d.user_id) ?? { position: 0, velocity: 0, acceleration: 0, jerk: 0, snap: 0 }
          t.position += Number(d.position) || 0
          t.velocity += Number(d.velocity) || 0
          t.acceleration += Number(d.acceleration) || 0
          t.jerk += Number(d.jerk) || 0
          t.snap += Number(d.snap) || 0
          totals.set(d.user_id, t)
        }

        const entries: LeaderboardEntry[] = cfg.map(c => {
          const profile = c.profiles as { username?: string | null; display_name?: string | null } | null
          const t = totals.get(c.user_id) ?? { position: 0, velocity: 0, acceleration: 0, jerk: 0, snap: 0 }
          return {
            user_id: c.user_id,
            name: profile?.username ?? profile?.display_name ?? c.user_id.slice(0, 8),
            ...t,
          }
        })

        if (!cancelled) {
          setLeaderboard(entries)
          setUsingMock(false)
        }
      } catch (e) {
        // Anon read failed — RLS may not yet be applied, or other transient error.
        // Fall back to mock; the leaderboard panel still renders.
        // eslint-disable-next-line no-console
        console.warn('[leaderboard] fetch failed, using mock:', (e as Error).message)
        if (!cancelled) {
          setLeaderboard(null)
          setUsingMock(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const containerStyle: CSSProperties = {
    // clamp gives 16px padding at 360px viewport up to 32px at very wide,
    // so content never butts the edge and never gets too gutter-y.
    padding: 'clamp(16px, 4vw, 32px)',
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    marginBottom: '8px',
  }

  const handleSpotifyConnect = () => {
    if (!spotifyConnected) {
      initiateSpotifyLogin()
    }
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
      {/* Header */}
      <header style={headerStyle}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 600,
          color: '#00dcc8',
          fontFamily: "'HitmarkerText', monospace",
          marginBottom: '8px',
        }}>
          User Competition
        </h1>
        <p style={{
          fontSize: '14px',
          color: 'rgba(180, 240, 235, 0.6)',
          fontFamily: "'HitmarkerText', monospace",
        }}>
          Life Score: <span style={{ color: '#00dcc8' }}>pos</span> /
          <span style={{ color: '#00dcc8' }}> vel</span> /
          <span style={{ color: '#00dcc8' }}> acc</span> /
          <span style={{ color: '#00dcc8' }}> jerk</span> /
          <span style={{ color: '#00dcc8' }}> snap</span>
        </p>
      </header>

      {/* Score Panel — full width, auto-fit grid wraps cleanly from desktop down to phone */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 className="section-header">Your Score</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
        }}>
          {DERIVATIVES.map((d, i) => (
            <div key={d.key} className="stat-card">
              <div className="stat-value">
                {[82, 12, 3, 1, 0.5][i]}
              </div>
              <div className="stat-label">{d.label}</div>
              {/* Sparkline placeholder */}
              <div style={{
                height: '24px',
                marginTop: '8px',
                background: 'rgba(0, 220, 200, 0.1)',
                borderRadius: '4px',
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 className="section-header">Leaderboard</h3>
          {usingMock && (
            <span style={{ color: 'rgba(255, 181, 69, 0.85)', fontSize: 10, letterSpacing: '0.16em', fontFamily: "'HitmarkerText', monospace" }}>
              MOCK · admin not configured
            </span>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Friend</th>
                <th>Position</th>
                <th>Velocity</th>
                <th>Acceleration</th>
                <th>Jerk</th>
                <th>Snap</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(leaderboard ?? MOCK_LEADERBOARD).map((row, i) => {
                const rowTotal = row.position + row.velocity + row.acceleration + row.jerk + row.snap
                return (
                  <tr key={`${row.name}-${i}`}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>{row.position}</td>
                    <td>{row.velocity}</td>
                    <td>{row.acceleration}</td>
                    <td>{row.jerk}</td>
                    <td>{row.snap}</td>
                    <td style={{ color: '#00dcc8', fontWeight: 600 }}>{rowTotal.toFixed(1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Chart */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 className="section-header">Score History</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={MOCK_HISTORY} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 220, 200, 0.1)" />
              <XAxis
                dataKey="day"
                stroke="rgba(180, 240, 235, 0.5)"
                fontSize={12}
                fontFamily="'HitmarkerText', monospace"
              />
              <YAxis
                stroke="rgba(180, 240, 235, 0.5)"
                fontSize={12}
                fontFamily="'HitmarkerText', monospace"
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(0, 20, 30, 0.9)',
                  border: '1px solid rgba(0, 220, 200, 0.3)',
                  borderRadius: '8px',
                  fontFamily: "'HitmarkerText', monospace",
                }}
                labelStyle={{ color: '#00dcc8' }}
              />
              <Legend
                wrapperStyle={{ fontFamily: "'HitmarkerText', monospace", fontSize: '12px' }}
              />
              <Line type="monotone" dataKey="you" stroke="#00dcc8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cb" stroke="#FFD700" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="john" stroke="#FF6B6B" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="caden" stroke="#4ECDC4" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="jeffrey" stroke="#A855F7" strokeWidth={1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Connection Panel — moved to bottom; same .glass-card treatment as the rest */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 className="section-header">Connections</h3>
        {SOURCES.map(source => (
          <div key={source.key} className="connection-row">
            <div className="connection-source">
              <div
                className="connection-icon"
                style={{ background: `${source.color}20`, color: source.color }}
              >
                {source.icon}
              </div>
              <span style={{ color: '#00dcc8', fontSize: '14px' }}>{source.name}</span>
            </div>
            {source.enabled ? (
              <button
                className="aero-button"
                onClick={source.key === 'spotify' ? handleSpotifyConnect : undefined}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                {source.key === 'spotify' && spotifyConnected ? 'Connected' : 'Connect'}
              </button>
            ) : (
              <button
                className="aero-button"
                disabled
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                Coming soon
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
