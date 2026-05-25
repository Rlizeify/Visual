import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { applyAccentColor } from '../../../lib/accentColor'
import { clearAuth as clearSpotifyAuth, disconnectSpotify } from '../../../services/spotify/tokens'
import { hasTokens as hasSpotifyTokens } from '../../../services/spotify/tokenStore'
import { useTheme } from '../../ThemeContext'

/**
 * AC-130 Thermal — ProfileDropdown ("DEBRIEF" panel).
 *
 * Same data flow as the Frutiger Aero dropdown — reads / writes the
 * same Supabase columns, the same Spotify disconnect, the same theme
 * switcher — but rendered as a HUD frame: scan-lined black panel,
 * white phosphor wire borders, monospace caps, bracketed buttons.
 *
 * Supabase columns READ:
 *   - profiles.{username, display_name, avatar_url, accent_color}
 *   - accent_color_palette
 *   - app_settings.allow_custom_hex
 *   - user_score_visibility.{score_type, reveal_action}
 *
 * Supabase columns WRITTEN:
 *   - profiles.{avatar_url, accent_color}
 *   - user_score_visibility (upsert by user_id + score_type)
 *   - profiles.theme_id (via ThemeContext.setTheme)
 */

interface PalettePreset { id: string; hex: string; label: string }
interface VisibilityRow { score_type: string; reveal_action: boolean }

const SCORE_TYPES = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
const SCORE_LABELS: Record<typeof SCORE_TYPES[number], string> = {
  position: 'POS',
  velocity: 'VEL',
  acceleration: 'ACC',
  jerk: 'JRK',
  snap: 'SNP',
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

export default function AC130ThermalProfileDropdown({ open, onClose, anchorRect }: Props) {
  const { user } = useAuth()
  const { theme, setTheme, available } = useTheme()

  const [profile, setProfile] = useState<{ username: string | null; display_name: string | null; avatar_url: string | null; accent_color: string | null } | null>(null)
  const [palette, setPalette] = useState<PalettePreset[]>(FALLBACK_PALETTE)
  const [allowCustomHex, setAllowCustomHex] = useState(true)
  const [accentColor, setAccentColor] = useState('#FFFFFF')
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 600)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 600)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
        const hex = profileData.accent_color || '#FFFFFF'
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

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!panelRef.current) return
      if (!panelRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
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
      setVisibility(v => ({ ...v, [score_type]: !next }))
      console.warn('[ac130-profile-dropdown] visibility update failed:', error.message)
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
      }
    : {
        position: 'fixed',
        top: '64px',
        left: `${desktopLeft}px`,
        width: '380px',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        zIndex: 1100,
      }

  const sectionLabel: CSSProperties = {
    display: 'block',
    color: 'var(--ac-phosphor-dim)',
    fontSize: '9px',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    marginBottom: '8px',
    fontFamily: 'var(--ac-font-mono)',
  }

  const dividerStyle: CSSProperties = {
    height: '1px',
    background: 'var(--ac-frame-wire)',
    margin: '4px 0',
  }

  const usernameInitial = (profile?.username || profile?.display_name || user?.email || '?')[0].toUpperCase()
  const displayUsername = profile?.username
    ? `@${profile.username}`
    : profile?.display_name || user?.email || 'OPERATOR'

  return (
    <div
      ref={panelRef}
      className="ac-hud-frame ac-hud-frame--brackets"
      style={{ ...panelStyle, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}
    >
      {/* Header bracket label */}
      <div style={{
        fontFamily: 'var(--ac-font-mono)',
        fontSize: '10px',
        color: 'var(--ac-phosphor-dim)',
        letterSpacing: '0.30em',
        textTransform: 'uppercase',
        textAlign: 'center',
        borderBottom: '1px solid var(--ac-frame-wire)',
        paddingBottom: '8px',
        marginBottom: '-4px',
      }}>
        [ DEBRIEF / OPERATOR ]
      </div>

      {/* Header — avatar + username */}
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: 0,
          background: 'var(--ac-panel-dim)',
          border: `1px solid ${profile?.accent_color || 'var(--ac-phosphor)'}`,
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--ac-phosphor)',
              fontFamily: 'var(--ac-font-mono)',
              letterSpacing: '0.10em',
            }}>
              {usernameInitial}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: 'var(--ac-phosphor-bright)',
            fontSize: '13px',
            fontFamily: 'var(--ac-font-mono)',
            letterSpacing: '0.10em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textShadow: '0 0 6px rgba(255,255,255,0.40)',
          }}>
            {displayUsername.toUpperCase()}
          </div>
          {user?.email && (
            <div style={{
              color: 'var(--ac-phosphor-dim)',
              fontSize: '10px',
              marginTop: '4px',
              letterSpacing: '0.10em',
              fontFamily: 'var(--ac-font-mono)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.email}
            </div>
          )}
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Avatar upload */}
      <div>
        <label style={sectionLabel}>[ AVATAR ]</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatar}
          style={{ display: 'none' }}
        />
        <button
          className="ac-wire-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
        >
          {avatarUploading ? 'UPLOADING…' : '[ CHOOSE IMAGE ]'}
        </button>
        {avatarError && (
          <div style={{
            color: 'var(--ac-ir-red)',
            fontSize: '10px',
            marginTop: '6px',
            letterSpacing: '0.10em',
            fontFamily: 'var(--ac-font-mono)',
          }}>
            FAULT: {avatarError.toUpperCase()}
          </div>
        )}
      </div>

      <div style={dividerStyle} />

      {/* Accent color */}
      <div>
        <label style={sectionLabel}>[ ACCENT CHANNEL ]</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {palette.map(preset => {
            const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase()
            return (
              <button
                key={preset.id}
                onClick={() => handleAccent(preset.hex)}
                title={preset.label}
                style={{
                  width: '24px',
                  height: '24px',
                  background: preset.hex,
                  border: isSelected
                    ? '2px solid var(--ac-phosphor-bright)'
                    : '1px solid var(--ac-frame-wire)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  padding: 0,
                  borderRadius: 0,
                  boxShadow: isSelected ? `0 0 8px ${preset.hex}` : 'none',
                }}
              />
            )
          })}
          {allowCustomHex && (
            <input
              type="color"
              value={accentColor}
              onChange={(e) => handleAccent(e.target.value)}
              style={{
                width: '24px',
                height: '24px',
                border: '1px solid var(--ac-frame-wire)',
                borderRadius: 0,
                cursor: 'pointer',
                background: 'transparent',
                padding: 0,
                marginLeft: '4px',
              }}
              title="Custom"
            />
          )}
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Reveal action toggles */}
      <div>
        <label style={sectionLabel}>[ TARGET DATA REVEAL ]</label>
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
                  background: on ? 'var(--ac-phosphor-wash)' : 'transparent',
                  border: '1px solid var(--ac-frame-wire)',
                  borderRadius: 0,
                  cursor: 'pointer',
                  color: 'var(--ac-phosphor)',
                  fontFamily: 'var(--ac-font-mono)',
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                <span>[ {SCORE_LABELS[type]} ]</span>
                <span style={{
                  fontSize: '9px',
                  letterSpacing: '0.20em',
                  color: on ? 'var(--ac-phosphor-bright)' : 'var(--ac-amber)',
                }}>
                  {on ? 'VISIBLE' : 'MASKED'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Theme switcher */}
      <div>
        <label style={sectionLabel}>[ DISPLAY MODE ]</label>
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
                  padding: '8px 10px',
                  background: active ? 'var(--ac-phosphor-wash)' : 'transparent',
                  border: active
                    ? '1px solid var(--ac-phosphor)'
                    : '1px solid var(--ac-frame-wire)',
                  borderRadius: 0,
                  cursor: 'pointer',
                  color: 'var(--ac-phosphor)',
                  fontFamily: 'var(--ac-font-mono)',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{
                  fontSize: '11px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  {t.name}
                  {active && (
                    <span style={{
                      fontSize: '9px',
                      letterSpacing: '0.20em',
                      color: 'var(--ac-phosphor-bright)',
                      textShadow: '0 0 4px rgba(255,255,255,0.55)',
                    }}>
                      [ ACTIVE ]
                    </span>
                  )}
                </span>
                <span style={{
                  fontSize: '10px',
                  color: 'var(--ac-phosphor-dim)',
                  letterSpacing: '0.05em',
                  textTransform: 'none',
                }}>
                  {t.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Spotify */}
      <div>
        <label style={sectionLabel}>[ AUDIO UPLINK ]</label>
        <button
          className={`ac-wire-button${spotifyLinked ? ' ac-wire-button--amber' : ''}`}
          onClick={handleDisconnectSpotify}
          disabled={!spotifyLinked || disconnecting}
          style={{ width: '100%' }}
        >
          {disconnecting
            ? 'DISCONNECTING…'
            : spotifyLinked
              ? '[ SEVER SPOTIFY LINK ]'
              : '[ NO UPLINK ]'}
        </button>
      </div>

      <div style={dividerStyle} />

      {/* Sign out */}
      <button
        className="ac-wire-button ac-wire-button--danger"
        onClick={handleSignOut}
        style={{ width: '100%' }}
      >
        [ EJECT — SIGN OUT ]
      </button>
    </div>
  )
}
