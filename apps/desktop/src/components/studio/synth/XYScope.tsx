import React, { useRef, useEffect } from 'react'

interface XYScopeProps {
  analyser: AnalyserNode | null
  color?: string
  glowColor?: string
}

/**
 * Lissajous XY oscilloscope.
 * X = left channel, Y = right channel. Mono signals produce a diagonal line.
 */
export default function XYScope({
  analyser,
  color = '#ff2d9b',
  glowColor = 'rgba(255,45,155,0.35)',
}: XYScopeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const splitterRef = useRef<ChannelSplitterNode | null>(null)
  const analyserLRef = useRef<AnalyserNode | null>(null)
  const analyserRRef = useRef<AnalyserNode | null>(null)

  // Create per-channel analysers from the mono/stereo analyser
  useEffect(() => {
    if (!analyser) {
      analyserLRef.current = null
      analyserRRef.current = null
      return
    }

    const ctx = analyser.context as AudioContext
    const splitter = ctx.createChannelSplitter(2)
    const aL = ctx.createAnalyser()
    const aR = ctx.createAnalyser()
    aL.fftSize = 1024
    aR.fftSize = 1024
    aL.smoothingTimeConstant = 0.6
    aR.smoothingTimeConstant = 0.6

    analyser.connect(splitter)
    splitter.connect(aL, 0)
    splitter.connect(aR, 1)

    splitterRef.current = splitter
    analyserLRef.current = aL
    analyserRRef.current = aR

    return () => {
      try { analyser.disconnect(splitter) } catch { /* */ }
      try { splitter.disconnect(aL) } catch { /* */ }
      try { splitter.disconnect(aR) } catch { /* */ }
    }
  }, [analyser])

  // Resize canvas
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

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return

    const bufL = new Float32Array(1024)
    const bufR = new Float32Array(1024)
    let running = true

    const draw = () => {
      if (!running) return
      const dpr = devicePixelRatio
      const W = canvas.width / dpr
      const H = canvas.height / dpr
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Fade trail
      ctx2d.fillStyle = 'rgba(0,0,0,0.15)'
      ctx2d.fillRect(0, 0, W, H)

      const aL = analyserLRef.current
      const aR = analyserRRef.current
      if (aL && aR) {
        aL.getFloatTimeDomainData(bufL)
        aR.getFloatTimeDomainData(bufR)
      }

      // Crosshair guides
      ctx2d.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx2d.lineWidth = 1
      ctx2d.beginPath()
      ctx2d.moveTo(W / 2, 0); ctx2d.lineTo(W / 2, H)
      ctx2d.moveTo(0, H / 2); ctx2d.lineTo(W, H / 2)
      ctx2d.stroke()

      if (!aL || !aR) {
        // Dot at center
        ctx2d.fillStyle = color
        ctx2d.beginPath()
        ctx2d.arc(W / 2, H / 2, 2, 0, Math.PI * 2)
        ctx2d.fill()
      } else {
        const len = bufL.length
        ctx2d.beginPath()
        for (let i = 0; i < len; i++) {
          const x = (0.5 + bufL[i] * 0.45) * W
          const y = (0.5 - bufR[i] * 0.45) * H
          if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y)
        }
        ctx2d.strokeStyle = color
        ctx2d.lineWidth = 1.5
        ctx2d.shadowBlur = 8
        ctx2d.shadowColor = glowColor
        ctx2d.stroke()
        ctx2d.shadowBlur = 0
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
    }
  }, [color, glowColor])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <span style={{
        fontFamily: 'monospace', fontSize: 9, color: '#666',
        letterSpacing: 2, padding: '4px 6px', flexShrink: 0,
      }}>
        OSCILLOSCOPE
      </span>
      <div
        ref={containerRef}
        style={{
          flex: 1, minHeight: 0, aspectRatio: '1', maxWidth: '100%',
          alignSelf: 'center', background: '#000', border: '1px solid #2a2a2a',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </div>
  )
}
