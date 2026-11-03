// Public landing page. Tiles come from the route registry
// (showOnLanding) — add a page there and it appears here.

import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { landingRoutes } from '../../app/routes'
import { Icon } from '../../app/icons'
import './landing.css'

export default function LandingPage() {
  const { user } = useAuth()
  const tiles = landingRoutes()

  return (
    <main className="page landing">
      <div className="landing__grid" aria-hidden />
      <div className="container">
        <section className="landing__hero">
          <p className="eyebrow">MHEU · Console</p>
          <h1 className="landing__title">
            Live visuals for your music.<br />
            <span className="landing__title-em">Clear math for your trades.</span>
          </h1>
          <p className="landing__lede muted">
            A Milkdrop visualizer that follows whatever you&apos;re playing, and an SPX options tool that
            shows what a position is worth at any level and date. Runs in the browser — nothing to install.
          </p>
          {!user && (
            <div className="row">
              <Link to="/signup" className="btn btn--primary">Create account</Link>
              <Link to="/login" className="btn">Sign in</Link>
            </div>
          )}
        </section>

        <section className="landing__tiles" aria-label="Tools">
          {tiles.map((r, i) => {
            const locked = r.requiresAuth && !user
            const to = locked ? `/login?next=${encodeURIComponent(r.path)}` : r.path
            return (
              <Link key={r.path} to={to} className="tile">
                <span className="tile__index">{String(i + 1).padStart(2, '0')}</span>
                <span className="tile__icon"><Icon name={r.icon} size={28} /></span>
                <h2 className="tile__title">{r.title}</h2>
                <p className="tile__desc muted">{r.description}</p>
                <span className="tile__cta">
                  {locked
                    ? <><Icon name="lock" size={16} /> Sign in required</>
                    : <>Open <Icon name="arrow" size={16} /></>}
                </span>
              </Link>
            )
          })}
        </section>
      </div>
    </main>
  )
}
