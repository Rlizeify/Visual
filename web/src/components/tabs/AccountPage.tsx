import { useState, useEffect, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { isAuthenticated as isSpotifyAuthenticated } from '../../services/spotify/tokens'
import { initiateSpotifyLogin } from '../../services/spotify/auth'
import '../MHEUShell.css'

interface ProfileData {
  username: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

interface OAuthConnection {
  provider: string
  connected_at: string
}

const SERVICES = [
  { key: 'spotify', name: 'Spotify', icon: '🎵', color: '#1DB954' },
  { key: 'discord', name: 'Discord', icon: '💬', color: '#5865F2' },
  { key: 'mynetdiary', name: 'MyNet Diary', icon: '🥗', color: '#4CAF50' },
  { key: 'apple', name: 'Apple Health', icon: '🍎', color: '#FF2D55' },
] as const

export default function AccountPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [connections, setConnections] = useState<OAuthConnection[]>([])
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const loadProfile = async () => {
      setLoading(true)

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, created_at')
        .eq('id', user.id)
        .maybeSingle()

      if (profileData) {
        setProfile(profileData)
        setNewUsername(profileData.username || '')
      }

      // Load OAuth connections
      const { data: connData } = await supabase
        .from('oauth_connections')
        .select('provider, created_at')
        .eq('user_id', user.id)

      if (connData) {
        setConnections(connData.map(c => ({ provider: c.provider, connected_at: c.created_at })))
      }

      setLoading(false)
    }

    loadProfile()
  }, [user])

  const validateUsername = (u: string): string | null => {
    if (u.length < 3) return 'Username must be at least 3 characters'
    if (u.length > 20) return 'Username must be at most 20 characters'
    if (!/^[a-z0-9_]+$/.test(u)) return 'Lowercase letters, numbers, and underscores only'
    return null
  }

  const handleSaveUsername = async () => {
    const error = validateUsername(newUsername)
    if (error) {
      setUsernameError(error)
      return
    }

    setSaving(true)
    setUsernameError(null)

    // Check uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', newUsername)
      .neq('id', user!.id)
      .maybeSingle()

    if (existing) {
      setUsernameError('Username already taken')
      setSaving(false)
      return
    }

    // Save
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', user!.id)

    if (updateError) {
      setUsernameError(updateError.message)
    } else {
      setProfile(prev => prev ? { ...prev, username: newUsername } : null)
      setEditingUsername(false)
    }
    setSaving(false)
  }

  const isConnected = (service: string) => {
    if (service === 'spotify') return isSpotifyAuthenticated()
    return connections.some(c => c.provider === service)
  }

  const handleConnect = (service: string) => {
    if (service === 'spotify') {
      initiateSpotifyLogin()
    } else if (service === 'discord') {
      window.location.href = '/api/oauth/discord'
    } else if (service === 'mynetdiary') {
      window.location.href = '/api/oauth/mynetdiary'
    }
    // Apple Health cannot connect on web
  }

  const handleDisconnect = async (service: string) => {
    if (service === 'spotify') {
      // Clear local Spotify tokens
      localStorage.removeItem('spotify_access_token')
      localStorage.removeItem('spotify_refresh_token')
      localStorage.removeItem('spotify_token_expiry')
    }

    // Remove from database
    await supabase
      .from('oauth_connections')
      .delete()
      .eq('user_id', user!.id)
      .eq('provider', service)

    setConnections(prev => prev.filter(c => c.provider !== service))
  }

  const containerStyle: CSSProperties = {
    padding: 'clamp(16px, 4vw, 32px)',
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(0, 20, 30, 0.8)',
    border: '1px solid rgba(0, 220, 200, 0.3)',
    borderRadius: '6px',
    color: '#00dcc8',
    fontFamily: "'HitmarkerText', monospace",
    fontSize: '14px',
  }

  if (loading) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ color: 'rgba(180, 240, 235, 0.6)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#00dcc8',
          fontFamily: "'HitmarkerText', monospace",
          marginBottom: '8px',
        }}>
          Account
        </h1>
      </header>

      {/* Profile Card */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(0, 220, 200, 0.1)',
          border: '2px solid rgba(0, 220, 200, 0.3)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: 'rgba(0, 220, 200, 0.4)',
            }}>
              👤
            </div>
          )}
        </div>

        {/* Profile Details */}
        <div style={{ flex: 1 }}>
          {/* Username */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'rgba(180, 240, 235, 0.6)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              Username
            </label>
            {editingUsername ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  style={inputStyle}
                />
                <button className="aero-button" onClick={handleSaveUsername} disabled={saving} style={{ padding: '8px 16px' }}>
                  {saving ? '...' : 'Save'}
                </button>
                <button className="aero-button" onClick={() => { setEditingUsername(false); setNewUsername(profile?.username || '') }} style={{ padding: '8px 16px', opacity: 0.7 }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: '#00dcc8', fontSize: '16px', fontFamily: "'HitmarkerText', monospace" }}>
                  @{profile?.username || 'not set'}
                </span>
                <button className="aero-button" onClick={() => setEditingUsername(true)} style={{ padding: '4px 12px', fontSize: '11px' }}>
                  Edit
                </button>
              </div>
            )}
            {usernameError && (
              <div style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '6px' }}>{usernameError}</div>
            )}
          </div>

          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'rgba(180, 240, 235, 0.6)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              Email
            </label>
            <span style={{ color: 'rgba(180, 240, 235, 0.8)', fontSize: '14px' }}>
              {user?.email || 'Not available'}
            </span>
          </div>

          {/* Dates */}
          <div style={{ display: 'flex', gap: '32px' }}>
            <div>
              <label style={{
                display: 'block',
                color: 'rgba(180, 240, 235, 0.6)',
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>
                Member Since
              </label>
              <span style={{ color: 'rgba(180, 240, 235, 0.8)', fontSize: '13px' }}>
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
            <div>
              <label style={{
                display: 'block',
                color: 'rgba(180, 240, 235, 0.6)',
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>
                Last Login
              </label>
              <span style={{ color: 'rgba(180, 240, 235, 0.8)', fontSize: '13px' }}>
                {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Services */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 className="section-header">Connected Services</h3>
        {SERVICES.map(service => {
          const connected = isConnected(service.key)
          const isApple = service.key === 'apple'

          return (
            <div key={service.key} className="connection-row">
              <div className="connection-source">
                <div
                  className="connection-icon"
                  style={{ background: `${service.color}20`, color: service.color }}
                >
                  {service.icon}
                </div>
                <span style={{ color: '#00dcc8', fontSize: '14px' }}>{service.name}</span>
                {connected && (
                  <span style={{ color: '#4ade80', fontSize: '11px', marginLeft: '8px' }}>Connected</span>
                )}
              </div>
              {isApple ? (
                <button className="aero-button" disabled style={{ padding: '6px 14px', fontSize: '12px', opacity: 0.5 }} title="Apple Health requires the iOS app">
                  iOS Only
                </button>
              ) : connected ? (
                <button className="aero-button" onClick={() => handleDisconnect(service.key)} style={{ padding: '6px 14px', fontSize: '12px' }}>
                  Disconnect
                </button>
              ) : (
                <button className="aero-button" onClick={() => handleConnect(service.key)} style={{ padding: '6px 14px', fontSize: '12px' }}>
                  Connect
                </button>
              )}
            </div>
          )
        })}

        {/* Apple Health note */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(255, 45, 85, 0.1)',
          border: '1px solid rgba(255, 45, 85, 0.2)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'rgba(255, 45, 85, 0.8)',
        }}>
          {/* TODO: Apple Health requires native iOS + HealthKit integration. Not available on web. */}
          Apple Health requires the iOS app. Web integration is not available.
        </div>
      </div>
    </div>
  )
}
