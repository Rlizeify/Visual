import { memo, useEffect, useRef, type MutableRefObject } from 'react'
import type { OsciSettings } from './types'

// Legacy global produced by the old synthetic-music-data path in
// VisualizerEngine. The new pipeline reads tab audio directly via the
// shared AnalyserNode (see web/src/audio/audioSource.ts). This component
// is currently dormant — kept compiling for the day it's rewired.
declare global {
  interface Window {
    __musicData?: { loudness: number; beatPulse: number }
  }
}

interface ScopeCanvasProps {
  visible: boolean
  settingsRef: MutableRefObject<OsciSettings>
}

// Always mounted for zero-latency toggle. RAF loop reads settingsRef.current
// each frame — no re-render needed when settings change.
const ScopeCanvas = memo(function ScopeCanvas({ visible, settingsRef }: ScopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef({ phaseX: 0, prevBeatPulse: 0, rafId: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const ctx   = canvas.getContext('2d')!
    const state = stateRef.current

    // Pre-fill background so no flash on first reveal
    ctx.fillStyle = 'rgb(1,1,3)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const DEG   = Math.PI / 180
    const STEPS = 800

    const draw = () => {
      state.rafId = requestAnimationFrame(draw)

      const s = settingsRef.current
      const w = canvas.width
      const h = canvas.height
      const t = performance.now() / 1000

      // Phosphor persistence decay
      ctx.fillStyle = `rgba(1,1,3,${s.persistence})`
      ctx.fillRect(0, 0, w, h)

      const md         = window.__musicData
      const beatPulse  = md?.beatPulse ?? 0
      const loudness   = md?.loudness  ?? 0

      // Kick detection: rising edge → shift phaseX by beatKick degrees
      if (beatPulse > 0.8 && state.prevBeatPulse < 0.5) {
        state.phaseX += s.beatKick * DEG
      }
      state.prevBeatPulse = beatPulse

      const cx = w / 2
      const cy = h / 2
      const r  = Math.min(w, h) * 0.42

      // Thickness: base × loudness multiplier (0.5× at silence → 2× at peak)
      ctx.lineWidth   = s.thickness * (0.5 + 1.5 * Math.min(1, loudness))
      ctx.strokeStyle = s.color

      const phaseBase = s.phase * DEG
      const spinX     = t * s.spin
      const spinY     = t * s.spin * 0.6

      ctx.beginPath()
      for (let i = 0; i <= STEPS; i++) {
        const u = (i / STEPS) * Math.PI * 2
        const x = cx + r * Math.sin(s.freqX * u + spinX + state.phaseX + phaseBase)
        const y = cy + r * Math.sin(s.freqY * u + spinY)
        if (i === 0) ctx.moveTo(x, y)
        else         ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    state.rafId = requestAnimationFrame(draw)

    const handleResize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      ctx.fillStyle = 'rgb(1,1,3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(state.rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [settingsRef])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.6s ease',
      }}
    />
  )
})

export default ScopeCanvas
