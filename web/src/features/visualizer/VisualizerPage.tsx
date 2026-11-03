import { useEffect, useRef, useState } from 'react'
import { startPolling, stopPolling } from '../../services/spotify/polling'
import { getVisualizerEngine } from './VisualizerEngine'
import ButterchurnCanvas from './ButterchurnCanvas'
import GearMenu from './GearMenu'
import { useVizSettings } from './useVizSettings'
import { useTrackMetadata } from '../spotify/useTrackMetadata'
import Controls from '../spotify/Controls'
import WaveformProgressBar from '../spotify/WaveformProgressBar'
import { useMouseIdle } from '../../shared/hooks/useMouseIdle'
import './visualizer.css'

export default function VisualizerPage() {
  const { settings, selectedPreset, updateSettings, setPreset, applyPersistedToEngine } = useVizSettings()
  const controlsVisible = useMouseIdle(3000)
  const { trackName, artistName, albumArt, isPlaying, shuffleState } = useTrackMetadata()

  const [gearOpen, setGearOpen] = useState(false)
  const [liveAudioActive, setLiveAudioActive] = useState<boolean>(() => getVisualizerEngine().isLiveAudioEnabled())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const showIdle = !isPlaying && !trackName && !liveAudioActive

  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [])

  // Pause Butterchurn only while the browser tab is hidden.
  useEffect(() => {
    const eng = getVisualizerEngine()
    const sync = () => eng.setPaused(document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      eng.setPaused(false)
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await containerRef.current?.requestFullscreen()
    } catch (err) {
      console.error('[VisualizerPage] Fullscreen error:', err)
    }
  }

  const hud = controlsVisible || gearOpen ? '' : ' hud-hidden'

  return (
    <div ref={containerRef} className="viz">
      <div className={`viz__idle${showIdle ? ' is-on' : ''}`}><div className="idle-orb" /></div>

      <ButterchurnCanvas showIdle={showIdle} onInitialized={applyPersistedToEngine} />

      <WaveformProgressBar />

      <button type="button" className={`viz__gear btn btn--icon glass${hud}`} onClick={() => setGearOpen(true)}
        aria-label="Visualizer settings" aria-expanded={gearOpen}>
        ⚙
      </button>

      <div className="viz__hud">
        <div className="now-playing glass" aria-live="polite">
          {albumArt ? <img src={albumArt} alt="" className="now-playing__art" /> : <div className="now-playing__art" />}
          <div className="now-playing__text">
            <div className="now-playing__track">{trackName || (liveAudioActive ? 'Live audio' : 'Nothing playing')}</div>
            {artistName && <div className="now-playing__artist">{artistName}</div>}
          </div>
        </div>

        <Controls isPlaying={isPlaying} shuffleState={shuffleState} visible={controlsVisible} />

        <button type="button" className={`btn btn--icon glass viz__fs${hud}`} onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          {isFullscreen ? '✕' : '⛶'}
        </button>
      </div>

      <GearMenu
        isOpen={gearOpen}
        onClose={() => setGearOpen(false)}
        settings={settings}
        selectedPreset={selectedPreset}
        onSettingsChange={updateSettings}
        onPresetChange={setPreset}
        onLiveAudioChange={setLiveAudioActive}
      />
    </div>
  )
}
