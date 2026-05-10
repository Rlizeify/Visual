import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { isAuthenticated as isSpotifyAuthenticated } from '../../services/spotify/tokens'
import { initiateSpotifyLogin } from '../../services/spotify/auth'
import { applyAccentColor } from '../../lib/accentColor'
import '../MHEUShell.css'

interface ProfileData {
  username: string | null
  display_name: string | null
  avatar_url: string | null
  accent_color: string | null
  created_at: string
}

interface PalettePreset {
  id: string
  hex: string
  label: string
}

interface OAuthConnection {
  service: string
  connected: boolean
  connected_at: string | null
}

const SERVICES = [
  { key: 'spotify', name: 'Spotify', icon: 'S', color: '#1DB954' },
  { key: 'discord', name: 'Discord', icon: 'D', color: '#5865F2' },
  { key: 'mynetdiary', name: 'MyNet Diary', icon: 'M', color: '#4CAF50' },
  { key: 'apple', name: 'Apple Health', icon: 'A', color: '#FF2D55' },
] as const

const FALLBACK_PRESETS: PalettePreset[] = [
  { id: 'cyan',   hex: '#00dcc8', label: 'Cyan' },
  { id: 'purple', hex: '#a855f7', label: 'Purple' },
  { id: 'pink',   hex: '#ec4899', label: 'Pink' },
  { id: 'orange', hex: '#f97316', label: 'Orange' },
  { id: 'green',  hex: '#22c55e', label: 'Green' },
  { id: 'blue',   hex: '#3b82f6', label: 'Blue' },
  { id: 'red',    hex: '#ef4444', label: 'Red' },
  { id: 'yellow', hex: '#eab308', label: 'Yellow' },
]

export default function AccountPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [connections, setConnections] = useState<OAuthConnection[]>([])
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [accentColor, setAccentColor] = useState('#00dcc8')
  const [savingColor, setSavingColor] = useState(false)
  const [palette, setPalette] = useState<PalettePreset[]>(FALLBACK_PRESETS)
  const [allowCustomHex, setAllowCustomHex] = useState(true)
  const [showMNDModal, setShowMNDModal] = useState(false)
  const [mndApiKey, setMndApiKey] = useState('')
  const [mndError, setMndError] = useState<string | null>(null)
  const [mndSubmitting, setMndSubmitting] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Reload connections after returning from OAuth round-trip
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('discord_connected') || params.has('mynetdiary_connected')) {
      window.history.replaceState({}, '', window.location.pathname)
      refreshConnections()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user) return

    const loadProfile = async () => {
      setLoading(true)

      const [{ data: profileData }, { data: paletteData }, { data: settingsData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, display_name, avatar_url, accent_color, created_at')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('accent_color_palette')
          .select('id, hex, label')
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'allow_custom_hex')
          .maybeSingle(),
      ])

      if (profileData) {
        setProfile(profileData)
        setNewUsername(profileData.username || '')
        const hex = profileData.accent_color || '#00dcc8'
        setAccentColor(hex)
        applyAccentColor(hex)
      }

      if (paletteData && paletteData.length > 0) {
        setPalette(paletteData as PalettePreset[])
      }

      if (settingsData) {
        const value = (settingsData as { value: unknown }).value
        setAllowCustomHex(value !== false)
      }

      await refreshConnections()
      setLoading(false)
    }

    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const refreshConnections = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/oauth?action=connections', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setConnections(data.connections || [])
      }
    } catch {
      /* network error — leave existing state */
    }
  }

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

  const isConnected = (service: string): boolean => {
    if (service === 'spotify') {
      // Spotify is connected if either (a) local tokens exist or (b) server has tokens
      return isSpotifyAuthenticated() || connections.find(c => c.service === 'spotify')?.connected === true
    }
    return connections.find(c => c.service === service)?.connected === true
  }

  const handleConnect = (service: string) => {
    if (service === 'spotify') {
      initiateSpotifyLogin()
    } else if (service === 'discord') {
      // Pass current session token in state so callback can persist on the right user
      supabase.auth.getSession().then(({ data: { session } }) => {
        const token = session?.access_token || ''
        window.location.href = `/api/oauth?provider=discord&session=${encodeURIComponent(token)}`
      })
    } else if (service === 'mynetdiary') {
      setMndApiKey('')
      setMndError(null)
      setShowMNDModal(true)
    }
  }

  const handleDisconnect = async (service: string) => {
    if (service === 'spotify') {
      localStorage.removeItem('spotify_access_token')
      localStorage.removeItem('spotify_refresh_token')
      localStorage.removeItem('spotify_token_expiry')
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(`/api/oauth?action=disconnect&provider=${encodeURIComponent(service)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch {
      /* swallow — still reflect locally */
    }

    setConnections(prev => prev.map(c => c.service === service ? { ...c, connected: false, connected_at: null } : c))
  }

  const handleMNDSubmit = async () => {
    if (!mndApiKey.trim()) {
      setMndError('API key required')
      return
    }
    setMndSubmitting(true)
    setMndError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setMndError('Not signed in')
        setMndSubmitting(false)
        return
      }
      const res = await fetch('/api/oauth?provider=mynetdiary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ api_key: mndApiKey.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMndError(data.error || 'Failed to validate key')
        setMndSubmitting(false)
        return
      }
      setShowMNDModal(false)
      await refreshConnections()
    } catch (e) {
      setMndError(e instanceof Error ? e.message : 'Network error')
    }
    setMndSubmitting(false)
  }

  const handleAccentColorChange = async (color: string) => {
    setAccentColor(color)
    applyAccentColor(color)
    setSavingColor(true)

    const { error } = await supabase
      .from('profiles')
      .update({ accent_color: color })
      .eq('id', user!.id)

    if (!error) {
      setProfile(prev => prev ? { ...prev, accent_color: color } : null)
    }
    setSavingColor(false)
  }

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setAvatarError(null)

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Only JPG, PNG, or WebP')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Max 2MB')
      return
    }

    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = pub.publicUrl

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id)
      if (updErr) throw updErr

      setProfile(prev => prev ? { ...prev, avatar_url: url } : null)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
    }
    setAvatarUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
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
    border: '1px solid var(--accent-color-border)',
    borderRadius: '6px',
    color: 'var(--accent-color)',
    fontFamily: "'HitmarkerText', monospace",
    fontSize: '14px',
  }

  if (loading) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ color: 'var(--color-secondary)' }}>Loading...</div>
      </div>
    )
  }

  const usernameInitial = (profile?.username || profile?.display_name || user?.email || '?')[0].toUpperCase()

  return (
    <div style={containerStyle}>
      <header style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--accent-color)',
          fontFamily: "'HitmarkerText', monospace",
          marginBottom: '8px',
        }}>
          Account
        </h1>
      </header>

      {/* Profile Card */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--accent-color-bg)',
            border: '2px solid var(--accent-color-border)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{
                fontSize: '32px',
                fontWeight: 600,
                color: 'var(--accent-color)',
                fontFamily: "'HitmarkerText', monospace",
              }}>
                {usernameInitial}
              </span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarSelect}
            style={{ display: 'none' }}
          />
          <button
            className="aero-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            style={{ padding: '4px 10px', fontSize: '10px' }}
          >
            {avatarUploading ? '...' : 'Upload'}
          </button>
          {avatarError && (
            <div style={{ color: 'var(--color-error)', fontSize: '10px', textAlign: 'center' }}>{avatarError}</div>
          )}
        </div>

        {/* Profile Details */}
        <div style={{ flex: 1 }}>
          {/* Username */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'var(--color-secondary)',
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
                <span style={{ color: 'var(--accent-color)', fontSize: '16px', fontFamily: "'HitmarkerText', monospace" }}>
                  @{profile?.username || 'not set'}
                </span>
                <button className="aero-button" onClick={() => setEditingUsername(true)} style={{ padding: '4px 12px', fontSize: '11px' }}>
                  Edit
                </button>
              </div>
            )}
            {usernameError && (
              <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '6px' }}>{usernameError}</div>
            )}
          </div>

          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              color: 'var(--color-secondary)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              Email
            </label>
            <span style={{ color: 'var(--color-secondary)', fontSize: '14px' }}>
              {user?.email || 'Not available'}
            </span>
          </div>

          {/* Dates */}
          <div style={{ display: 'flex', gap: '32px' }}>
            <div>
              <label style={{
                display: 'block',
                color: 'var(--color-secondary)',
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>
                Member Since
              </label>
              <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
              </span>
            </div>
            <div>
              <label style={{
                display: 'block',
                color: 'var(--color-secondary)',
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>
                Last Login
              </label>
              <span style={{ color: 'var(--color-secondary)', fontSize: '13px' }}>
                {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>

          {/* Accent Color */}
          <div style={{ marginTop: '20px' }}>
            <label style={{
              display: 'block',
              color: 'var(--color-secondary)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Accent Color {savingColor && <span style={{ opacity: 0.5 }}>(saving...)</span>}
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {palette.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleAccentColorChange(preset.hex)}
                  title={preset.label}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: preset.hex,
                    border: accentColor === preset.hex ? '3px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: accentColor === preset.hex ? `0 0 12px ${preset.hex}` : 'none',
                  }}
                />
              ))}
              {allowCustomHex && (
                <div style={{ position: 'relative', marginLeft: '8px' }}>
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => handleAccentColorChange(e.target.value)}
                    style={{
                      width: '32px',
                      height: '32px',
                      border: 'none',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      background: 'transparent',
                    }}
                    title="Custom color"
                  />
                </div>
              )}
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
          const connectedAt = connections.find(c => c.service === service.key)?.connected_at

          return (
            <div key={service.key} className="connection-row">
              <div className="connection-source">
                <div
                  className="connection-icon"
                  style={{ background: `${service.color}20`, color: service.color }}
                >
                  {service.icon}
                </div>
                <span style={{ color: 'var(--accent-color)', fontSize: '14px' }}>{service.name}</span>
                {connected && (
                  <span style={{ color: '#4ade80', fontSize: '11px', marginLeft: '8px' }}>
                    Connected{connectedAt ? ` ${new Date(connectedAt).toLocaleDateString()}` : ''}
                  </span>
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

        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(255, 45, 85, 0.1)',
          border: '1px solid rgba(255, 45, 85, 0.2)',
          borderRadius: '8px',
          fontSize: '12px',
          color: 'rgba(255, 45, 85, 0.8)',
        }}>
          Apple Health requires the iOS app. Web integration is not available.
        </div>
      </div>

      {/* MyNet Diary modal */}
      {showMNDModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }} onClick={() => !mndSubmitting && setShowMNDModal(false)}>
          <div
            className="glass-card"
            style={{ padding: '24px', maxWidth: '420px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              color: 'var(--accent-color)',
              fontFamily: "'HitmarkerText', monospace",
              fontSize: '16px',
              marginBottom: '8px',
            }}>
              Connect MyNet Diary
            </h3>
            <p style={{ color: 'var(--color-secondary)', fontSize: '12px', marginBottom: '16px', lineHeight: 1.5 }}>
              Paste your MyNet Diary API key. We validate against the MyNet Diary API and store it encrypted.
            </p>
            <input
              type="password"
              value={mndApiKey}
              onChange={(e) => setMndApiKey(e.target.value)}
              placeholder="API key"
              autoFocus
              style={inputStyle}
            />
            {mndError && (
              <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '8px' }}>{mndError}</div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button
                className="aero-button"
                onClick={() => setShowMNDModal(false)}
                disabled={mndSubmitting}
                style={{ padding: '8px 16px', opacity: 0.7 }}
              >
                Cancel
              </button>
              <button
                className="aero-button"
                onClick={handleMNDSubmit}
                disabled={mndSubmitting || !mndApiKey.trim()}
                style={{ padding: '8px 16px' }}
              >
                {mndSubmitting ? 'Validating...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
