import { useState, useEffect, type CSSProperties } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'

const tabs = [
  { key: 'm', label: 'M', path: '/m', title: 'Music' },
  { key: 'h', label: 'H', path: '/h', title: 'Health' },
  { key: 'e', label: 'E', path: '/e', title: 'Entertainment' },
  { key: 'u', label: 'U', path: '/u', title: 'User' },
] as const

type TabKey = typeof tabs[number]['key']

export default function MHEUShell() {
  const navigate = useNavigate()
  const location = useLocation()

  const getCurrentTab = (): TabKey => {
    const path = location.pathname
    const tab = tabs.find(t => t.path === path)
    return tab?.key || 'm'
  }

  const [activeTab, setActiveTab] = useState<TabKey>(getCurrentTab)
  const showFog = activeTab !== 'm'

  useEffect(() => {
    setActiveTab(getCurrentTab())
  }, [location.pathname])

  const handleTabClick = (tab: typeof tabs[number]) => {
    setActiveTab(tab.key)
    navigate(tab.path)
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
    background: 'linear-gradient(180deg, rgba(0,20,30,0.85) 0%, rgba(0,20,30,0.4) 100%)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(0, 220, 200, 0.25)',
    zIndex: 1000,
    fontFamily: "'HitmarkerText', monospace",
  }

  const tabStyle = (isActive: boolean): CSSProperties => ({
    padding: '10px 24px',
    fontSize: '18px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: isActive ? '#00dcc8' : 'rgba(0, 220, 200, 0.5)',
    background: isActive
      ? 'linear-gradient(180deg, rgba(0, 220, 200, 0.15) 0%, rgba(0, 220, 200, 0.05) 100%)'
      : 'transparent',
    border: isActive
      ? '1px solid rgba(0, 220, 200, 0.4)'
      : '1px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'HitmarkerText', monospace",
  })

  const fogStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 20, 30, 0.6)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    opacity: showFog ? 1 : 0,
    pointerEvents: showFog ? 'auto' : 'none',
    transition: 'opacity 300ms ease',
    zIndex: 50,
  }

  const contentStyle: CSSProperties = {
    position: 'relative',
    zIndex: showFog ? 100 : 1,
    paddingTop: '56px',
    width: '100%',
    height: '100%',
    overflow: showFog ? 'auto' : 'visible', // No scroll on M tab
    pointerEvents: showFog ? 'auto' : 'none', // Let clicks through on M tab (visualizer handles them)
  }

  return (
    <>
      {/* Fog overlay for H/E/U tabs */}
      <div style={fogStyle} />

      {/* Tab navigation */}
      <nav style={navStyle}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab)}
            style={tabStyle(activeTab === tab.key)}
            title={tab.title}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div style={contentStyle}>
        <Outlet />
      </div>
    </>
  )
}

export { tabs }
export type { TabKey }
