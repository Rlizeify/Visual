import { useEffect, useRef } from 'react'

// 80s-anime / JDM groovy wave background. Ported verbatim from the desktop Hub
// splash (legacy/desktop/apps/desktop/src/components/hub/HubApp.tsx → WaveCanvas).
// Pure 2D canvas; no external assets. Pauses when tab is hidden.
const PALETTE = [
  '#1a0035', '#00897b', '#c2185b', '#0d0030',
  '#4a0080', '#1a0035', '#00897b', '#0d0030',
]

export default function GroovyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let paused = document.hidden

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const draw = (t: number) => {
      if (paused) {
        animId = requestAnimationFrame(draw)
        return
      }
      const W = window.innerWidth
      const H = window.innerHeight
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#05000f'
      ctx.fillRect(0, 0, W, H)

      const bandCount = PALETTE.length
      const segments = 6
      for (let i = 0; i < bandCount; i++) {
        const baseY = (H / (bandCount + 1)) * (i + 1)
        const phase = t * 0.0003 + i * 0.8
        const amp = 40 + Math.sin(t * 0.0002 + i) * 20

        const points: { x: number; y: number }[] = []
        for (let s = 0; s <= segments; s++) {
          const x = (W / segments) * s
          const y = baseY
            + Math.sin(phase + x * 0.003) * amp
            + Math.cos(phase * 0.7 + x * 0.002) * amp * 0.5
          points.push({ x, y })
        }

        ctx.beginPath()
        ctx.moveTo(0, H)
        ctx.bezierCurveTo(0, H - amp * 0.3, 0, points[0].y + amp * 0.2, 0, points[0].y)

        for (let j = 0; j < points.length - 1; j++) {
          const p0 = points[j]
          const p1 = points[j + 1]
          const dx = p1.x - p0.x
          const cp1x = p0.x + dx / 3
          const cp2x = p0.x + (dx * 2) / 3
          const cp1y = p0.y + Math.sin(phase + cp1x * 0.004) * amp * 0.3
          const cp2y = p1.y - Math.cos(phase * 0.6 + cp2x * 0.003) * amp * 0.3
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y)
        }

        const lastPt = points[points.length - 1]
        ctx.bezierCurveTo(W, lastPt.y + amp * 0.2, W, H - amp * 0.1, W, H)
        const bottomSag = Math.sin(phase * 1.3) * 15 + 10
        ctx.bezierCurveTo(W * 0.66, H + bottomSag, W * 0.33, H + bottomSag * 0.7, 0, H)
        ctx.closePath()
        ctx.globalAlpha = 0.7
        ctx.fillStyle = PALETTE[i]
        ctx.fill()
      }

      ctx.globalAlpha = 1
      const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      animId = requestAnimationFrame(draw)
    }

    const onVisibility = () => { paused = document.hidden }

    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  )
}
