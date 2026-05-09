import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const palette = {
  bg: '#000000',
  fg: '#d8d8d8',
  fgDim: '#7a7a7a',
  accent: '#ff2d2d',
  accentDim: 'rgba(255, 45, 45, 0.6)',
}

const mono = "'Courier New', Consolas, ui-monospace, monospace"

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.bracket}>[</span>
          <span style={styles.title}>ADMIN CONSOLE</span>
          <span style={styles.bracket}>]</span>
          <span style={styles.user}>// {user?.email ?? 'unknown'}</span>
        </div>
        <button onClick={handleSignOut} style={styles.signOut}>
          &gt; SIGN OUT
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.placeholder}>
          <div style={styles.placeholderTitle}>PHASE 2</div>
          <div style={styles.placeholderBody}>data tables coming</div>
          <div style={styles.placeholderHint}>
            users · passwords · oauth · life scores · leaderboard
          </div>
        </div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    background: palette.bg,
    color: palette.fg,
    fontFamily: mono,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 22px',
    borderBottom: `1px solid ${palette.accentDim}`,
    background: '#050505',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    fontSize: 13,
    letterSpacing: '0.16em',
  },
  bracket: { color: palette.accentDim },
  title: { color: palette.accent, fontWeight: 700 },
  user: { color: palette.fgDim, fontSize: 11, letterSpacing: '0.08em' },
  signOut: {
    background: 'transparent',
    color: palette.accent,
    border: `1px solid ${palette.accent}`,
    borderRadius: 0,
    padding: '6px 12px',
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholder: {
    border: `1px dashed ${palette.accentDim}`,
    padding: '32px 48px',
    textAlign: 'center',
    maxWidth: 460,
  },
  placeholderTitle: {
    color: palette.accent,
    fontSize: 14,
    letterSpacing: '0.32em',
    marginBottom: 8,
  },
  placeholderBody: {
    fontSize: 13,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  placeholderHint: {
    color: palette.fgDim,
    fontSize: 11,
    letterSpacing: '0.08em',
  },
}
