import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { startPolling, stopPolling } from '../../services/spotify/polling'
import { getVisualizerEngine } from './VisualizerEngine'
import ButterchurnCanvas from './ButterchurnCanvas'
import { useVizSettings } from './useVizSettings'
import { useTrackMetadata } from '../spotify/useTrackMetadata'
import { useMouseIdle } from '../../shared/hooks/useMouseIdle'
import Controls from '../spotify/Controls'
import GearMenu from './GearMenu'
import ScopeCanvas from '../oscilloscope/ScopeCanvas'
import OsciPanel from '../oscilloscope/OsciPanel'
import { loadOsciSettings, saveOsciSettings } from '../oscilloscope/storage'
import type { OsciSettings } from '../oscilloscope/types'

interface VisualizerPageProps {
  onLogout?: () => void
  displayName?: string
  hideUI?: boolean
}

export default function VisualizerPage({ onLogout, displayName, hideUI = false }: VisualizerPageProps) {
  const {
    settings, selectedPreset, vizMode,
    updateSettings, setPreset, setVizMode,
    applyServerSettings, applyPersistedToEngine,
  } = useVizSettings()

  const controlsVisible = useMouseIdle(3000)
  const { trackName, artistName, albumArt, isPlaying, shuffleState } = useTrackMetadata()

  const [gearOpen, setGearOpen]           = useState(false)
  const [osciPanelOpen, setOsciPanelOpen] = useState(false)
  const [osciSettings, setOsciSettings]   = useState<OsciSettings>(loadOsciSettings)
  const [liveAudioActive, setLiveAudioActive] = useState<boolean>(() => getVisualizerEngine().isLiveAudioEnabled())

  // RAF loop in ScopeCanvas reads this without triggering re-renders
  const osciSettingsRef = useRef<OsciSettings>(osciSettings)
  osciSettingsRef.current = osciSettings

  const showIdle = !isPlaying && !trackName && !liveAudioActive

  // Spotify polling
  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [])

  // Fetch server settings once on mount; merge silently
  useEffect(() => {
    const jwt = localStorage.getItem('mheu_session')
    if (!jwt) return
    fetch('/api/settings', { headers: { Authorization: `Bearer ${jwt}` } })
      .then(res => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          applyServerSettings(data as Record<string, unknown>)
        }
      })
      .catch(() => { /* network error — fall back to localStorage silently */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }

  const handleVizToggle = () => {
    const next = vizMode === 'viz' ? 'scope' : 'viz'
    setVizMode(next)
    if (next !== 'scope') setOsciPanelOpen(false)
  }

  const handleOsciChange = (s: OsciSettings) => {
    setOsciSettings(s)
    saveOsciSettings(s)
  }

  const panelStyle: CSSProperties = {
    background: 'rgba(0, 20, 30, 0.30)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0, 220, 200, 0.4)',
    borderRadius: 8,
  }

  const buttonStyle: CSSProperties = {
    ...panelStyle,
    color: '#00dcc8',
    padding: '10px 14px',
    fontSize: '16px',
    fontFamily: "'HitmarkerText', monospace",
    cursor: 'pointer',
    borderRadius: 4,
    background: 'rgba(0, 20, 30, 0.30)',
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000000',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: showIdle ? 1 : 0,
        pointerEvents: showIdle ? 'auto' : 'none',
        transition: 'opacity 1s ease',
        zIndex: 10,
      }}>
        <div className="idle-orb" />
      </div>

      <ButterchurnCanvas
        showIdle={showIdle || vizMode === 'scope'}
        onInitialized={applyPersistedToEngine}
      />

      <ScopeCanvas visible={vizMode === 'scope'} settingsRef={osciSettingsRef} />

      {!hideUI && (
        <>
          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            ...panelStyle,
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'none',
            zIndex: 100,
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {albumArt ? (
                <img
                  src={albumArt}
                  alt="Album art"
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
                />
              ) : (
                <div style={{
                  width: 80,
                  height: 80,
                  background: 'rgba(0, 20, 30, 0.5)',
                  border: '1px solid rgba(0, 220, 200, 0.2)',
                  borderRadius: 4,
                }} />
              )}
              <div style={{ maxWidth: '200px' }}>
                <div style={{
                  color: '#00dcc8',
                  fontSize: '14px',
                  fontFamily: "'HitmarkerText', monospace",
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {trackName || 'No track playing'}
                </div>
                {artistName && (
                  <div style={{
                    color: 'rgba(180, 240, 235, 0.7)',
                    fontSize: '12px',
                    fontFamily: "'HitmarkerText', monospace",
                    lineHeight: 1.3,
                    marginTop: '4px',
                  }}>
                    {artistName}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Controls isPlaying={isPlaying} shuffleState={shuffleState} visible={controlsVisible} />

          {vizMode === 'scope' && osciPanelOpen && (
            <OsciPanel settings={osciSettings} onChange={handleOsciChange} />
          )}

          {vizMode === 'scope' && (
            <button
              onClick={() => setOsciPanelOpen(p => !p)}
              style={{
                ...buttonStyle,
                position: 'fixed',
                bottom: '20px',
                right: '144px',
                fontSize: '14px',
                padding: '10px 11px',
                opacity: controlsVisible ? 1 : 0,
                pointerEvents: controlsVisible ? 'auto' : 'none',
                transition: 'opacity 0.4s ease',
                zIndex: 100,
                border: osciPanelOpen
                  ? '1px solid rgba(39,224,225,0.9)'
                  : '1px solid rgba(0,220,200,0.4)',
                color: osciPanelOpen ? '#27e0e1' : '#00dcc8',
              }}
              title="OSCI render settings"
            >
              ⚙
            </button>
          )}

          <button
            onClick={handleVizToggle}
            style={{
              ...buttonStyle,
              position: 'fixed',
              bottom: '20px',
              right: '76px',
              fontSize: '11px',
              letterSpacing: '0.08em',
              padding: '10px 12px',
              opacity: controlsVisible ? 1 : 0,
              pointerEvents: controlsVisible ? 'auto' : 'none',
              transition: 'opacity 0.4s ease',
              zIndex: 100,
              border: vizMode === 'scope'
                ? '1px solid rgba(39, 224, 225, 0.8)'
                : '1px solid rgba(0, 220, 200, 0.4)',
              color: vizMode === 'scope' ? '#27e0e1' : '#00dcc8',
            }}
            title={vizMode === 'viz' ? 'Switch to oscilloscope mode' : 'Switch to visualizer mode'}
          >
            {vizMode === 'viz' ? 'SCOPE' : 'VIZ'}
          </button>

          <button
            onClick={handleFullscreen}
            style={{
              ...buttonStyle,
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              opacity: controlsVisible ? 1 : 0,
              pointerEvents: controlsVisible ? 'auto' : 'none',
              transition: 'opacity 0.4s ease',
              zIndex: 100,
            }}
            title="Toggle fullscreen"
          >
            &#x26F6;
          </button>

          {displayName && (
            <div style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              color: '#00dcc8',
              fontFamily: 'monospace',
              fontSize: '11px',
              letterSpacing: '0.05em',
              opacity: 0.6,
              pointerEvents: 'none',
              zIndex: 100,
            }}>
              {displayName}
            </div>
          )}

          <button
            onClick={() => setGearOpen(true)}
            style={{
              ...buttonStyle,
              position: 'fixed',
              top: '20px',
              right: '20px',
              fontSize: '20px',
              opacity: controlsVisible ? 1 : 0,
              pointerEvents: controlsVisible ? 'auto' : 'none',
              transition: 'opacity 0.4s ease',
              zIndex: 100,
            }}
            title="Settings"
          >
            &#9881;
          </button>

          <GearMenu
            isOpen={gearOpen}
            onClose={() => setGearOpen(false)}
            settings={settings}
            selectedPreset={selectedPreset}
            onSettingsChange={updateSettings}
            onPresetChange={setPreset}
            onLiveAudioChange={setLiveAudioActive}
            onLogout={onLogout}
          />
        </>
      )}
    </div>
  )
}
