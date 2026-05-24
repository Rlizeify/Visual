import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { startPolling, stopPolling } from '../../services/spotify/polling'
import { getVisualizerEngine } from './VisualizerEngine'
import ButterchurnCanvas from './ButterchurnCanvas'
import { useVizSettings } from './useVizSettings'
import { useTrackMetadata } from '../spotify/useTrackMetadata'
import { useMouseIdle } from '../../shared/hooks/useMouseIdle'
import { useTheme } from '../../themes/ThemeContext'

interface VisualizerPageProps {
  onLogout?: () => void
  displayName?: string
  hideUI?: boolean
}

export default function VisualizerPage({ onLogout, displayName, hideUI = false }: VisualizerPageProps) {
  const {
    settings, selectedPreset,
    updateSettings, setPreset,
    applyServerSettings, applyPersistedToEngine,
  } = useVizSettings()

  const controlsVisible = useMouseIdle(3000)
  const { trackName, artistName, albumArt, isPlaying, shuffleState } = useTrackMetadata()
  const { theme } = useTheme()
  const PlaybackControls = theme.components.PlaybackControls
  const WaveformBar = theme.components.WaveformBar
  const GearMenu = theme.components.GearMenu

  const [gearOpen, setGearOpen] = useState(false)
  const [liveAudioActive, setLiveAudioActive] = useState<boolean>(() => getVisualizerEngine().isLiveAudioEnabled())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const showIdle = !isPlaying && !trackName && !liveAudioActive

  // Spotify polling
  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [])

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
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

  const handleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (containerRef.current) {
        await containerRef.current.requestFullscreen()
      }
    } catch (err) {
      console.error('[VisualizerPage] Fullscreen error:', err)
    }
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
    color: 'var(--accent-color)',
    padding: '10px 14px',
    fontSize: '16px',
    fontFamily: "'HitmarkerText', monospace",
    cursor: 'pointer',
    borderRadius: 4,
    background: 'rgba(0, 20, 30, 0.30)',
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000000',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
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
        showIdle={showIdle}
        onInitialized={applyPersistedToEngine}
      />

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
            zIndex: 500,
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
                  color: 'var(--accent-color)',
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

          <WaveformBar />

          <PlaybackControls isPlaying={isPlaying} shuffleState={shuffleState} visible={controlsVisible} />

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
              zIndex: 500,
              border: isFullscreen
                ? '1px solid rgba(39, 224, 225, 0.8)'
                : '1px solid rgba(0, 220, 200, 0.4)',
              color: isFullscreen ? '#27e0e1' : 'var(--accent-color)',
            }}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '\u2716' : '\u26F6'}
          </button>

          {displayName && (
            <div style={{
              position: 'fixed',
              top: '20px',
              left: '20px',
              color: 'var(--accent-color)',
              fontFamily: 'monospace',
              fontSize: '11px',
              letterSpacing: '0.05em',
              opacity: 0.6,
              pointerEvents: 'none',
              zIndex: 500,
            }}>
              {displayName}
            </div>
          )}

          <button
            onClick={() => setGearOpen(true)}
            style={{
              ...buttonStyle,
              position: 'fixed',
              top: '70px', // Below MHEU nav (56px + padding)
              right: '20px',
              fontSize: '20px',
              opacity: controlsVisible ? 1 : 0,
              pointerEvents: controlsVisible ? 'auto' : 'none',
              transition: 'opacity 0.4s ease',
              zIndex: 1100, // Above MHEU nav (z-index 1000)
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
