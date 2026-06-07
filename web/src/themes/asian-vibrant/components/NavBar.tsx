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
 * NavBar for Asian Vibrant.
 *
 * Lacquered crimson band (.av-lacquer-band) with a single thin
 * gold underline. The MHEU title sits centered as gold leaf
 * calligraphy (.av-title — hidden under 700px to avoid collision
 * with the tab strip; audit V8 fix).
 *
 * Profile icon — top-left, accent-rimmed circle.
 * Tabs — anchored top-right of the lacquer band as paper tabs
 * extending downward into the canvas when active.
 */
export default function AsianVibrantNavBar() {
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
    zIndex: 1000,
    fontFamily: 'var(--av-font-body)',
  }

  // Paper tab. Active tab descends from the lacquer band as a
  // cream paper card; inactive tab is the lacquer beneath.
  const tabStyle = (isActive: boolean): CSSProperties => ({
    position: 'relative',
    padding: '10px 18px 12px',
    minWidth: '52px',
    fontSize: '20px',
    fontFamily: "'Ma Shan Zheng', serif",
    letterSpacing: '0.08em',
    color: isActive ? 'var(--av-ink)' : 'var(--av-paper)',
    background: isActive
      ? 'linear-gradient(180deg, var(--av-paper) 0%, var(--av-paper-soft) 100%)'
      : 'transparent',
    border: 'none',
    borderTop: isActive ? '1px solid var(--av-gold)' : '1px solid transparent',
    borderLeft: isActive ? '1px solid var(--av-gold-deep)' : '1px solid transparent',
    borderRight: isActive ? '1px solid var(--av-gold-deep)' : '1px solid transparent',
    borderBottom: 'none',
    borderRadius: isActive ? '0 0 6px 6px' : '0',
    cursor: 'pointer',
    transition: 'color 200ms ease, background 200ms ease, transform 180ms ease',
    transform: isActive ? 'translateY(2px)' : 'translateY(0)',
    boxShadow: isActive ? '0 2px 6px rgba(26,20,16,0.25) inset' : 'none',
  })

  const accentBorder = profile?.accent_color || 'var(--av-gold)'
  const initial = (profile?.username || user?.email || '?')[0].toUpperCase()

  const iconStyle: CSSProperties = {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: profile?.avatar_url ? 'transparent' : 'var(--av-paper-soft)',
    border: `2px solid ${accentBorder}`,
    overflow: 'hidden',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--av-ink)',
    fontFamily: "'Ma Shan Zheng', serif",
    fontSize: '16px',
    boxShadow: dropdownOpen
      ? `0 0 0 2px var(--av-gold), 0 0 12px rgba(201,162,39,0.4)`
      : '0 1px 0 rgba(26,20,16,0.40)',
    transition: 'box-shadow 0.2s ease',
  }

  return (
    <>
      <nav className="av-lacquer-band" style={navStyle}>
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

        {/* Centered MHEU title — hidden under 700px (theme.css). */}
        <span
          className="av-title"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          MHEU
        </span>

        {/* Tabs anchored to the right of center. */}
        <div style={{
          position: 'absolute',
          right: '14px',
          top: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '4px',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              style={tabStyle(activeTab === tab.key)}
              title={tab.title}
              data-mheu-nav-tip={tab.title}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
