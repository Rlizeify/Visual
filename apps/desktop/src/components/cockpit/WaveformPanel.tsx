import { useState, useRef, useEffect, useCallback, type DragEvent } from 'react'
import { synthEngine } from '../../audio/SynthEngine'

type WaveType = 'sine' | 'saw' | 'triangle' | 'square'

// Map panel wave types to Tone.js oscillator types
const TONE_TYPE_MAP: Record<WaveType, 'sine' | 'sawtooth' | 'triangle' | 'square'> = {
  sine: 'sine',
  saw: 'sawtooth',
  triangle: 'triangle',
  square: 'square',
}

interface ActiveWave {
  type: WaveType
  amplitude: number   // 0-100 (percent for display, /100 for synth)
  frequency: number   // hz 40-2000
  phase: number
  synthId?: string
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

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export default function WaveformPanel() {
  const [activeWaves, setActiveWaves] = useState<ActiveWave[]>([])
  const [visualOn, setVisualOn] = useState(false)
  const [audioOn, setAudioOn] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const animRef = useRef<number>(0)
  const activeWavesRef = useRef<ActiveWave[]>([])

  // Keep ref in sync for animation loop
  useEffect(() => {
    activeWavesRef.current = activeWaves
  }, [activeWaves])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

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
    ctx.strokeStyle = 'rgba(39,224,225,0.06)'
    ctx.lineWidth = 1
    for (let gy = 0; gy < h; gy += 20) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke()
    }
    for (let gx = 0; gx < w; gx += 30) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke()
    }

    // Datum lines — drawn before waveform so they appear behind
    // 25% and 75% reference lines
    ctx.save()
    ctx.strokeStyle = 'rgba(39,224,225,0.15)'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 12])
    ctx.beginPath()
    ctx.moveTo(0, h * 0.25)
    ctx.lineTo(w, h * 0.25)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, h * 0.75)
    ctx.lineTo(w, h * 0.75)
    ctx.stroke()
    ctx.restore()

    // Center datum line
    ctx.save()
    ctx.strokeStyle = 'rgba(39,224,225,0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 8])
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()
    ctx.restore()

    // Waveform — read from ref for latest values
    const waves = activeWavesRef.current

    ctx.save()
    ctx.shadowBlur = 8
    ctx.shadowColor = '#27e0e1'
    ctx.strokeStyle = '#27e0e1'
    ctx.lineWidth = 2
    ctx.beginPath()

    const time = timeRef.current

    if (waves.length === 0) {
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
    } else {
      for (let x = 0; x < w; x++) {
        let y = 0
        for (const wave of waves) {
          // Use per-wave frequency and amplitude
          const freqScale = wave.frequency / 440
          const ampScale = wave.amplitude / 100
          const t = x * freqScale * 0.05 + wave.phase + time * 0.02
          y += computeWave(wave.type, t, ampScale)
        }
        const maxAmp = waves.reduce((s, wv) => s + wv.amplitude / 100, 0)
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
  }, [])

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

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('wave-type') as WaveType
    if (!type) return

    const defaultFreq = 440
    const defaultAmp = 30

    let synthId: string | undefined
    if (audioOn) {
      synthId = await synthEngine.addWave(TONE_TYPE_MAP[type], defaultFreq)
      if (synthId) {
        synthEngine.setAmplitude(synthId, defaultAmp / 100)
      }
    }

    setActiveWaves(prev => [
      ...prev,
      {
        type,
        amplitude: defaultAmp,
        frequency: defaultFreq,
        phase: prev.length * 0.7,
        synthId,
      },
    ])
  }

  const removeWave = (index: number) => {
    const wave = activeWavesRef.current[index]
    if (wave?.synthId) synthEngine.removeWave(wave.synthId)
    setActiveWaves(prev => prev.filter((_, i) => i !== index))
  }

  const handleVisualToggle = () => {
    setVisualOn(v => !v)
  }

  const handleAudioToggle = async () => {
    if (audioOn) {
      // Turning OFF — clear everything cleanly
      synthEngine.clearAll()
      setActiveWaves(waves => waves.map(w => ({ ...w, synthId: undefined })))
      setAudioOn(false)
    } else {
      // Turning ON — create oscillators sequentially, await each one
      // Build new waves array with synthIds before setting state
      const currentWaves = activeWavesRef.current
      const newWaves = await Promise.all(
        currentWaves.map(async (w) => {
          const id = await synthEngine.addWave(TONE_TYPE_MAP[w.type], w.frequency)
          synthEngine.setAmplitude(id, w.amplitude / 100)
          return { ...w, synthId: id }
        })
      )
      setActiveWaves(newWaves)
      setAudioOn(true)
    }
  }

  // Per-wave frequency change
  const handleWaveFreqChange = (index: number, newFreq: number) => {
    const wave = activeWavesRef.current[index]
    if (!wave) return
    if (wave.synthId) {
      synthEngine.setFrequency(wave.synthId, newFreq)
    }
    setActiveWaves(prev =>
      prev.map((w, i) => i === index ? { ...w, frequency: newFreq } : w)
    )
  }

  // Per-wave amplitude change
  const handleWaveAmpChange = (index: number, newAmp: number) => {
    const wave = activeWavesRef.current[index]
    if (!wave) return
    if (wave.synthId) {
      synthEngine.setAmplitude(wave.synthId, newAmp / 100)
    }
    setActiveWaves(prev =>
      prev.map((w, i) => i === index ? { ...w, amplitude: newAmp } : w)
    )
  }

  // Chip freq drag handler
  const handleChipFreqDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startVal = activeWaves[index]?.frequency ?? 440
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY
      const newVal = clamp(Math.round(startVal + delta * 0.8), 40, 2000)
      handleWaveFreqChange(index, newVal)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Chip amp drag handler
  const handleChipAmpDrag = (index: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startVal = activeWaves[index]?.amplitude ?? 30
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY
      const newVal = clamp(Math.round(startVal + delta * 0.15), 0, 100)
      handleWaveAmpChange(index, newVal)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="waveform-panel-root"
      style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
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
                <path d={s.path} stroke="#eea91c" strokeWidth="1.5" fill="none" />
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

      {/* Canvas drop target — flex:1 fills remaining space */}
      <div
        className="waveform-canvas-wrap"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}
      >
        <span className="waveform-label">OSCILLOSCOPE</span>
        <canvas ref={canvasRef} className="waveform-osc-canvas" />
        {activeWaves.length === 0 && (
          <span className="waveform-drop-hint">drag wave shapes here</span>
        )}
      </div>

      {/* Active wave chips with per-wave inline controls */}
      {activeWaves.length > 0 && (
        <div
          className="wave-chips"
          style={{
            maxHeight: 48,
            overflowX: 'auto',
            overflowY: 'hidden',
            flexWrap: 'nowrap',
            display: 'flex',
            gap: 6,
            padding: '4px 0',
            flexShrink: 0,
          }}
        >
          {activeWaves.map((w, i) => (
            <span
              key={i}
              className="wave-chip"
              style={{
                width: 200,
                minWidth: 200,
                height: 36,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                boxSizing: 'border-box',
                padding: '0 6px',
                flexShrink: 0,
                gap: 6,
              }}
            >
              {/* Wave type label */}
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'Rajdhani, monospace',
                  color: '#eea91c',
                  fontWeight: 600,
                  minWidth: 32,
                }}
              >
                {w.type === 'saw' ? 'SAW' : w.type === 'triangle' ? 'TRI' : w.type === 'square' ? 'SQR' : 'SINE'}
              </span>

              {/* Frequency control */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'ns-resize',
                  userSelect: 'none',
                  lineHeight: 1,
                }}
                onMouseDown={e => handleChipFreqDrag(i, e)}
              >
                <span style={{ fontSize: 7, color: '#87150a', fontFamily: 'monospace' }}>F</span>
                <span style={{ fontSize: 10, color: '#27e0e1', fontFamily: 'monospace' }}>
                  {w.frequency}
                </span>
              </div>

              {/* Amplitude control — vertical bar */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'ns-resize',
                  userSelect: 'none',
                  lineHeight: 1,
                }}
                onMouseDown={e => handleChipAmpDrag(i, e)}
              >
                <span style={{ fontSize: 7, color: '#87150a', fontFamily: 'monospace' }}>A</span>
                <div
                  style={{
                    width: 8,
                    height: 18,
                    background: '#010103',
                    borderRadius: 2,
                    border: '1px solid #7a0105',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      height: `${w.amplitude}%`,
                      background: '#27e0e1',
                      borderRadius: 1,
                    }}
                  />
                </div>
              </div>

              {/* Remove button */}
              <button
                className="wave-chip__x"
                onClick={() => removeWave(i)}
                style={{ marginLeft: 'auto', flexShrink: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
