import { useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useProfile } from '../../../context/ProfileContext'
import { useTheme } from '../../ThemeContext'

const tabs = [
  { key: 'm', label: 'M', path: '/m', title: 'Music' },
  { key: 'h', label: 'H', path: '/h', title: 'Health' },
  { key: 'e', label: 'E', path: '/e', title: 'Entertainment' },
  { key: 'u', label: 'U', path: '/u', title: 'User' },
] as const

type TabKey = typeof tabs[number]['key']

/**
 * NavBar for Frutiger Aero.
 *
 * Renders the four MHEU tab buttons centered, with a 36px circular
 * profile icon pinned top-left. Click the icon to open the
 * ProfileDropdown (the theme's own ProfileDropdown surface — pulled
 * from useTheme so a sibling theme can swap its UI without touching
 * this file).
 *
 * Supabase reads (lightweight, used only for the nav avatar):
 *   - profiles.avatar_url
 *   - profiles.username (initial letter fallback)
 *   - profiles.accent_color (border tint, falls back to --accent-color)
 */
export default function FrutigerAeroNavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { profile } = useProfile() // shared boot-cached row (U13)
  const { theme } = useTheme()
  const ProfileDropdown = theme.components.ProfileDropdown

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const iconRef = useRef<HTMLButtonElement | null>(null)

  const getCurrentTab = (): TabKey => {
    const tab = tabs.find(t => t.path === location.pathname)
    return tab?.key || 'm'
  }
  const activeTab = getCurrentTab()

  const handleTabClick = (path: string) => navigate(path)

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
    gap: '8px',
    background: 'var(--aero-nav-bg, linear-gradient(180deg, rgba(0,20,30,0.85) 0%, rgba(0,20,30,0.4) 100%))',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--accent-color-border)',
    zIndex: 1000,
    fontFamily: "'HitmarkerText', monospace",
  }

  const tabStyle = (isActive: boolean): CSSProperties => ({
    padding: '10px 24px',
    fontSize: '18px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: isActive ? 'var(--accent-color)' : 'var(--accent-color-dim)',
    background: isActive
      ? 'linear-gradient(180deg, var(--accent-color-bg) 0%, rgba(0, 0, 0, 0.05) 100%)'
      : 'transparent',
    border: isActive
      ? '1px solid var(--accent-color-border)'
      : '1px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'HitmarkerText', monospace",
  })

  const accentBorder = profile?.accent_color || 'var(--accent-color)'
  const initial = (profile?.username || user?.email || '?')[0].toUpperCase()

  const iconStyle: CSSProperties = {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: profile?.avatar_url
      ? 'transparent'
      : 'var(--accent-color-bg)',
    border: `2px solid ${accentBorder}`,
    overflow: 'hidden',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent-color)',
    fontFamily: "'HitmarkerText', monospace",
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: dropdownOpen ? `0 0 0 2px ${accentBorder}40` : 'none',
    transition: 'box-shadow 0.2s ease',
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
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.path)}
            style={tabStyle(activeTab === tab.key)}
            title={tab.title}
            data-mheu-nav-tip={tab.title}
          >
            {tab.label}
          </button>
        ))}
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
