import { useState, useEffect, useCallback } from 'react'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { useProjectPersistence } from '../../hooks/useProjectPersistence'
import { PluginRack } from '../../plugins/PluginRack'
import { audioEngine } from '../../audio/AudioEngine'
import VisualizerPreview from './VisualizerPreview'
import VisualizerControls from './VisualizerControls'
import WaveformSlider from './WaveformSlider'
import VideoFiles from './VideoFiles'
import VideoPreview from './VideoPreview'
import DJDecks from './dj/DJDecks'
import SaveDialog from '../shared/SaveDialog'
import LoadDialog from '../shared/LoadDialog'
import { registerCockpitUI, getCockpitState, setCockpitState } from './cockpitStateCollector'

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function CockpitApp() {
  const audio = useAudioEngine()
  const [volume, setVolume]                 = useState(80)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [blendTime, setBlendTime]           = useState(2.5)
  const [cycleSpeed, setCycleSpeed]         = useState(30)
  const [bassReactivity, setBass]           = useState(50)
  const [midReactivity, setMid]             = useState(50)
  const [highReactivity, setHigh]           = useState(50)

  // Register cockpit UI state for persistence
  useEffect(() => {
    registerCockpitUI(
      () => ({ volume, selectedPreset, blendTime, cycleSpeed, bassReactivity, midReactivity, highReactivity }),
      (s) => {
        setVolume(s.volume); setSelectedPreset(s.selectedPreset)
        setBlendTime(s.blendTime); setCycleSpeed(s.cycleSpeed)
        setBass(s.bassReactivity); setMid(s.midReactivity); setHigh(s.highReactivity)
      }
    )
  })

  const api = (window as any).api
  const persistence = useProjectPersistence({
    api, getState: getCockpitState, setState: setCockpitState,
  })

  const handleLoad = async () => {
    const fp = await api?.loadMp3()
    if (fp) await audio.load(fp)
  }

  const handleVolume = (v: number) => {
    setVolume(v)
    audio.setMasterVolume(v)
  }

  const analyser = audio.getAnalyserNode()

  return (
    <div className="cockpit-frame cockpit-layout">

      {/* LEFT SIDEBAR — plugin rack (spans all rows) */}
      <div className="cockpit-left cockpit-sidebar">
        <PluginRack chain={audioEngine.getPluginChain()} audioContext={audioEngine.getAudioContext()} />
      </div>

      {/* MAIN 2×2 GRID */}
      <div className="cockpit-main">
        <div className="cockpit-panel"><VideoFiles /></div>
        <div className="cockpit-panel"><VideoPreview /></div>
        <div className="cockpit-panel">
          <span className="cockpit-panel__title">VISUALIZER</span>
          <VisualizerControls
            selectedPreset={selectedPreset} blendTime={blendTime} cycleSpeed={cycleSpeed}
            bassReactivity={bassReactivity} midReactivity={midReactivity} highReactivity={highReactivity}
            onPresetChange={setSelectedPreset} onBlendTime={setBlendTime} onCycleSpeed={setCycleSpeed}
            onBass={setBass} onMid={setMid} onHigh={setHigh}
          />
        </div>
        <div className="cockpit-panel">
          <VisualizerPreview analyser={analyser} selectedPreset={selectedPreset}
            blendTime={blendTime} cycleSpeed={cycleSpeed} />
        </div>
      </div>

      {/* DJ DECKS STRIP */}
      <div className="cockpit-dj-strip"><DJDecks /></div>

      {/* BOTTOM BAR */}
      <div className="cockpit-bottom-bar">
        <button className="cockpit-btn" onClick={handleLoad}>LOAD FILE</button>
        <button className={`cockpit-btn${audio.isPlaying ? ' active' : ''}`} onClick={audio.play}>PLAY</button>
        <button className="cockpit-btn" onClick={audio.pause}>PAUSE</button>
        <button className="cockpit-btn" onClick={audio.stop}>STOP</button>
        <span className="cockpit-time">{fmt(audio.currentTime)}</span>
        <span className="cockpit-time cockpit-time--dim">{audio.duration > 0 ? fmt(audio.duration) : '--:--'}</span>
        <span className={`project-status ${persistence.projectName !== 'Untitled' ? 'project-status--saved' : 'project-status--unsaved'}`}>
          {persistence.statusText}
        </span>
        <span className="cockpit-vol-label">MAIN VOLUME</span>
        <WaveformSlider analyser={analyser} volume={volume} onVolumeChange={handleVolume} />
      </div>

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
