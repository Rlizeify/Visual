import { useState, useEffect, useCallback } from 'react'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { useProjectPersistence } from '../../hooks/useProjectPersistence'
import { PluginRack } from '../../plugins/PluginRack'
import { audioEngine } from '../../audio/AudioEngine'
import { spotifyPlayer, SpotifyPlayerState } from '../../audio/SpotifyPlayer'
import { startLoopback, stopLoopback } from '../../audio/SpotifyPlayerAudio'
import CockpitGrid from './CockpitGrid'
import CockpitBottomBar from './CockpitBottomBar'
import DJDecks from './dj/DJDecks'
import SaveDialog from '../shared/SaveDialog'
import LoadDialog from '../shared/LoadDialog'
import { registerCockpitUI, getCockpitState, setCockpitState } from './cockpitStateCollector'
import CockpitTutorial from './CockpitTutorial'

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
  const [topLeftTab, setTopLeftTab]         = useState<'video' | 'spotify'>('video')
  const [, setSpotifyState]                 = useState<SpotifyPlayerState>(spotifyPlayer.getState())
  const [activeSource, setActiveSource]     = useState<'mp3' | 'spotify'>('mp3')

  useEffect(() => spotifyPlayer.subscribe(setSpotifyState), [])

  // Auto-reconnect on mount.
  // NOTE: do not call the renderer-side startLoopback() here — getDisplayMedia
  // requires a user gesture and will throw NotAllowedError on boot. The
  // "Enable Audio Reactivity" button in SpotifyBrowser is the user-gesture entrypoint.
  useEffect(() => {
    const api = (window as any).api
    api?.spotifyGetAccessToken().then(async (token: string | null) => {
      if (token) {
        spotifyPlayer.markTokenValid(true)
        spotifyPlayer.connectToAnalyser(audioEngine.getAudioContext())
        await api.startLoopback()
        setActiveSource('spotify')
      }
    })
  }, [])

  const handleSpotifyConnected = useCallback(async (_accessToken: string) => {
    const api = (window as any).api
    spotifyPlayer.markTokenValid(true)
    spotifyPlayer.connectToAnalyser(audioEngine.getAudioContext())
    await api?.startLoopback()
    // OAuth callback may not preserve the user gesture chain — getDisplayMedia
    // could throw NotAllowedError. The "Enable Audio Reactivity" button in
    // SpotifyBrowser is the reliable fallback; this attempt is best-effort.
    await startLoopback(audioEngine.getAudioContext())
    setTopLeftTab('spotify')
    setActiveSource('spotify')
  }, [])

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
  const persistence = useProjectPersistence({ api, getState: getCockpitState, setState: setCockpitState })

  const handleLoad = async () => {
    const fp = await api?.loadMp3()
    if (fp) {
      await audio.load(fp)
      stopLoopback()
      setActiveSource('mp3')
    }
  }

  const handleVolume = (v: number) => { setVolume(v); audio.setMasterVolume(v) }

  const spotifyAnalyser = spotifyPlayer.getAnalyserNode()
  const analyser = (activeSource === 'spotify' && spotifyAnalyser) ? spotifyAnalyser : audio.getAnalyserNode()

  const viz = { selectedPreset, blendTime, cycleSpeed, bassReactivity, midReactivity, highReactivity, animationSpeed }
  const handlers = {
    onPresetChange: setSelectedPreset, onBlendTime: setBlendTime, onCycleSpeed: setCycleSpeed,
    onBass: setBass, onMid: setMid, onHigh: setHigh, onAnimationSpeed: setAnimationSpeed,
  }

  return (
    <div className="cockpit-frame cockpit-layout">
      <div className="cockpit-left cockpit-sidebar">
        <PluginRack chain={audioEngine.getPluginChain()} audioContext={audioEngine.getAudioContext()} />
      </div>
      <CockpitGrid
        topLeftTab={topLeftTab} onSetTopLeftTab={setTopLeftTab}
        onSpotifyConnected={handleSpotifyConnected}
        viz={viz} handlers={handlers} analyser={analyser} activeSource={activeSource}
      />
      <div className="cockpit-dj-strip" data-tutorial-id="dj-decks"><DJDecks /></div>
      <CockpitBottomBar
        audio={audio} activeSource={activeSource} analyser={analyser}
        volume={volume} onVolumeChange={handleVolume}
        onLoad={handleLoad} onHelp={() => setShowTutorial(true)} persistence={persistence}
      />
      {showTutorial && <CockpitTutorial onClose={() => setShowTutorial(false)} />}
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
