import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { applyAccentColor } from '../../../lib/accentColor'
import { clearAuth as clearSpotifyAuth, disconnectSpotify } from '../../../services/spotify/tokens'
import { hasTokens as hasSpotifyTokens } from '../../../services/spotify/tokenStore'
import { useTheme } from '../../ThemeContext'
import { Hanko } from './BrushIcons'

/**
 * ProfileDropdown — Asian Vibrant edition (rebuild).
 *
 * Unrolled paper scroll panel (.av-scroll-panel). Rolled gradient
 * edges at top + bottom. Ink-line dividers (.av-ink-divider) between
 * sections.
 *
 * Section labels are Latin in small caps (.av-label) — kanji glyph
 * usage in this panel is limited to ONE: the active-theme hanko
 * stamp on the theme switcher. Everything else gets a clean Latin
 * label.
 *
 * Audit B2 fix: parallel Supabase fetches use Promise.allSettled,
 * not Promise.all. A single failed query no longer blanks the panel.
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

export default function AsianVibrantProfileDropdown({ open, onClose, anchorRect }: Props) {
  const { user } = useAuth()
  const { theme, setTheme, available } = useTheme()

  const [profile, setProfile] = useState<{ username: string | null; display_name: string | null; avatar_url: string | null; accent_color: string | null } | null>(null)
  const [palette, setPalette] = useState<PalettePreset[]>(FALLBACK_PALETTE)
  const [allowCustomHex, setAllowCustomHex] = useState(true)
  const [accentColor, setAccentColor] = useState('#8B1A1A')
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
      // Audit B2: allSettled — one failed channel doesn't blank the panel.
      const results = await Promise.allSettled([
        supabase.from('profiles').select('username, display_name, avatar_url, accent_color').eq('id', user.id).maybeSingle(),
        supabase.from('accent_color_palette').select('id, hex, label').eq('active', true).order('sort_order'),
        supabase.from('app_settings').select('value').eq('key', 'allow_custom_hex').maybeSingle(),
        supabase.from('user_score_visibility').select('score_type, reveal_action').eq('user_id', user.id),
      ])
      if (cancelled) return

      if (results[0].status === 'fulfilled') {
        const data = results[0].value.data
        if (data) {
          setProfile(data as typeof profile)
          setAccentColor(data.accent_color || '#8B1A1A')
        }
      }
      if (results[1].status === 'fulfilled') {
        const data = results[1].value.data
        if (data && data.length > 0) setPalette(data as PalettePreset[])
      }
      if (results[2].status === 'fulfilled') {
        const data = results[2].value.data
        if (data) setAllowCustomHex((data as { value: unknown }).value !== false)
      }
      if (results[3].status === 'fulfilled') {
        const data = results[3].value.data as VisibilityRow[] | null
        const vis: Record<string, boolean> = {}
        data?.forEach(row => { vis[row.score_type] = row.reveal_action })
        setVisibility(vis)
      }
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
    const { error } = await supabase.from('profiles').update({ accent_color: hex }).eq('id', user.id)
    if (!error) setProfile(p => p ? { ...p, accent_color: hex } : p)
  }

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setAvatarError('Only JPG, PNG, or WebP'); return }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Max 2MB'); return }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = pub.publicUrl
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
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
    const { error } = await supabase.from('user_score_visibility').upsert({ user_id: user.id, score_type, reveal_action: next }, { onConflict: 'user_id,score_type' })
    if (error) {
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
      }
    : {
        position: 'fixed',
        top: '64px',
        left: `${desktopLeft}px`,
        width: '380px',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
        zIndex: 1100,
        borderRadius: '6px',
      }

  const usernameInitial = (profile?.username || profile?.display_name || user?.email || '?')[0].toUpperCase()
  const displayUsername = profile?.username
    ? `@${profile.username}`
    : profile?.display_name || user?.email || 'Account'

  return (
    <div
      ref={panelRef}
      className="av-scroll-panel"
      style={{
        ...panelStyle,
        padding: '32px 26px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      {/* Header — avatar + username (Latin, no kanji budget spent). */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'var(--av-paper-soft)',
          border: '2px solid var(--av-gold)',
          boxShadow: '0 0 0 1px var(--av-gold-deep)',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '26px', color: 'var(--av-crimson-deep)', fontFamily: "'Ma Shan Zheng', serif" }}>
              {usernameInitial}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: 'var(--av-ink)',
            fontSize: '17px',
            fontFamily: 'var(--av-font-body)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
          }}>
            {displayUsername}
          </div>
          {user?.email && (
            <div style={{
              color: 'var(--av-ink-soft)',
              fontFamily: 'var(--av-font-body)',
              fontSize: '12px',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {user.email}
            </div>
          )}
        </div>
      </div>

      <div className="av-ink-divider" />

      {/* Avatar upload */}
      <div>
        <label className="av-label">Portrait</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatar}
          style={{ display: 'none' }}
        />
        <button
          className="av-brush-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
        >
          {avatarUploading ? 'Uploading…' : 'Choose image'}
        </button>
        {avatarError && (
          <div style={{ color: 'var(--av-vermillion)', fontSize: '12px', marginTop: '8px', fontFamily: 'var(--av-font-body)' }}>
            {avatarError}
          </div>
        )}
      </div>

      <div className="av-ink-divider" />

      {/* Accent color */}
      <div>
        <label className="av-label">Accent</label>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {palette.map(preset => {
            const active = accentColor.toLowerCase() === preset.hex.toLowerCase()
            return (
              <button
                key={preset.id}
                onClick={() => handleAccent(preset.hex)}
                title={preset.label}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: preset.hex,
                  border: active ? '2px solid var(--av-gold)' : '1px solid var(--av-ink-wash)',
                  cursor: 'pointer',
                  transition: 'transform 150ms ease, box-shadow 150ms ease',
                  padding: 0,
                  boxShadow: active ? `0 0 0 1px var(--av-gold-deep), 0 0 8px ${preset.hex}` : '0 1px 0 rgba(26,20,16,0.18)',
                  transform: active ? 'scale(1.08)' : 'none',
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
                width: '28px',
                height: '28px',
                border: '1px solid var(--av-ink-wash)',
                borderRadius: '50%',
                cursor: 'pointer',
                background: 'transparent',
                marginLeft: '4px',
                padding: 0,
              }}
              title="Custom color"
            />
          )}
        </div>
      </div>

      <div className="av-ink-divider" />

      {/* Reveal action toggles */}
      <div>
        <label className="av-label">Show source on your events</label>
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
                  padding: '8px 12px',
                  background: on ? 'var(--av-crimson-soft)' : 'transparent',
                  border: on ? '1px solid var(--av-crimson)' : '1px solid var(--av-gold-faint)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: 'var(--av-ink)',
                  fontFamily: 'var(--av-font-body)',
                  fontSize: '13px',
                  transition: 'background 180ms ease, border-color 180ms ease',
                }}
              >
                <span>{SCORE_LABELS[type]}</span>
                <span style={{
                  fontFamily: 'var(--av-font-body)',
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  color: on ? 'var(--av-crimson-deep)' : 'var(--av-ink-soft)',
                  fontWeight: 600,
                }}>
                  {on ? 'SHOWN' : 'HIDDEN'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="av-ink-divider" />

      {/* Theme switcher — only place a kanji glyph appears in this panel
          (active marker). Hanko spends the panel's single kanji budget. */}
      <div>
        <label className="av-label">Theme</label>
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
                  padding: '12px 14px',
                  background: active ? 'var(--av-paper-soft)' : 'transparent',
                  border: active ? '1.5px solid var(--av-crimson)' : '1px solid var(--av-gold-faint)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: 'var(--av-ink)',
                  fontFamily: 'var(--av-font-body)',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{
                  fontFamily: 'var(--av-font-body)',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  letterSpacing: '0.02em',
                }}>
                  {t.name}
                  {active && <Hanko glyph="今" size={20} variant="rough" />}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: 'var(--av-ink-soft)',
                  fontFamily: 'var(--av-font-body)',
                  lineHeight: 1.4,
                }}>
                  {t.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="av-ink-divider" />

      {/* Spotify link control */}
      <div>
        <label className="av-label">Spotify</label>
        <button
          className="av-brush-button"
          onClick={handleDisconnectSpotify}
          disabled={!spotifyLinked || disconnecting}
          style={{ opacity: spotifyLinked ? 1 : 0.5 }}
        >
          {disconnecting ? 'Disconnecting…' : spotifyLinked ? 'Disconnect Spotify' : 'Spotify not connected'}
        </button>
      </div>

      <div className="av-ink-divider" />

      <button
        className="av-brush-button av-brush-button--ghost"
        onClick={handleSignOut}
        style={{ marginTop: '4px' }}
      >
        Sign out
      </button>
    </div>
  )
}
