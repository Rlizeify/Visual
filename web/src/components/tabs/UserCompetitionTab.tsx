import { useState, useEffect, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { initiateSpotifyLogin } from '../../services/spotify/auth'
import { isAuthenticated as isSpotifyAuthenticated } from '../../services/spotify/tokens'
import '../MHEUShell.css'

interface UserScore {
  spotify_user_id: string
  display_name: string
  score: number
  listening_minutes: number
  top_genre: string | null
  updated_at: string
}

const DERIVATIVES = [
  { key: 'position', label: 'Position', symbol: 'x' },
  { key: 'velocity', label: 'Velocity', symbol: 'v' },
  { key: 'acceleration', label: 'Acceleration', symbol: 'a' },
  { key: 'jerk', label: 'Jerk', symbol: 'j' },
  { key: 'snap', label: 'Snap', symbol: 's' },
] as const

const SOURCES = [
  { key: 'spotify', name: 'Spotify', icon: 'S', color: '#1DB954', enabled: true },
  { key: 'discord', name: 'Discord', icon: 'D', color: '#5865F2', enabled: false },
  { key: 'mynetdiary', name: 'MyNetDiary', icon: 'N', color: '#4CAF50', enabled: false },
  { key: 'apple', name: 'Apple Health', icon: 'A', color: '#FF2D55', enabled: false },
] as const

export default function UserCompetitionTab() {
  const { session } = useAuth()
  const isAuthenticated = !!session
  const spotifyConnected = isSpotifyAuthenticated()

  const [scores, setScores] = useState<UserScore[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchScores()
  }, [page])

  const fetchScores = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/scores?page=${page}`)
      if (res.ok) {
        const data = await res.json()
        setScores(data.scores || [])
        setTotalPages(data.totalPages || 1)
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: CSSProperties = {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const headerStyle: CSSProperties = {
    textAlign: 'center',
    marginBottom: '8px',
  }

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
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

      <div style={gridStyle}>
        {/* Connection Panel */}
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

        {/* Score Panel */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h3 className="section-header">Your Score</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px',
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
      </div>

      {/* Leaderboard */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 className="section-header">Leaderboard</h3>
        {loading ? (
          <div style={{ color: 'rgba(180, 240, 235, 0.6)', padding: '20px', textAlign: 'center' }}>
            Loading...
          </div>
        ) : scores.length === 0 ? (
          <div style={{
            color: 'rgba(180, 240, 235, 0.6)',
            padding: '40px 20px',
            textAlign: 'center',
            fontFamily: "'HitmarkerText', monospace",
          }}>
            No users yet — be the first to log in!
          </div>
        ) : (
          <>
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
                  {scores.map((user, idx) => (
                    <tr key={user.spotify_user_id}>
                      <td style={{ color: '#666' }}>{(page - 1) * 50 + idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{user.display_name}</td>
                      <td style={{ color: '#00dcc8', fontWeight: 600 }}>{user.score.toFixed(0)}</td>
                      <td>{user.listening_minutes.toFixed(0)}</td>
                      <td style={{ color: '#666' }}>{user.top_genre || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
                <button
                  className="aero-button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Prev
                </button>
                <span style={{ color: '#00dcc8', fontFamily: "'HitmarkerText', monospace", fontSize: '12px' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="aero-button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* History Chart - placeholder until we have historical data */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 className="section-header">Score History</h3>
        <div style={{
          width: '100%',
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(180, 240, 235, 0.4)',
          fontFamily: "'HitmarkerText', monospace",
          fontSize: '12px',
        }}>
          Historical score tracking coming soon
        </div>
      </div>
    </div>
  )
}
