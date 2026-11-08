// The one nav bar. Links come from the route registry; nothing here
// knows which pages exist.

import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../context/ProfileContext'
import { navRoutes } from '../routes'
import { useSongUnlock } from '../songUnlock'
import { DEFAULT_FEATURES } from '../../lib/features'
import { Icon } from '../icons'
import AccentPicker from './AccentPicker'
import Avatar from './Avatar'
import ProfileDropdown from './ProfileDropdown'

const DEFAULT_FEATURE_SET: ReadonlySet<string> = new Set(DEFAULT_FEATURES)

export default function NavBar({ faded = false }: { faded?: boolean }) {
  const { user } = useAuth()
  const { profile, features } = useProfile()
  const songUnlock = useSongUnlock()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const links = navRoutes({
    signedIn: !!user,
    isAdmin: !!profile?.is_admin,
    // Until the grants load, show the defaults so the nav doesn't flicker.
    features: profile ? features : DEFAULT_FEATURE_SET,
    songUnlocked: songUnlock === 'on',
  })
  const loginHref = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
  const onAuthPage = location.pathname === '/login' || location.pathname === '/signup'

  useEffect(() => { setMenuOpen(false); setAccountOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <header className={`nav${faded && !menuOpen && !accountOpen ? ' nav--faded' : ''}`}>
      <div className="nav__inner">
        <Link to="/" className="nav__brand" aria-label="MHEU home">MHEU</Link>

        <nav className="nav__links" aria-label="Main">
          {links.map(r => (
            <NavLink key={r.path} to={r.path} className="nav__link">{r.title}</NavLink>
          ))}
        </nav>

        <div className="nav__right">
          {!user && <div className="nav__guest-accent"><AccentPicker compact /></div>}
          {user ? (
            <button
              ref={avatarRef}
              type="button"
              className="nav__avatar"
              aria-label="Account menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(o => !o)}
            >
              <Avatar size={32} />
            </button>
          ) : onAuthPage ? null : (
            <Link to={loginHref} className="btn btn--primary btn--sm nav__signin">Sign in</Link>
          )}
          <button
            type="button"
            className="nav__menu-btn btn btn--ghost btn--icon"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="nav-menu"
            onClick={() => setMenuOpen(o => !o)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="nav-menu" className="nav__menu">
          <nav aria-label="Main">
            <NavLink to="/" end className="nav__menu-link"><Icon name="home" /> Home</NavLink>
            {links.map(r => (
              <NavLink key={r.path} to={r.path} className="nav__menu-link"><Icon name={r.icon} /> {r.title}</NavLink>
            ))}
          </nav>
          <div className="nav__menu-accent">
            <span className="label">Accent</span>
            <AccentPicker />
          </div>
        </div>
      )}

      {user && accountOpen && <ProfileDropdown anchor={avatarRef.current} onClose={() => setAccountOpen(false)} />}
    </header>
  )
}
