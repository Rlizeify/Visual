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
 * NavBar for Asian Vibrant.
 *
 * Lacquered crimson band with a single thin gold underline. The MHEU
 * title sits center in calligraphic gold leaf. Each tab is a vertical
 * paper-tab strip extending upward into the crimson band. Profile icon
 * sits top-left in a gold-edged circle.
 */
export default function AsianVibrantNavBar() {
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
    background:
      'linear-gradient(180deg, var(--av-crimson-deep) 0%, var(--av-crimson) 60%, var(--av-crimson-deep) 100%)',
    borderBottom: '1.5px solid var(--av-gold)',
    boxShadow: '0 2px 12px -4px rgba(26,20,16,0.55), inset 0 -8px 12px -10px rgba(0,0,0,0.45)',
    zIndex: 1000,
    fontFamily: "'Ma Shan Zheng', serif",
  }

  // Tab strip — paper tab descending from the lacquer band
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

        {/* Centered MHEU title, sits inside the lacquer band */}
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

        {/* Tabs anchored to the right of center */}
        <div style={{
          position: 'absolute',
          right: '14px',
          top: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '4px',
          paddingTop: '0',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              style={tabStyle(activeTab === tab.key)}
              title={tab.title}
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
