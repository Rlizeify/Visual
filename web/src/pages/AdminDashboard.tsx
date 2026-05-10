import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { palette, mono } from '../components/admin/theme'
import UsersTab from '../components/admin/UsersTab'
import PasswordsTab from '../components/admin/PasswordsTab'
import OAuthTab from '../components/admin/OAuthTab'
import LifeScoresTab from '../components/admin/LifeScoresTab'
import LeaderboardTab from '../components/admin/LeaderboardTab'
import PresetsTab from '../components/admin/PresetsTab'
import ScoreVisibilityTab from '../components/admin/ScoreVisibilityTab'
import TooltipsTab from '../components/admin/TooltipsTab'
import ScoringTab from '../components/admin/ScoringTab'

const TABS = [
  { key: 'users', label: 'USERS' },
  { key: 'passwords', label: 'PASSWORDS' },
  { key: 'oauth', label: 'OAUTH' },
  { key: 'scoring', label: 'SCORING' },
  { key: 'life-scores', label: 'LIFE SCORES' },
  { key: 'leaderboard', label: 'LEADERBOARD' },
  { key: 'presets', label: 'PRESETS' },
  { key: 'visibility', label: 'VISIBILITY' },
  { key: 'tooltips', label: 'TOOLTIPS' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState<TabKey>('users')

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

      <nav style={styles.tabBar}>
        {TABS.map(t => {
          const active = t.key === tab
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tabBtn,
                color: active ? palette.accent : palette.fgDim,
                borderBottom: `2px solid ${active ? palette.accent : 'transparent'}`,
              }}
            >
              {active && <span style={{ color: palette.accentDim, marginRight: 6 }}>&gt;</span>}
              {t.label}
            </button>
          )
        })}
      </nav>

      <main style={styles.main}>
        {tab === 'users' && <UsersTab />}
        {tab === 'passwords' && <PasswordsTab />}
        {tab === 'oauth' && <OAuthTab />}
        {tab === 'scoring' && <ScoringTab />}
        {tab === 'life-scores' && <LifeScoresTab />}
        {tab === 'leaderboard' && <LeaderboardTab />}
        {tab === 'presets' && <PresetsTab />}
        {tab === 'visibility' && <ScoreVisibilityTab />}
        {tab === 'tooltips' && <TooltipsTab />}
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
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 22px',
    borderBottom: `1px solid ${palette.accentDim}`,
    background: palette.panel,
    flexShrink: 0,
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
  tabBar: {
    display: 'flex',
    background: palette.panel,
    borderBottom: `1px solid ${palette.accentSubtle}`,
    paddingLeft: 22,
    flexShrink: 0,
  },
  tabBtn: {
    background: 'transparent',
    border: 'none',
    padding: '12px 16px',
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.18em',
    cursor: 'pointer',
    transition: 'color 80ms linear',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: '20px 22px',
  },
}
