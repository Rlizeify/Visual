import { useState } from 'react'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { PluginRack } from '../../plugins/PluginRack'
import { audioEngine } from '../../audio/AudioEngine'
import VisualizerPreview from './VisualizerPreview'
import VisualizerControls from './VisualizerControls'
import WaveformSlider from './WaveformSlider'

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

  const handleLoad = async () => {
    const fp = await (window as any).api?.loadMp3()
    if (fp) await audio.load(fp)
  }

  const handleVolume = (v: number) => {
    setVolume(v)
    audio.setMasterVolume(v)
  }

  const analyser = audio.getAnalyserNode()

  return (
    <div className="cockpit-frame">

      {/* TWO-COLUMN BODY */}
      <div className="cockpit-columns">

        {/* LEFT SIDEBAR — plugin rack */}
        <div className="cockpit-left" style={{ width: 260, minWidth: 260, maxWidth: 260, overflow: 'hidden', position: 'relative' }}>
          <PluginRack chain={audioEngine.getPluginChain()} audioContext={audioEngine.getAudioContext()} />
        </div>

        {/* MAIN 2×2 GRID */}
        <div className="cockpit-main">

          {/* TOP LEFT — VIDEO FILES */}
          <div className="cockpit-panel">
            <span className="cockpit-panel__title">VIDEO FILES</span>
          </div>

          {/* TOP RIGHT — VIDEO PREVIEW */}
          <div className="cockpit-panel">
            <span className="cockpit-panel__title">VIDEO PREVIEW</span>
          </div>

          {/* BOTTOM LEFT — VISUALIZER CONTROLS */}
          <div className="cockpit-panel">
            <span className="cockpit-panel__title">VISUALIZER</span>
            <VisualizerControls
              selectedPreset={selectedPreset}
              blendTime={blendTime}
              cycleSpeed={cycleSpeed}
              bassReactivity={bassReactivity}
              midReactivity={midReactivity}
              highReactivity={highReactivity}
              onPresetChange={setSelectedPreset}
              onBlendTime={setBlendTime}
              onCycleSpeed={setCycleSpeed}
              onBass={setBass}
              onMid={setMid}
              onHigh={setHigh}
            />
          </div>

          {/* BOTTOM RIGHT — BUTTERCHURN PREVIEW */}
          <div className="cockpit-panel">
            <VisualizerPreview
              analyser={analyser}
              selectedPreset={selectedPreset}
              blendTime={blendTime}
              cycleSpeed={cycleSpeed}
            />
          </div>

        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="cockpit-bottom-bar">
        <button className="cockpit-btn" onClick={handleLoad}>LOAD FILE</button>
        <button className={`cockpit-btn${audio.isPlaying ? ' active' : ''}`} onClick={audio.play}>PLAY</button>
        <button className="cockpit-btn" onClick={audio.pause}>PAUSE</button>
        <button className="cockpit-btn" onClick={audio.stop}>STOP</button>
        <span className="cockpit-time">{fmt(audio.currentTime)}</span>
        <span className="cockpit-time cockpit-time--dim">{audio.duration > 0 ? fmt(audio.duration) : '--:--'}</span>
        <span className="cockpit-vol-label">MASTER VOL</span>
        <WaveformSlider analyser={analyser} volume={volume} onVolumeChange={handleVolume} />
      </div>

    </div>
  )
}
