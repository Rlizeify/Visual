import { useState } from 'react'

interface BottomBarProps {
  fileName?: string
}

type OutputMode = 'COCKPIT' | 'CRT' | 'BOTH'

export default function BottomBar({ fileName }: BottomBarProps) {
  const [volume, setVolume] = useState(80)
  const [output, setOutput] = useState<OutputMode>('COCKPIT')

  return (
    <div className="bottom-bar panel">
      {/* File info */}
      <div className="file-info">
        {fileName ? (
          <>
            <span>{fileName}</span>
            <span>FORMAT: MP3 &nbsp;|&nbsp; DURATION: --:-- &nbsp;|&nbsp; SR: 44100 Hz</span>
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
