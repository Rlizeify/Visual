import { useState, useRef } from 'react'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { PluginRack } from '../../plugins/PluginRack'
import { audioEngine } from '../../audio/AudioEngine'
import LJVScope from '../oscilloscope/LJVScope'
import Oscilloscope from './Oscilloscope'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function CockpitApp() {
  const audio = useAudioEngine()
  const [leftWidth, setLeftWidth] = useState(280)
  const [waveformPx, setWaveformPx] = useState<number | null>(null)
  const [volume, setVolume] = useState(80)
  const centerContentRef = useRef<HTMLDivElement>(null)

  const handleLoad = async () => {
    const filepath = await (window as any).api?.loadMp3()
    if (filepath) await audio.load(filepath)
  }

  const onLeftDividerMouseDown = (e: React.MouseEvent) => {
    const startX = e.clientX
    const startW = leftWidth
    const onMove = (ev: MouseEvent) => setLeftWidth(Math.max(180, startW + ev.clientX - startX))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onSplitDividerMouseDown = (e: React.MouseEvent) => {
    const container = centerContentRef.current
    if (!container) return
    const totalH = container.clientHeight - 4
    const startH = waveformPx ?? totalH / 2
    const startY = e.clientY
    const onMove = (ev: MouseEvent) => {
      setWaveformPx(Math.max(80, Math.min(totalH - 80, startH + ev.clientY - startY)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const analyser = audio.getAnalyserNode()

  return (
    <div className="cockpit-frame">

      {/* THREE-COLUMN BODY */}
      <div className="cockpit-columns">

        {/* LEFT SIDEBAR — plugin rack */}
        <div className="cockpit-left" style={{ width: leftWidth }}>
          <PluginRack chain={audioEngine.getPluginChain()} audioContext={audioEngine.getAudioContext()} />
        </div>

        {/* LEFT RESIZE DIVIDER */}
        <div className="cockpit-divider cockpit-divider--vertical" onMouseDown={onLeftDividerMouseDown} />

        {/* CENTER PANEL */}
        <div className="cockpit-center">
          <div className="cockpit-title-bar">
            <span>{audio.filename || 'NO FILE LOADED'}</span>
          </div>

          <div className="cockpit-center-content" ref={centerContentRef}>
            {/* WAVEFORM (top half) */}
            <div
              className="cockpit-waveform-pane"
              style={waveformPx != null ? { height: waveformPx, flexShrink: 0 } : { flex: 1 }}
            >
              <LJVScope analyser={analyser} color="#27e0e1" glowColor="rgba(39,224,225,0.35)" />
            </div>

            {/* CENTER SPLIT DIVIDER */}
            <div className="cockpit-divider cockpit-divider--horizontal" onMouseDown={onSplitDividerMouseDown} />

            {/* OSCILLOSCOPE (bottom half) */}
            <div className="cockpit-scope-pane">
              <Oscilloscope analyser={analyser} />
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR — reserved for DJ decks */}
        <div className="cockpit-right" />

      </div>

      {/* BOTTOM BAR */}
      <div className="cockpit-bottom-bar">
        <button className="cockpit-btn" onClick={handleLoad}>LOAD FILE</button>
        <button className={`cockpit-btn${audio.isPlaying ? ' active' : ''}`} onClick={audio.play}>PLAY</button>
        <button className="cockpit-btn" onClick={audio.pause}>PAUSE</button>
        <button className="cockpit-btn" onClick={audio.stop}>STOP</button>
        <span className="cockpit-time">{formatTime(audio.currentTime)}</span>
        <span className="cockpit-time cockpit-time--dim">
          {audio.duration > 0 ? formatTime(audio.duration) : '--:--'}
        </span>
        <span className="cockpit-vol-label">MASTER VOL</span>
        <input
          type="range"
          className="throttle-slider"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVolume(v)
            audio.setMasterVolume(v)
          }}
        />
      </div>

    </div>
  )
}
