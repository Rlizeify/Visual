import { useState } from 'react'

interface BottomBarProps {
  fileName?: string
  duration?: number
}

type OutputMode = 'COCKPIT' | 'CRT' | 'BOTH'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function BottomBar({ fileName, duration = 0 }: BottomBarProps) {
  const [volume, setVolume] = useState(80)
  const [output, setOutput] = useState<OutputMode>('COCKPIT')

  const durationStr = duration > 0 ? formatDuration(duration) : '--:--'

  return (
    <div className="bottom-bar panel">
      {/* File info */}
      <div className="file-info">
        {fileName ? (
          <>
            <span>{fileName}</span>
            <span>FORMAT: MP3 &nbsp;|&nbsp; DURATION: {durationStr} &nbsp;|&nbsp; SR: 44100 Hz</span>
          </>
        ) : (
          <>
            <span>NO FILE LOADED</span>
            <span>FORMAT: --- &nbsp;|&nbsp; DURATION: --:-- &nbsp;|&nbsp; SR: ------</span>
          </>
        )}
      </div>

      {/* Master volume throttle */}
      <div className="throttle-wrap">
        <span className="throttle-label">MASTER VOL</span>
        <input
          type="range"
          className="throttle-slider"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
        <span className="dial__value" style={{ minWidth: 32, textAlign: 'right' }}>{volume}</span>
      </div>

      {/* Output selector */}
      <div className="output-selector">
        {(['COCKPIT', 'CRT', 'BOTH'] as OutputMode[]).map((mode) => (
          <button
            key={mode}
            className={`output-btn ${output === mode ? 'active' : ''}`}
            onClick={() => setOutput(mode)}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  )
}
