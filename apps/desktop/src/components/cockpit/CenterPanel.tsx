import type { ReactNode } from 'react'
import { Tooltip } from '../shared'

interface CenterPanelProps {
  isPlaying: boolean
  isLoaded: boolean
  currentTime: number
  duration: number
  bpm: number | null
  detectedKey: string | null
  onLoad: () => void
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (seconds: number) => void
  waveformSlot?: ReactNode
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function CenterPanel({
  isPlaying,
  isLoaded,
  currentTime,
  duration,
  bpm,
  detectedKey,
  onLoad,
  onPlay,
  onPause,
  onStop,
  onSeek,
  waveformSlot,
}: CenterPanelProps) {
  const buttons = [
    { id: 'load', label: 'LOAD', onClick: onLoad, active: false, tipText: 'LOAD TRACK', tipDetail: 'Open a file dialog to load an MP3 file into the active deck' },
    { id: 'play', label: 'PLAY', onClick: onPlay, active: isPlaying, tipText: 'PLAY', tipDetail: 'Start playback of the loaded track' },
    {
      id: 'pause',
      label: 'PAUS',
      onClick: onPause,
      active: !isPlaying && isLoaded && currentTime > 0,
      tipText: 'PAUSE',
      tipDetail: 'Pause playback. Resume with PLAY.',
    },
    {
      id: 'stop',
      label: 'STOP',
      onClick: onStop,
      active: !isPlaying && currentTime === 0,
      tipText: 'STOP',
      tipDetail: 'Stop playback and return to the beginning',
    },
  ] as const

  return (
    <div className="center-panel">
      {/* WAVEFORM / OSCILLOSCOPE */}
      <div className="panel waveform-section">
        {waveformSlot ?? (
          <>
            <span className="waveform-label">WAVEFORM</span>
            <div className="waveform-canvas">
              <div className="waveform-line" />
            </div>
          </>
        )}
      </div>

      {/* TRANSPORT + TIMELINE + BPM */}
      <div className="panel transport-section">
        {/* Transport buttons */}
        <div className="transport-controls">
          {buttons.map(({ id, label, onClick, active, tipText, tipDetail }) => (
            <Tooltip key={id} text={tipText} detail={tipDetail}>
              <div className="transport-btn-wrap">
                <div className={`btn-indicator ${active ? 'active' : ''}`} />
                <button className={`cockpit-btn btn-${id}`} onClick={onClick}>
                  {label}
                </button>
              </div>
            </Tooltip>
          ))}
        </div>

        {/* Timeline scrubber */}
        <div className="timeline-wrap">
          <span className="timeline-time">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="timeline-slider"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
          />
          <span className="timeline-time end">
            {duration > 0 ? formatTime(duration) : '--:--'}
          </span>
        </div>

        {/* BPM + KEY */}
        <div className="bpm-key-row">
          <Tooltip text="BPM" detail="Detected beats per minute of the playing track">
            <div className="bpm-display">
              <span className="bpm-label">BPM</span>
              <span className="bpm-value">{bpm !== null ? `${bpm}` : '---'}</span>
            </div>
          </Tooltip>
          <Tooltip text="KEY" detail="Estimated musical key of the playing track">
            <div className="key-display">
              <span className="key-label">KEY</span>
              <span className="key-value">{detectedKey ?? '--'}</span>
            </div>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
