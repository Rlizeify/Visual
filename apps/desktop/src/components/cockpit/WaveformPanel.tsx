import { useState, useRef, useEffect, useCallback, type DragEvent } from 'react'

type WaveType = 'sine' | 'saw' | 'triangle' | 'square'

interface ActiveWave {
  type: WaveType
  amplitude: number
  frequency: number
  phase: number
}

const WAVE_SHAPES: { type: WaveType; label: string; path: string }[] = [
  { type: 'sine', label: 'SINE', path: 'M0,10 C5,0 10,0 15,10 C20,20 25,20 30,10 Q35,0 40,10' },
  { type: 'saw', label: 'SAW', path: 'M0,18 L13,2 L13,18 L26,2 L26,18 L40,2' },
  { type: 'triangle', label: 'TRI', path: 'M0,18 L10,2 L20,18 L30,2 L40,18' },
  { type: 'square', label: 'SQR', path: 'M0,18 L0,2 L10,2 L10,18 L20,18 L20,2 L30,2 L30,18 L40,18' },
]

function computeWave(type: WaveType, t: number, amplitude: number): number {
  const PI2 = Math.PI * 2
  switch (type) {
    case 'sine':
      return Math.sin(t) * amplitude
    case 'saw':
      return ((t % PI2 + PI2) % PI2 / Math.PI - 1) * amplitude
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(t)) * amplitude
    case 'square':
      return Math.sign(Math.sin(t)) * amplitude
  }
}

export default function WaveformPanel() {
  const [activeWaves, setActiveWaves] = useState<ActiveWave[]>([])
  const [visualOn, setVisualOn] = useState(false)
  const [audioOn, setAudioOn] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const animRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Match canvas internal size to display size
    const rect = canvas.getBoundingClientRect()
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width
      canvas.height = rect.height
    }

    const w = canvas.width
    const h = canvas.height
    const midY = h / 2

    ctx.clearRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = 'rgba(0,255,204,0.06)'
    ctx.lineWidth = 1
    for (let gy = 0; gy < h; gy += 20) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke()
    }
    for (let gx = 0; gx < w; gx += 30) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke()
    }

    // Waveform
    ctx.save()
    ctx.shadowBlur = 8
    ctx.shadowColor = '#00ffcc'
    ctx.strokeStyle = '#00ffcc'
    ctx.lineWidth = 2
    ctx.beginPath()

    const time = timeRef.current

    if (activeWaves.length === 0) {
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
    } else {
      for (let x = 0; x < w; x++) {
        let y = 0
        for (const wave of activeWaves) {
          const t = x * wave.frequency * 0.05 + wave.phase + time * 0.02
          y += computeWave(wave.type, t, wave.amplitude)
        }
        // Normalize: scale to fit canvas
        const maxAmp = activeWaves.reduce((s, w) => s + w.amplitude, 0)
        const norm = maxAmp > 0 ? y / maxAmp : 0
        const py = midY - norm * (midY * 0.8)
        if (x === 0) ctx.moveTo(x, py)
        else ctx.lineTo(x, py)
      }
    }
    ctx.stroke()
    ctx.restore()

    timeRef.current += 1
    animRef.current = requestAnimationFrame(draw)
  }, [activeWaves])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  const handleDragStart = (e: React.DragEvent, type: WaveType) => {
    e.dataTransfer.setData('wave-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('wave-type') as WaveType
    if (!type) return
    setActiveWaves(prev => [
      ...prev,
      { type, amplitude: 1, frequency: 1 + prev.length * 0.5, phase: prev.length * 0.7 },
    ])
  }

  const removeWave = (index: number) => {
    setActiveWaves(prev => prev.filter((_, i) => i !== index))
  }

  const handleVisualToggle = () => {
    setVisualOn(v => {
      console.log('[WaveformPanel] VISUAL toggle:', !v ? 'ON' : 'OFF')
      return !v
    })
  }

  const handleAudioToggle = () => {
    setAudioOn(v => {
      console.log('[WaveformPanel] AUDIO toggle:', !v ? 'ON' : 'OFF')
      return !v
    })
  }

  return (
    <div className="waveform-panel-root">
      {/* Wave shape picker + toggles row */}
      <div className="waveform-picker-row">
        <div className="wave-shapes-bar">
          {WAVE_SHAPES.map(s => (
            <div
              key={s.type}
              className="wave-shape-pill"
              draggable="true"
              onDragStart={e => handleDragStart(e, s.type)}
            >
              <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
                <path d={s.path} stroke="#ffb347" strokeWidth="1.5" fill="none" />
              </svg>
              <span className="wave-shape-label">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="waveform-toggles">
          <div className={`toggle-wrap${visualOn ? ' active' : ''}`} onClick={handleVisualToggle}>
            <div className="toggle-switch">
              <div className={`toggle-switch__lever ${visualOn ? 'on' : 'off'}`} />
              <div className={`toggle-switch__indicator ${visualOn ? 'on' : 'off'}`} />
            </div>
            <span className="toggle-label">VIS</span>
          </div>
          <div className={`toggle-wrap${audioOn ? ' active' : ''}`} onClick={handleAudioToggle}>
            <div className="toggle-switch">
              <div className={`toggle-switch__lever ${audioOn ? 'on' : 'off'}`} />
              <div className={`toggle-switch__indicator ${audioOn ? 'on' : 'off'}`} />
            </div>
            <span className="toggle-label">AUD</span>
          </div>
        </div>
      </div>

      {/* Canvas drop target */}
      <div
        className="waveform-canvas-wrap"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <span className="waveform-label">OSCILLOSCOPE</span>
        <canvas ref={canvasRef} className="waveform-osc-canvas" />
        {activeWaves.length === 0 && (
          <span className="waveform-drop-hint">drag wave shapes here</span>
        )}
      </div>

      {/* Active wave chips */}
      {activeWaves.length > 0 && (
        <div className="wave-chips">
          {activeWaves.map((w, i) => (
            <span key={i} className="wave-chip">
              {w.type.toUpperCase()}
              <button className="wave-chip__x" onClick={() => removeWave(i)}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
