import { useState, useEffect, useCallback } from 'react'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { useProjectPersistence } from '../../hooks/useProjectPersistence'
import { PluginRack } from '../../plugins/PluginRack'
import { audioEngine } from '../../audio/AudioEngine'
import { spotifyPlayer, SpotifyPlayerState } from '../../audio/SpotifyPlayer'
import VisualizerPreview from './VisualizerPreview'
import VisualizerControls from './VisualizerControls'
import WaveformSlider from './WaveformSlider'
import VideoFiles from './VideoFiles'
import VideoPreview from './VideoPreview'
import SpotifyBrowser from './SpotifyBrowser'
import SpotifyConnect from './SpotifySettings'
import DJDecks from './dj/DJDecks'
import SaveDialog from '../shared/SaveDialog'
import LoadDialog from '../shared/LoadDialog'
import { registerCockpitUI, getCockpitState, setCockpitState } from './cockpitStateCollector'
import CockpitTutorial from './CockpitTutorial'

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function CockpitApp() {
  const [showTutorial, setShowTutorial] = useState(false)
  const audio = useAudioEngine()
  const [volume, setVolume]                 = useState(80)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [blendTime, setBlendTime]           = useState(2.5)
  const [cycleSpeed, setCycleSpeed]         = useState(30)
  const [bassReactivity, setBass]           = useState(50)
  const [midReactivity, setMid]             = useState(50)
  const [highReactivity, setHigh]           = useState(50)
  const [animationSpeed, setAnimationSpeed] = useState(1.0)

  // Spotify state
  const [topLeftTab, setTopLeftTab] = useState<'video' | 'spotify'>('video')
  const [spotifyState, setSpotifyState] = useState<SpotifyPlayerState>(spotifyPlayer.getState())
  const [activeSource, setActiveSource] = useState<'mp3' | 'spotify'>('mp3')

  useEffect(() => {
    return spotifyPlayer.subscribe(setSpotifyState)
  }, [])

  // Auto-reconnect on mount: if a valid token exists, mark connected and init SDK
  useEffect(() => {
    const api = (window as any).api
    api?.spotifyGetAccessToken().then(async (token: string | null) => {
      if (token) {
        spotifyPlayer.markTokenValid(true)
        await spotifyPlayer.init(token)
        spotifyPlayer.connectToAnalyser(audioEngine.getAudioContext())
      }
    })
  }, [])

  const handleSpotifyConnected = useCallback(async (accessToken: string) => {
    spotifyPlayer.markTokenValid(true)
    await spotifyPlayer.init(accessToken)
    spotifyPlayer.connectToAnalyser(audioEngine.getAudioContext())
    setTopLeftTab('spotify')
    setActiveSource('spotify')
  }, [])

  // Register cockpit UI state for persistence
  useEffect(() => {
    registerCockpitUI(
      () => ({ volume, selectedPreset, blendTime, cycleSpeed, bassReactivity, midReactivity, highReactivity, animationSpeed }),
      (s) => {
        setVolume(s.volume); setSelectedPreset(s.selectedPreset)
        setBlendTime(s.blendTime); setCycleSpeed(s.cycleSpeed)
        setBass(s.bassReactivity); setMid(s.midReactivity); setHigh(s.highReactivity)
        if (s.animationSpeed != null) setAnimationSpeed(s.animationSpeed)
      }
    )
  })

  const api = (window as any).api
  const persistence = useProjectPersistence({
    api, getState: getCockpitState, setState: setCockpitState,
  })

  const handleLoad = async () => {
    const fp = await api?.loadMp3()
    if (fp) {
      await audio.load(fp)
      setActiveSource('mp3')
    }
  }

  const handleVolume = (v: number) => {
    setVolume(v)
    audio.setMasterVolume(v)
  }

  // Route audio through Spotify analyser when Spotify is the active source
  const spotifyAnalyser = spotifyPlayer.getAnalyserNode()
  const analyser = (activeSource === 'spotify' && spotifyAnalyser) ? spotifyAnalyser : audio.getAnalyserNode()

  return (
    <div className="cockpit-frame cockpit-layout">

      {/* LEFT SIDEBAR — plugin rack (spans all rows) */}
      <div className="cockpit-left cockpit-sidebar">
        <PluginRack chain={audioEngine.getPluginChain()} audioContext={audioEngine.getAudioContext()} />
      </div>

      {/* MAIN 2×2 GRID */}
      <div className="cockpit-main" data-tutorial-id="cockpit-grid">
        <div className="cockpit-panel" data-tutorial-id="video-files">
          <div className="sp-tab-bar">
            <button
              className={`sp-tab${topLeftTab === 'video' ? ' sp-tab--active' : ''}`}
              onClick={() => setTopLeftTab('video')}
            >VIDEO</button>
            <button
              className={`sp-tab${topLeftTab === 'spotify' ? ' sp-tab--active' : ''}`}
              onClick={() => setTopLeftTab('spotify')}
            >SPOTIFY</button>
          </div>
          {topLeftTab === 'video' ? <VideoFiles /> : (
            <>
              <SpotifyConnect onConnected={handleSpotifyConnected} />
              <SpotifyBrowser />
            </>
          )}
        </div>
        <div className="cockpit-panel" data-tutorial-id="video-preview"><VideoPreview /></div>
        <div className="cockpit-panel" data-tutorial-id="visualizer-controls">
          <span className="cockpit-panel__title">VISUALIZER</span>
          <VisualizerControls
            selectedPreset={selectedPreset} blendTime={blendTime} cycleSpeed={cycleSpeed}
            bassReactivity={bassReactivity} midReactivity={midReactivity} highReactivity={highReactivity}
            animationSpeed={animationSpeed}
            onPresetChange={setSelectedPreset} onBlendTime={setBlendTime} onCycleSpeed={setCycleSpeed}
            onBass={setBass} onMid={setMid} onHigh={setHigh} onAnimationSpeed={setAnimationSpeed}
          />
        </div>
        <div className="cockpit-panel" data-tutorial-id="visualizer-preview" style={{ position: 'relative' }}>
          <VisualizerPreview analyser={analyser} selectedPreset={selectedPreset}
            blendTime={blendTime} cycleSpeed={cycleSpeed} animationSpeed={animationSpeed} />
          {activeSource === 'spotify' && (
            <span className="sp-badge">♫ SPOTIFY</span>
          )}
        </div>
      </div>

      {/* DJ DECKS STRIP */}
      <div className="cockpit-dj-strip" data-tutorial-id="dj-decks"><DJDecks /></div>

      {/* BOTTOM BAR */}
      <div className="cockpit-bottom-bar" data-tutorial-id="cockpit-bottom-bar">
        <button className="cockpit-btn" onClick={handleLoad}>LOAD FILE</button>
        <button className={`cockpit-btn${audio.isPlaying ? ' active' : ''}`} onClick={audio.play}>PLAY</button>
        <button className="cockpit-btn" onClick={audio.pause}>PAUSE</button>
        <button className="cockpit-btn" onClick={audio.stop}>STOP</button>
        <span className="cockpit-source-indicator">
          SOURCE: {activeSource === 'spotify' ? 'SPOTIFY' : 'MP3'}
        </span>
        <span className="cockpit-time">{fmt(audio.currentTime)}</span>
        <span className="cockpit-time cockpit-time--dim">{audio.duration > 0 ? fmt(audio.duration) : '--:--'}</span>
        <span className={`project-status ${persistence.projectName !== 'Untitled' ? 'project-status--saved' : 'project-status--unsaved'}`}>
          {persistence.statusText}
        </span>
        <span className="cockpit-vol-label">MAIN VOLUME</span>
        <WaveformSlider analyser={analyser} volume={volume} onVolumeChange={handleVolume} />
        <button
          className="cockpit-help-btn"
          onClick={() => setShowTutorial(true)}
          aria-label="Open tutorial"
        >
          ?
        </button>
      </div>

      {/* TUTORIAL */}
      {showTutorial && <CockpitTutorial onClose={() => setShowTutorial(false)} />}

      {/* SAVE/LOAD DIALOGS */}
      {persistence.showSave && (
        <SaveDialog defaultName={persistence.projectName}
          onSave={persistence.handleSave} onCancel={() => persistence.setShowSave(false)} />
      )}
      {persistence.showLoad && (
        <LoadDialog projects={persistence.projects}
          onLoad={persistence.handleLoad} onDelete={persistence.handleDelete}
          onCancel={() => persistence.setShowLoad(false)} />
      )}
      {persistence.showFlash && <div className="save-flash">SAVED</div>}
    </div>
  )
}
