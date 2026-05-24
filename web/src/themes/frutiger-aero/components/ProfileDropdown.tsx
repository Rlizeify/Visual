import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { applyAccentColor } from '../../../lib/accentColor'
import { clearAuth as clearSpotifyAuth, disconnectSpotify } from '../../../services/spotify/tokens'
import { hasTokens as hasSpotifyTokens } from '../../../services/spotify/tokenStore'
import { useTheme } from '../../ThemeContext'
import '../../../components/MHEUShell.css'

/**
 * ProfileDropdown — anchored panel under the nav's profile icon.
 *
 * Supabase columns READ by this component:
 *   - profiles.avatar_url      (avatar circle)
 *   - profiles.username        (header + initial fallback)
 *   - profiles.display_name    (header fallback)
 *   - profiles.accent_color    (active state of accent picker)
 *   - profiles.theme_id        (via ThemeContext)
 *   - accent_color_palette     (preset list)
 *   - app_settings.allow_custom_hex (whether to show the hex picker)
 *   - user_score_visibility.reveal_action  (toggle state per score type)
 *
 * Supabase columns WRITTEN by this component:
 *   - profiles.avatar_url      (avatar upload → Supabase Storage `avatars` bucket)
 *   - profiles.accent_color    (palette button / custom hex)
 *   - profiles.theme_id        (via ThemeContext.setTheme)
 *   - user_score_visibility.{user_id, score_type, reveal_action}
 *     (upsert by composite (user_id, score_type))
 *
 * RLS note: `user_score_visibility` requires the self-update policy
 * added in migration 20260524000001_profiles_theme_id.sql to allow
 * users to manage their own reveal_action without the admin role.
 */

interface PalettePreset { id: string; hex: string; label: string }
interface VisibilityRow { score_type: string; reveal_action: boolean }

const SCORE_TYPES = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
const SCORE_LABELS: Record<typeof SCORE_TYPES[number], string> = {
  position: 'Position',
  velocity: 'Velocity',
  acceleration: 'Acceleration',
  jerk: 'Jerk',
  snap: 'Snap',
}

const FALLBACK_PALETTE: PalettePreset[] = [
  { id: 'cyan',   hex: '#00dcc8', label: 'Cyan' },
  { id: 'purple', hex: '#a855f7', label: 'Purple' },
  { id: 'pink',   hex: '#ec4899', label: 'Pink' },
  { id: 'orange', hex: '#f97316', label: 'Orange' },
  { id: 'green',  hex: '#22c55e', label: 'Green' },
  { id: 'blue',   hex: '#3b82f6', label: 'Blue' },
  { id: 'red',    hex: '#ef4444', label: 'Red' },
  { id: 'yellow', hex: '#eab308', label: 'Yellow' },
]

interface Props {
  open: boolean
  onClose: () => void
  anchorRect: DOMRect | null
}

export default function FrutigerAeroProfileDropdown({ open, onClose, anchorRect }: Props) {
  const { user } = useAuth()
  const { theme, setTheme, available } = useTheme()

  const [profile, setProfile] = useState<{ username: string | null; display_name: string | null; avatar_url: string | null; accent_color: string | null } | null>(null)
  const [palette, setPalette] = useState<PalettePreset[]>(FALLBACK_PALETTE)
  const [allowCustomHex, setAllowCustomHex] = useState(true)
  const [accentColor, setAccentColor] = useState('#00dcc8')
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 600)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Track viewport for mobile / desktop layout switch (375px target).
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 600)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Load profile + palette + visibility when opened (and when user changes).
  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    ;(async () => {
      const [{ data: profileData }, { data: paletteData }, { data: settingsData }, { data: visData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('username, display_name, avatar_url, accent_color')
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
        supabase
          .from('user_score_visibility')
          .select('score_type, reveal_action')
          .eq('user_id', user.id),
      ])
      if (cancelled) return
      if (profileData) {
        setProfile(profileData)
        const hex = profileData.accent_color || '#00dcc8'
        setAccentColor(hex)
      }
      if (paletteData && paletteData.length > 0) setPalette(paletteData as PalettePreset[])
      if (settingsData) setAllowCustomHex((settingsData as { value: unknown }).value !== false)
      const vis: Record<string, boolean> = {}
      ;(visData as VisibilityRow[] | null)?.forEach(row => { vis[row.score_type] = row.reveal_action })
      setVisibility(vis)
    })()
    return () => { cancelled = true }
  }, [open, user?.id])

  // Outside-click + Escape close.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!panelRef.current) return
      if (!panelRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    // Defer so the same click that opened the panel doesn't immediately close it.
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointer)
      window.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const handleAccent = async (hex: string) => {
    setAccentColor(hex)
    applyAccentColor(hex)
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ accent_color: hex })
      .eq('id', user.id)
    if (!error) setProfile(p => p ? { ...p, accent_color: hex } : p)
  }

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Only JPG, PNG, or WebP')
      return
    }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Max 2MB'); return }
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
      setProfile(p => p ? { ...p, avatar_url: url } : p)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed')
    }
    setAvatarUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleVisibilityToggle = async (score_type: string) => {
    if (!user) return
    const next = !visibility[score_type]
    setVisibility(v => ({ ...v, [score_type]: next }))
    const { error } = await supabase
      .from('user_score_visibility')
      .upsert({ user_id: user.id, score_type, reveal_action: next }, { onConflict: 'user_id,score_type' })
    if (error) {
      // Roll back UI on failure (typically RLS — see migration note).
      setVisibility(v => ({ ...v, [score_type]: !next }))
      console.warn('[profile-dropdown] visibility update failed:', error.message)
    }
  }

  const [disconnecting, setDisconnecting] = useState(false)
  const [spotifyLinked, setSpotifyLinked] = useState<boolean>(() => hasSpotifyTokens())
  useEffect(() => { if (open) setSpotifyLinked(hasSpotifyTokens()) }, [open])

  const handleSignOut = async () => {
    onClose()
    clearSpotifyAuth()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const handleDisconnectSpotify = async () => {
    setDisconnecting(true)
    await disconnectSpotify()
    setSpotifyLinked(false)
    setDisconnecting(false)
  }

  if (!open) return null

  // Position: anchored under the icon on desktop; full-width below nav on mobile.
  const desktopLeft = anchorRect ? Math.max(8, anchorRect.left) : 8
  const panelStyle: CSSProperties = isMobile
    ? {
        position: 'fixed',
        top: '56px',
        left: 0,
        right: 0,
        maxHeight: 'calc(100vh - 56px)',
        overflowY: 'auto',
        zIndex: 1100,
        borderRadius: 0,
        border: 'none',
        borderTop: '1px solid var(--accent-color-border)',
      }
    : {
        position: 'fixed',
        top: '64px',
        left: `${desktopLeft}px`,
        width: '360px',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        zIndex: 1100,
      }

  const sectionLabel: CSSProperties = {
    display: 'block',
    color: 'var(--color-secondary)',
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: '8px',
    fontFamily: "'HitmarkerText', monospace",
  }

  const usernameInitial = (profile?.username || profile?.display_name || user?.email || '?')[0].toUpperCase()
  const displayUsername = profile?.username
    ? `@${profile.username}`
    : profile?.display_name || user?.email || 'Account'

  return (
    <div ref={panelRef} className="glass-card" style={{ ...panelStyle, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--accent-color-bg)',
          border: '2px solid var(--accent-color-border)',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '22px', fontWeight: 600, color: 'var(--accent-color)', fontFamily: "'HitmarkerText', monospace" }}>
              {usernameInitial}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--accent-color)', fontSize: '15px', fontFamily: "'HitmarkerText', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayUsername}
          </div>
          {user?.email && (
            <div style={{ color: 'var(--color-secondary)', fontSize: '11px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </div>
          )}
        </div>
      </div>

      {/* Avatar upload */}
      <div>
        <label style={sectionLabel}>Avatar</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatar}
          style={{ display: 'none' }}
        />
        <button
          className="aero-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          style={{ padding: '6px 14px', fontSize: '12px' }}
        >
          {avatarUploading ? 'Uploading...' : 'Choose image'}
        </button>
        {avatarError && (
          <div style={{ color: 'var(--color-error)', fontSize: '11px', marginTop: '6px' }}>{avatarError}</div>
        )}
      </div>

      {/* Accent color */}
      <div>
        <label style={sectionLabel}>Accent color</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {palette.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleAccent(preset.hex)}
              title={preset.label}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: preset.hex,
                border: accentColor.toLowerCase() === preset.hex.toLowerCase()
                  ? '3px solid #fff'
                  : '2px solid rgba(255,255,255,0.18)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                padding: 0,
                boxShadow: accentColor.toLowerCase() === preset.hex.toLowerCase()
                  ? `0 0 10px ${preset.hex}`
                  : 'none',
              }}
            />
          ))}
          {allowCustomHex && (
            <input
              type="color"
              value={accentColor}
              onChange={(e) => handleAccent(e.target.value)}
              style={{
                width: '28px',
                height: '28px',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'transparent',
                marginLeft: '4px',
              }}
              title="Custom color"
            />
          )}
        </div>
      </div>

      {/* Reveal action toggles */}
      <div>
        <label style={sectionLabel}>Show source on your own events</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SCORE_TYPES.map(type => {
            const on = !!visibility[type]
            return (
              <button
                key={type}
                onClick={() => handleVisibilityToggle(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: on ? 'var(--accent-color-bg)' : 'transparent',
                  border: '1px solid var(--accent-color-border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--accent-color)',
                  fontFamily: "'HitmarkerText', monospace",
                  fontSize: '12px',
                }}
              >
                <span>{SCORE_LABELS[type]}</span>
                <span style={{
                  fontSize: '10px',
                  letterSpacing: '0.12em',
                  color: on ? 'var(--color-success)' : 'var(--color-secondary)',
                }}>
                  {on ? 'VISIBLE' : 'HIDDEN'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Theme switcher */}
      <div>
        <label style={sectionLabel}>Theme</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {available.map(t => {
            const active = t.id === theme.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  padding: '10px 12px',
                  background: active ? 'var(--accent-color-bg)' : 'transparent',
                  border: active
                    ? '1px solid var(--accent-color)'
                    : '1px solid var(--accent-color-border)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'var(--accent-color)',
                  fontFamily: "'HitmarkerText', monospace",
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {t.name}
                  {active && <span style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'var(--color-success)' }}>ACTIVE</span>}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>
                  {t.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Spotify link control */}
      <div>
        <label style={sectionLabel}>Spotify</label>
        <button
          className="aero-button"
          onClick={handleDisconnectSpotify}
          disabled={!spotifyLinked || disconnecting}
          style={{ padding: '8px 14px', fontSize: '12px', opacity: spotifyLinked ? 1 : 0.5 }}
        >
          {disconnecting ? 'Disconnecting…' : spotifyLinked ? 'Disconnect Spotify' : 'Spotify not connected'}
        </button>
      </div>

      {/* Sign out */}
      <button
        className="aero-button"
        onClick={handleSignOut}
        style={{ padding: '10px 14px', fontSize: '12px' }}
      >
        Sign out
      </button>
    </div>
  )
}
