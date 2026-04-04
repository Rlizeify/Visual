import { useState } from 'react'

declare global {
  interface Window {
    api?: {
      loadMp3: () => Promise<string | null>
      play: () => Promise<void>
      pause: () => Promise<void>
      stop: () => Promise<void>
      pushToDisplay: (data: unknown) => Promise<void>
    }
  }
}

interface CenterPanelProps {
  onTrackLoaded: (name: string) => void
}

type Transport = 'stopped' | 'playing' | 'paused'

export default function CenterPanel({ onTrackLoaded }: CenterPanelProps) {
  const [transport, setTransport] = useState<Transport>('stopped')
  const [timeline, setTimeline] = useState(0)

  const handleLoad = async () => {
    const path = await window.api?.loadMp3()
    if (path) {
      const name = path.split(/[\\/]/).pop() ?? path
      onTrackLoaded(name)
      console.log('[VISUAL] Loaded:', path)
    }
  }

  const handlePlay = async () => {
    setTransport('playing')
    await window.api?.play()
  }

  const handlePause = async () => {
    setTransport('paused')
    await window.api?.pause()
  }

  const handleStop = async () => {
    setTransport('stopped')
    await window.api?.stop()
  }

  return (
    <div className="center-panel">
      {/* WAVEFORM */}
      <div className="panel waveform-section">
        <span className="waveform-label">WAVEFORM</span>
        <div className="waveform-canvas">
          <div className="waveform-line" />
        </div>
      </div>

      {/* TRANSPORT + TIMELINE + BPM */}
      <div className="panel transport-section">
        {/* Transport buttons */}
        <div className="transport-controls">
          {(
            [
              { id: 'load',  label: 'LOAD',  onClick: handleLoad,  active: false },
              { id: 'play',  label: 'PLAY',  onClick: handlePlay,  active: transport === 'playing' },
              { id: 'pause', label: 'PAUS',  onClick: handlePause, active: transport === 'paused' },
              { id: 'stop',  label: 'STOP',  onClick: handleStop,  active: transport === 'stopped' },
            ] as const
          ).map(({ id, label, onClick, active }) => (
            <div key={id} className="transport-btn-wrap">
              <div className={`btn-indicator ${active ? 'active' : ''}`} />
              <button
                className={`cockpit-btn btn-${id}`}
                onClick={onClick}
              >
                {label}
              </button>
            </div>
          ))}
        </div>

        {/* Timeline scrubber */}
        <div className="timeline-wrap">
          <span className="timeline-time">0:00</span>
          <input
            type="range"
            className="timeline-slider"
            min={0}
            max={100}
            value={timeline}
            onChange={(e) => setTimeline(Number(e.target.value))}
          />
          <span className="timeline-time end">--:--</span>
        </div>

        {/* BPM + KEY */}
        <div className="bpm-key-row">
          <div className="bpm-display">
            <span className="bpm-label">BPM</span>
            <span className="bpm-value">---</span>
          </div>
          <div className="key-display">
            <span className="key-label">KEY</span>
            <span className="key-value">--</span>
          </div>
        </div>
      </div>
    </div>
  )
}
