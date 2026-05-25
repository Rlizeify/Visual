import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { useTheme } from '../../ThemeContext'

const tabs = [
  { key: 'm', label: 'M', path: '/m', title: 'Music' },
  { key: 'h', label: 'H', path: '/h', title: 'Health' },
  { key: 'e', label: 'E', path: '/e', title: 'Entertainment' },
  { key: 'u', label: 'U', path: '/u', title: 'User' },
] as const

type TabKey = typeof tabs[number]['key']

/**
 * AC-130 Thermal NavBar.
 *
 * Black bar across the top with the four MHEU tabs as bracketed
 * letters: [ M ] [ H ] [ E ] [ U ]. The active tab takes a green
 * frame + glow + the user's accent for its color (the one place
 * --user-accent shows up in the HUD chrome). Profile icon at
 * top-left is a monochrome wire glyph with the user's accent for
 * its border.
 *
 * Supabase reads — same slice as Frutiger Aero NavBar:
 *   - profiles.avatar_url
 *   - profiles.username (initial letter fallback)
 *   - profiles.accent_color (avatar border + active tab tint)
 */
export default function AC130ThermalNavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { theme } = useTheme()
  const ProfileDropdown = theme.components.ProfileDropdown

  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null; accent_color: string | null } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const iconRef = useRef<HTMLButtonElement | null>(null)

  const getCurrentTab = (): TabKey => {
    const tab = tabs.find(t => t.path === location.pathname)
    return tab?.key || 'm'
  }
  const activeTab = getCurrentTab()

  useEffect(() => {
    if (!user) { setProfile(null); return }
    let cancelled = false
    supabase
      .from('profiles')
      .select('username, avatar_url, accent_color')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        if (data) setProfile(data as typeof profile)
      })
    return () => { cancelled = true }
  }, [user?.id])

  const openDropdown = () => {
    if (iconRef.current) setAnchorRect(iconRef.current.getBoundingClientRect())
    setDropdownOpen(true)
  }

  const navStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    background: 'var(--ac-void)',
    backgroundImage: 'var(--ac-scanline-bg)',
    borderBottom: '1px solid var(--ac-frame-wire)',
    boxShadow: '0 1px 0 rgba(0,255,65,0.10), 0 8px 24px -16px rgba(0,255,65,0.20)',
    zIndex: 1000,
    fontFamily: 'var(--ac-font-mono)',
  }

  const accentBorder = profile?.accent_color || 'var(--ac-hud-green)'
  const initial = (profile?.username || user?.email || '?')[0].toUpperCase()

  const iconStyle: CSSProperties = {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '38px',
    height: '38px',
    borderRadius: 0,
    background: profile?.avatar_url ? 'transparent' : 'var(--ac-panel)',
    border: `1px solid ${accentBorder}`,
    overflow: 'hidden',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ac-hud-green)',
    fontFamily: 'var(--ac-font-mono)',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    boxShadow: dropdownOpen
      ? `0 0 0 1px ${accentBorder}, 0 0 12px ${accentBorder}66`
      : 'none',
    transition: 'box-shadow 150ms linear, border-color 150ms linear',
  }

  // Tab style: bracketed letter that takes the user's accent color
  // when active. When inactive, dim HUD green with no border.
  const tabStyle = (isActive: boolean): CSSProperties => {
    const accent = profile?.accent_color
    const activeColor = accent || 'var(--ac-hud-green-bright)'
    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '56px',
      padding: '8px 12px',
      background: isActive ? 'rgba(0,255,65,0.06)' : 'transparent',
      border: `1px solid ${isActive ? activeColor : 'transparent'}`,
      borderRadius: 0,
      color: isActive ? activeColor : 'var(--ac-hud-green-dim)',
      fontFamily: 'var(--ac-font-mono)',
      fontSize: '14px',
      fontWeight: 700,
      letterSpacing: '0.30em',
      cursor: 'pointer',
      transition: 'color 150ms linear, border-color 150ms linear, background 150ms linear',
      textShadow: isActive ? `0 0 8px ${activeColor}` : 'none',
    }
  }

  return (
    <>
      <nav style={navStyle}>
        {user && (
          <button
            ref={iconRef}
            onClick={openDropdown}
            style={iconStyle}
            title="Account"
            aria-label="Open account menu"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span>{initial}</span>
            )}
          </button>
        )}

        {tabs.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              style={tabStyle(isActive)}
              title={tab.title}
            >
              [&nbsp;{tab.label}&nbsp;]
            </button>
          )
        })}
      </nav>
      {user && (
        <ProfileDropdown
          open={dropdownOpen}
          onClose={() => setDropdownOpen(false)}
          anchorRect={anchorRect}
        />
      )}
    </>
  )
}

export { tabs }
export type { TabKey }
