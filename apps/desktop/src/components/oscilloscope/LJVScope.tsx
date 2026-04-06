import React, { useRef, useEffect } from 'react'

interface LJVScopeProps {
  analyser: AnalyserNode | AudioNode | null
  color?: string
  glowColor?: string
  lineWidth?: number
}

/**
 * Canvas-based 2D waveform oscilloscope inspired by LJV.
 * Accepts an AnalyserNode (or any AudioNode) and renders the time-domain
 * waveform into a <canvas> that fills its container.
 */
const LJVScope: React.FC<LJVScopeProps> = ({
  analyser,
  color = '#00ffcc',
  glowColor = 'rgba(0,255,204,0.35)',
  lineWidth = 2,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const analyserNodeRef = useRef<AnalyserNode | null>(null)
  const dataRef = useRef<Float32Array<ArrayBuffer>>(new Float32Array(0))

  // Resolve an AnalyserNode from the prop (which may be a generic AudioNode)
  useEffect(() => {
    if (!analyser) {
      analyserNodeRef.current = null
      return
    }

    if (analyser instanceof AnalyserNode) {
      analyserNodeRef.current = analyser
    } else {
      // Wrap a generic AudioNode by connecting it to a private AnalyserNode
      const ctx = (analyser as AudioNode).context as AudioContext
      const an = ctx.createAnalyser()
      an.fftSize = 2048
      an.smoothingTimeConstant = 0.8
      analyser.connect(an)
      analyserNodeRef.current = an

      return () => {
        try { analyser.disconnect(an) } catch { /* already disconnected */ }
      }
    }
  }, [analyser])

  // Resize canvas to match container via ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const dpr = devicePixelRatio
        canvas.width = width * dpr
        canvas.height = height * dpr
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const draw = () => {
      if (!running) return
      const dpr = devicePixelRatio
      const W = canvas.width / dpr
      const H = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const an = analyserNodeRef.current
      if (an) {
        // Ensure data buffer is correct size
        if (dataRef.current.length !== an.fftSize) {
          dataRef.current = new Float32Array(an.fftSize)
        }
        an.getFloatTimeDomainData(dataRef.current)
      }

      const td = dataRef.current
      const len = td.length

      // Datum lines
      ctx.setLineDash([4, 8])
      ctx.strokeStyle = 'rgba(0,207,255,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
      ctx.setLineDash([2, 12])
      ctx.strokeStyle = 'rgba(0,207,255,0.1)'
      ctx.beginPath(); ctx.moveTo(0, H / 4); ctx.lineTo(W, H / 4); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, H * 3 / 4); ctx.lineTo(W, H * 3 / 4); ctx.stroke()
      ctx.setLineDash([])

      if (!an || len === 0) {
        // Flat line when no data
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
      } else {
        // Main waveform stroke
        ctx.beginPath()
        for (let i = 0; i < len; i++) {
          const x = (i / len) * W
          const y = (0.5 - td[i] * 0.45) * H
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.shadowBlur = 10
        ctx.shadowColor = glowColor
        ctx.stroke()

        // Phosphor / afterglow pass
        ctx.beginPath()
        for (let i = 0; i < len; i++) {
          const x = (i / len) * W
          const y = (0.5 - td[i] * 0.45) * H + 1
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.25
        ctx.shadowBlur = 0
        ctx.stroke()
        ctx.globalAlpha = 1.0
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
    }
  }, [color, glowColor, lineWidth])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}

export default LJVScope
