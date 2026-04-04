import React, { useRef, useEffect, useCallback } from 'react'
import type { OscilloscopeDataProps, OscilloscopeMode } from './types'

interface Props extends OscilloscopeDataProps {
  onModeChange?: (mode: OscilloscopeMode) => void
}

const MODES: OscilloscopeMode[] = ['TIME', 'XY', 'XYZ']

function parseBaseHue(color: string): number {
  if (color.startsWith('hsl')) {
    const m = color.match(/hsl\w*\(\s*([\d.]+)/)
    if (m) return parseFloat(m[1])
  }
  return 190
}

const Oscilloscope: React.FC<Props> = ({
  mode,
  timeData,
  xData,
  yData,
  xData3,
  yData3,
  zData3,
  color = '#00cfff',
  glowColor = '#00cfff',
  showGrid = false,
  autoRotate = false,
  onModeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const rotationRef = useRef({ x: 0.3, y: 0 })
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const autoRotatePaused = useRef(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Store latest props in refs for animation loop
  const propsRef = useRef<Props>({
    mode, timeData, xData, yData, xData3, yData3, zData3,
    color, glowColor, showGrid, autoRotate,
  })
  propsRef.current = {
    mode, timeData, xData, yData, xData3, yData3, zData3,
    color, glowColor, showGrid, autoRotate,
  }

  const renderTime = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const { timeData: td, color: c, glowColor: gc, showGrid: sg } = propsRef.current
    ctx.clearRect(0, 0, W, H)

    if (sg) {
      ctx.strokeStyle = 'rgba(0,207,255,0.06)'
      ctx.lineWidth = 1
      for (let i = 1; i < 8; i++) {
        const x = (i / 8) * W
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let i = 1; i < 6; i++) {
        const y = (i / 6) * H
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(0,207,255,0.12)'
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
    }

    // Datum lines
    ctx.setLineDash([4, 8])
    ctx.strokeStyle = 'rgba(0,207,255,0.25)'
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
    ctx.setLineDash([2, 12])
    ctx.strokeStyle = 'rgba(0,207,255,0.1)'
    ctx.beginPath(); ctx.moveTo(0, H / 4); ctx.lineTo(W, H / 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, H * 3 / 4); ctx.lineTo(W, H * 3 / 4); ctx.stroke()
    ctx.setLineDash([])

    if (!td || td.length === 0) {
      ctx.strokeStyle = c!
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
      return
    }

    // Waveform
    ctx.beginPath()
    for (let i = 0; i < td.length; i++) {
      const x = (i / td.length) * W
      const y = (0.5 - td[i] * 0.45) * H
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = c!
    ctx.lineWidth = 2
    ctx.shadowBlur = 10
    ctx.shadowColor = gc!
    ctx.stroke()

    // Phosphor pass
    ctx.beginPath()
    for (let i = 0; i < td.length; i++) {
      const x = (i / td.length) * W
      const y = (0.5 - td[i] * 0.45) * H + 1
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.25
    ctx.shadowBlur = 0
    ctx.stroke()
    ctx.globalAlpha = 1.0
  }, [])

  const renderXY = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const { xData: xd, yData: yd, color: c, glowColor: gc } = propsRef.current

    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(0, 0, W, H)

    const cx = W / 2, cy = H / 2

    // Axis lines
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke()

    if (!xd || !yd || xd.length === 0) return

    const baseHue = parseBaseHue(c!)
    const len = Math.min(xd.length, yd.length)
    const segSize = 32

    ctx.shadowBlur = 8
    ctx.shadowColor = gc!
    ctx.lineWidth = 2

    for (let s = 0; s < len; s += segSize) {
      const end = Math.min(s + segSize + 1, len)
      const hue = baseHue + (s / len) * 60
      ctx.strokeStyle = `hsl(${hue}, 100%, 55%)`
      ctx.beginPath()
      for (let i = s; i < end; i++) {
        const px = cx + xd[i] * cx * 0.82
        const py = cy + yd[i] * cy * 0.82
        if (i === s) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    ctx.shadowBlur = 0
  }, [])

  const renderXYZ = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const { xData3: xd, yData3: yd, zData3: zd, color: c, glowColor: gc, autoRotate: ar } = propsRef.current

    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.fillRect(0, 0, W, H)

    const cx = W / 2, cy = H / 2

    if (!xd || !yd || !zd || xd.length === 0) {
      ctx.fillStyle = c!
      ctx.font = '14px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('NO DATA', cx, cy)
      return
    }

    const rotX = rotationRef.current.x
    const rotY = rotationRef.current.y
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY)
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX)

    const len = Math.min(xd.length, yd.length, zd.length)
    const segSize = 16

    // Project helper
    const project = (x3: number, y3: number, z3: number) => {
      const x2 = x3 * cosY - z3 * sinY
      const z2 = x3 * sinY + z3 * cosY
      const y2 = y3 * cosX - z2 * sinX
      const z3f = y3 * sinX + z2 * cosX
      const persp = 2.2 / (2.2 + z3f * 0.5)
      return {
        px: cx + x2 * persp * cx * 0.75,
        py: cy + y2 * persp * cy * 0.75,
        alpha: Math.max(0.1, Math.min(1.0, 0.4 + z3f * 0.3)),
      }
    }

    ctx.shadowBlur = 8
    ctx.shadowColor = gc!
    ctx.lineWidth = 2

    const baseHue = parseBaseHue(c!)

    for (let s = 0; s < len; s += segSize) {
      const end = Math.min(s + segSize + 1, len)
      const hue = baseHue + (s / len) * 360
      ctx.strokeStyle = `hsl(${hue}, 100%, 55%)`

      let alphaSum = 0
      let count = 0
      for (let i = s; i < end; i++) {
        const { alpha } = project(xd[i], yd[i], zd[i])
        alphaSum += alpha
        count++
      }
      ctx.globalAlpha = alphaSum / count

      ctx.beginPath()
      for (let i = s; i < end; i++) {
        const { px, py } = project(xd[i], yd[i], zd[i])
        if (i === s) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }

    ctx.globalAlpha = 1.0
    ctx.shadowBlur = 0

    // Reference sphere wireframe — 3 ellipses
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    const drawEllipse = (planeGen: (t: number) => [number, number, number]) => {
      ctx.beginPath()
      for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * Math.PI * 2
        const [ex, ey, ez] = planeGen(angle)
        const { px, py } = project(ex, ey, ez)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
    }
    drawEllipse((t) => [Math.cos(t), Math.sin(t), 0]) // XY
    drawEllipse((t) => [Math.cos(t), 0, Math.sin(t)]) // XZ
    drawEllipse((t) => [0, Math.cos(t), Math.sin(t)]) // YZ

    // Auto-rotate
    if (ar && !autoRotatePaused.current) {
      rotationRef.current.y += 0.004
    }
  }, [])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        canvas.width = width * devicePixelRatio
        canvas.height = height * devicePixelRatio
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)

    let running = true
    const frame = () => {
      if (!running) return
      const W = canvas.width / devicePixelRatio
      const H = canvas.height / devicePixelRatio
      if (W > 0 && H > 0) {
        const m = propsRef.current.mode
        if (m === 'TIME') renderTime(ctx, W, H)
        else if (m === 'XY') renderXY(ctx, W, H)
        else renderXYZ(ctx, W, H)
      }
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [renderTime, renderXY, renderXYZ])

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (propsRef.current.mode !== 'XYZ') return
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }

    rotationRef.current.y += dx * 0.008
    rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x + dy * 0.008))

    autoRotatePaused.current = true
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => { autoRotatePaused.current = false }, 2000)
  }, [])

  const handleMouseUp = useCallback(() => { isDragging.current = false }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div style={{
        position: 'absolute', top: 6, left: 6, display: 'flex', gap: 2,
        userSelect: 'none', pointerEvents: 'auto',
      }}>
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange?.(m)}
            style={{
              padding: '2px 7px',
              fontSize: 10,
              fontFamily: 'monospace',
              background: mode === m ? color : 'rgba(0,0,0,0.6)',
              color: mode === m ? '#000' : color,
              border: `1px solid ${color}`,
              borderRadius: 2,
              cursor: 'pointer',
              lineHeight: '14px',
            }}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

export default Oscilloscope
