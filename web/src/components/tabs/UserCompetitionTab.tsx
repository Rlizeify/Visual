import { useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { initiateSpotifyLogin } from '../../services/spotify/auth'
import { isAuthenticated as isSpotifyAuthenticated } from '../../services/spotify/tokens'
import '../MHEUShell.css'

interface ScoreEntry {
  spotify_user_id: string
  display_name: string
  score: number
  listening_minutes: number
  top_genre: string | null
  updated_at: string
}

const SOURCES = [
  { key: 'spotify', name: 'Spotify', icon: '🎵', color: '#1DB954', enabled: true },
  { key: 'discord', name: 'Discord', icon: '💬', color: '#5865F2', enabled: false },
  { key: 'mynetdiary', name: 'MyNetDiary', icon: '🥗', color: '#4CAF50', enabled: false },
  { key: 'apple', name: 'Apple Health', icon: '🍎', color: '#FF2D55', enabled: false },
] as const

export default function UserCompetitionTab() {
  const { session } = useAuth()
  const isAuthenticated = !!session
  const spotifyConnected = isSpotifyAuthenticated()

  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/scores')
        if (!res.ok) {
          throw new Error(`Failed to fetch scores: ${res.status}`)
        }
        const data = await res.json()
        if (!cancelled) {
          setScores(data.scores || [])
          setError(null)
        }
      } catch (e) {
        console.warn('[competition] fetch failed:', (e as Error).message)
        if (!cancelled) {
          setScores([])
          setError((e as Error).message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
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
          Compete with friends based on your listening activity
        </p>
      </header>

      {/* Leaderboard */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 className="section-header">Leaderboard</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(180, 240, 235, 0.6)' }}>
            Loading...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255, 100, 100, 0.8)' }}>
            Failed to load leaderboard
          </div>
        ) : scores.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(180, 240, 235, 0.6)' }}>
            No users yet — be the first to log in!
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
                  <th>Top Genre</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((row, i) => (
                  <tr key={row.spotify_user_id}>
                    <td style={{ color: '#00dcc8', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{row.display_name}</td>
                    <td style={{ color: '#00dcc8', fontWeight: 600 }}>{row.score}</td>
                    <td>{row.listening_minutes}</td>
                    <td>{row.top_genre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
