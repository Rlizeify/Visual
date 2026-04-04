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
  amplitude: number
  frequency: number
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
  const [freq, setFreq] = useState(440)
  const [amp, setAmp] = useState(30)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef(0)
  const animRef = useRef<number>(0)

  // Dial drag refs
  const freqDragRef = useRef<{ startY: number; startVal: number } | null>(null)
  const ampDragRef = useRef<{ startY: number; startVal: number } | null>(null)

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

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('wave-type') as WaveType
    if (!type) return

    let synthId: string | undefined
    if (audioOn) {
      synthId = await synthEngine.addWave(TONE_TYPE_MAP[type], freq)
      // Apply current amplitude
      if (synthId) {
        synthEngine.setAmplitude(synthId, amp / 100)
      }
    }

    setActiveWaves(prev => [
      ...prev,
      {
        type,
        amplitude: 1,
        frequency: 1 + prev.length * 0.5,
        phase: prev.length * 0.7,
        synthId,
      },
    ])
  }

  const removeWave = (index: number) => {
    setActiveWaves(prev => {
      const wave = prev[index]
      if (wave?.synthId) {
        synthEngine.removeWave(wave.synthId)
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleVisualToggle = () => {
    setVisualOn(v => {
      console.log('[WaveformPanel] VISUAL toggle:', !v ? 'ON' : 'OFF')
      return !v
    })
  }

  const handleAudioToggle = () => {
    setAudioOn(prev => {
      const next = !prev
      console.log('[WaveformPanel] AUDIO toggle:', next ? 'ON' : 'OFF')
      if (next) {
        // Audio turning ON — add synth oscillators for all existing waves
        setActiveWaves(waves => {
          const updated = waves.map(w => {
            if (!w.synthId) {
              // Fire and forget — ensureStarted is called inside addWave
              synthEngine.addWave(TONE_TYPE_MAP[w.type], freq).then(id => {
                synthEngine.setAmplitude(id, amp / 100)
                setActiveWaves(cur =>
                  cur.map(cw => (cw === w ? { ...cw, synthId: id } : cw))
                )
              })
            }
            return w
          })
          return updated
        })
      } else {
        // Audio turning OFF — clear all synth oscillators
        synthEngine.clearAll()
        setActiveWaves(waves => waves.map(w => ({ ...w, synthId: undefined })))
      }
      return next
    })
  }

  // Update all active synth waves when freq changes
  useEffect(() => {
    for (const w of activeWaves) {
      if (w.synthId) {
        synthEngine.setFrequency(w.synthId, freq)
      }
    }
  }, [freq, activeWaves])

  // Update all active synth waves when amp changes
  useEffect(() => {
    for (const w of activeWaves) {
      if (w.synthId) {
        synthEngine.setAmplitude(w.synthId, amp / 100)
      }
    }
  }, [amp, activeWaves])

  // ── Dial mouse handlers ────────────────────────────────────────────────

  const handleFreqMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    freqDragRef.current = { startY: e.clientY, startVal: freq }
    const onMove = (ev: MouseEvent) => {
      if (!freqDragRef.current) return
      const delta = freqDragRef.current.startY - ev.clientY
      const newVal = clamp(freqDragRef.current.startVal + delta * 5, 80, 2000)
      setFreq(Math.round(newVal))
    }
    const onUp = () => {
      freqDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleAmpMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    ampDragRef.current = { startY: e.clientY, startVal: amp }
    const onMove = (ev: MouseEvent) => {
      if (!ampDragRef.current) return
      const delta = ampDragRef.current.startY - ev.clientY
      const newVal = clamp(ampDragRef.current.startVal + delta * 0.5, 0, 100)
      setAmp(Math.round(newVal))
    }
    const onUp = () => {
      ampDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Dial rotation helper: map value in [min,max] to degrees [-135, 135]
  const dialRotation = (val: number, min: number, max: number) => {
    const pct = (val - min) / (max - min)
    return -135 + pct * 270
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

      {/* Active wave chips — uniform size */}
      {activeWaves.length > 0 && (
        <div className="wave-chips">
          {activeWaves.map((w, i) => (
            <span
              key={i}
              className="wave-chip"
              style={{
                width: 120,
                height: 32,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                padding: '0 8px',
                flexShrink: 0,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {w.type.toUpperCase()}
              </span>
              <button className="wave-chip__x" onClick={() => removeWave(i)}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* FREQ + AMP dials */}
      <div
        style={{
          display: 'flex',
          gap: 18,
          justifyContent: 'center',
          marginTop: 8,
          userSelect: 'none',
        }}
      >
        {/* FREQ dial */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div
            onMouseDown={handleFreqMouseDown}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 38%, #2a2a2a 60%, #111 100%)',
              border: '2px solid #444',
              boxShadow: '0 0 6px rgba(0,255,204,0.15), inset 0 1px 3px rgba(0,0,0,0.5)',
              cursor: 'ns-resize',
              position: 'relative',
            }}
          >
            {/* Dial indicator notch */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 2,
                height: 16,
                background: '#00ffcc',
                borderRadius: 1,
                transformOrigin: '50% 0%',
                transform: `translate(-50%, 0) rotate(${dialRotation(freq, 80, 2000)}deg)`,
                boxShadow: '0 0 4px #00ffcc',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 9,
              color: '#00ffcc',
              letterSpacing: 1.5,
              fontFamily: 'monospace',
              textTransform: 'uppercase',
            }}
          >
            FREQ
          </span>
          <span style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>
            {freq}Hz
          </span>
        </div>

        {/* AMP dial */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div
            onMouseDown={handleAmpMouseDown}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 38%, #2a2a2a 60%, #111 100%)',
              border: '2px solid #444',
              boxShadow: '0 0 6px rgba(0,255,204,0.15), inset 0 1px 3px rgba(0,0,0,0.5)',
              cursor: 'ns-resize',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 2,
                height: 16,
                background: '#00ffcc',
                borderRadius: 1,
                transformOrigin: '50% 0%',
                transform: `translate(-50%, 0) rotate(${dialRotation(amp, 0, 100)}deg)`,
                boxShadow: '0 0 4px #00ffcc',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 9,
              color: '#00ffcc',
              letterSpacing: 1.5,
              fontFamily: 'monospace',
              textTransform: 'uppercase',
            }}
          >
            AMP
          </span>
          <span style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>
            {amp}%
          </span>
        </div>
      </div>
    </div>
  )
}
