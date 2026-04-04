import { useEffect, useRef } from 'react'

interface BeatPayload {
  bass: number
  mid: number
  high: number
  energy: number
  isPlaying: boolean
}

interface Blob {
  x: number
  y: number
  vx: number
  vy: number
  baseRadius: number
  color: string
  phase: number
  points: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

interface Ripple {
  radius: number
  opacity: number
  speed: number
}

interface Lightning {
  segments: { x: number; y: number }[]
  life: number
  maxLife: number
}

export default function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const beatRef = useRef<BeatPayload>({ bass: 0, mid: 0, high: 0, energy: 0, isPlaying: false })
  const stateRef = useRef<{
    blobs: Blob[]
    sparks: Spark[]
    ripples: Ripple[]
    lightnings: Lightning[]
    frame: number
    inited: boolean
  }>({ blobs: [], sparks: [], ripples: [], lightnings: [], frame: 0, inited: false })

  useEffect(() => {
    const api = (window as any).api
    if (api?.onBeatData) {
      api.onBeatData((data: BeatPayload) => {
        beatRef.current = data
      })
    }
    return () => {
      if (api?.removeBeatDataListeners) api.removeBeatDataListeners()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Init blobs
    const state = stateRef.current
    if (!state.inited) {
      const colors = ['#ff1a1a', '#ff2d9b', '#7b2fff', '#ff1a1a', '#ff2d9b', '#7b2fff', '#ff1a1a', '#ff2d9b']
      for (let i = 0; i < 8; i++) {
        state.blobs.push({
          x: Math.random() * 1200,
          y: Math.random() * 800,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          baseRadius: 80 + Math.random() * 70,
          color: colors[i],
          phase: Math.random() * Math.PI * 2,
          points: 6 + Math.floor(Math.random() * 3),
        })
      }
      state.inited = true
    }

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    function drawBlob(ctx: CanvasRenderingContext2D, blob: Blob, radius: number, time: number) {
      const pts = blob.points
      const angleStep = (Math.PI * 2) / pts
      ctx.beginPath()
      for (let i = 0; i <= pts; i++) {
        const angle = i * angleStep + blob.phase
        const wobble = Math.sin(time * 0.001 + i * 1.3 + blob.phase) * radius * 0.15
        const r = radius + wobble
        const x = blob.x + Math.cos(angle) * r
        const y = blob.y + Math.sin(angle) * r
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          const prevAngle = (i - 0.5) * angleStep + blob.phase
          const cpR = radius + Math.sin(time * 0.0013 + i * 0.9 + blob.phase) * radius * 0.2
          const cpx = blob.x + Math.cos(prevAngle) * cpR
          const cpy = blob.y + Math.sin(prevAngle) * cpR
          ctx.quadraticCurveTo(cpx, cpy, x, y)
        }
      }
      ctx.closePath()
    }

    function render(time: number) {
      const W = canvas!.width
      const H = canvas!.height
      const beat = beatRef.current
      const s = state
      s.frame++

      const intensity = beat.isPlaying ? 1.0 : 0.2

      // ── LAYER 1: Background fade + gradient ──
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1.0

      const breathe = Math.sin(time * 0.0005) * 0.5 + 0.5
      const e = beat.energy * intensity
      const innerR = lerp(0.05, 0.15, e) * Math.min(W, H)
      const outerR = Math.max(W, H) * 0.8
      const grad = ctx.createRadialGradient(W / 2, H / 2, innerR, W / 2, H / 2, outerR)

      const r1 = Math.round(lerp(13, 26, e * breathe))
      const g1 = Math.round(lerp(0, 0, e))
      const b1 = Math.round(lerp(32, 8, e))
      grad.addColorStop(0, `rgb(${r1},${g1},${b1})`)
      grad.addColorStop(1, '#000000')

      ctx.globalAlpha = 0.3
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1.0

      // ── LAYER 2: Lava blobs ──
      const bass = beat.bass * intensity
      for (const blob of s.blobs) {
        blob.x += blob.vx
        blob.y += blob.vy
        if (blob.x < 0 || blob.x > W) blob.vx *= -1
        if (blob.y < 0 || blob.y > H) blob.vy *= -1
        blob.x = Math.max(0, Math.min(W, blob.x))
        blob.y = Math.max(0, Math.min(H, blob.y))

        const scale = bass > 0.6 ? lerp(1, 2, (bass - 0.6) / 0.4) : lerp(0.8, 1.2, bass)
        const r = blob.baseRadius * scale

        ctx.globalAlpha = bass > 0.6 ? 0.6 : 0.4
        ctx.fillStyle = blob.color
        drawBlob(ctx, blob, r, time)
        ctx.fill()

        // Glow
        ctx.globalAlpha = 0.15
        ctx.shadowColor = blob.color
        ctx.shadowBlur = 30
        ctx.fill()
        ctx.shadowBlur = 0
      }
      ctx.globalAlpha = 1.0

      // ── LAYER 3: Mid frequency waves ──
      const mid = beat.mid * intensity
      const waveColors = ['#00cfff', '#00ffcc', '#ffffff']
      const waveAlphas = [0.7, 0.7, 0.3]
      for (let w = 0; w < 3; w++) {
        const amp = mid * (60 + w * 30)
        const freq = 0.003 + w * 0.002
        const phaseOff = w * 2.1
        const yCenter = H * (0.4 + w * 0.1)

        ctx.beginPath()
        ctx.strokeStyle = waveColors[w]
        ctx.lineWidth = 2 + w * 0.5
        ctx.globalAlpha = waveAlphas[w] * intensity

        for (let x = 0; x <= W; x += 3) {
          const y = yCenter + Math.sin(x * freq + time * 0.002 + phaseOff) * amp
            + Math.sin(x * freq * 1.5 + time * 0.001 + phaseOff + 1) * amp * 0.3
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0

      // ── LAYER 4: High frequency sparks ──
      const high = beat.high * intensity
      if (beat.isPlaying && high > 0.5) {
        const count = Math.floor(8 + Math.random() * 7)
        const sparkColors = ['#ffffff', '#00ffff', '#ff2d9b']
        for (let i = 0; i < count && s.sparks.length < 200; i++) {
          const waveIdx = Math.floor(Math.random() * 3)
          const sx = Math.random() * W
          const yCenter = H * (0.4 + waveIdx * 0.1)
          const freq = 0.003 + waveIdx * 0.002
          const phaseOff = waveIdx * 2.1
          const sy = yCenter + Math.sin(sx * freq + time * 0.002 + phaseOff) * (mid * (60 + waveIdx * 30))

          const angle = Math.random() * Math.PI * 2
          const speed = 1 + Math.random() * 3
          s.sparks.push({
            x: sx, y: sy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 20 + Math.floor(Math.random() * 20),
            maxLife: 40,
            color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
          })
        }
      }

      for (let i = s.sparks.length - 1; i >= 0; i--) {
        const sp = s.sparks[i]
        const prevX = sp.x
        const prevY = sp.y
        sp.vx *= 0.96
        sp.vy *= 0.96
        sp.x += sp.vx
        sp.y += sp.vy
        sp.life--
        if (sp.life <= 0) { s.sparks.splice(i, 1); continue }

        const alpha = sp.life / sp.maxLife
        ctx.globalAlpha = alpha
        ctx.strokeStyle = sp.color
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(prevX, prevY)
        ctx.lineTo(sp.x, sp.y)
        ctx.stroke()

        ctx.fillStyle = sp.color
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1.0

      // ── LAYER 5: Energy ring ──
      const energy = beat.energy * intensity
      const baseRingR = H * 0.3
      const hue = (time * 0.05) % 360
      ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`
      ctx.lineWidth = 2 + energy * 6
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, baseRingR, 0, Math.PI * 2)
      ctx.stroke()

      // Ripples
      if (beat.isPlaying && energy > 0.7 && s.ripples.length < 3) {
        s.ripples.push({ radius: baseRingR, opacity: 0.8, speed: 3 + energy * 4 })
      }
      for (let i = s.ripples.length - 1; i >= 0; i--) {
        const rip = s.ripples[i]
        rip.radius += rip.speed
        rip.opacity -= 0.015
        if (rip.opacity <= 0) { s.ripples.splice(i, 1); continue }

        ctx.globalAlpha = rip.opacity
        ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(W / 2, H / 2, rip.radius, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0

      // ── LAYER 6: Jagged lightning ──
      if (beat.isPlaying && high > 0.6 && s.frame % 8 === 0) {
        const count = 2 + Math.floor(Math.random() * 2)
        for (let l = 0; l < count && s.lightnings.length < 6; l++) {
          const edge = Math.floor(Math.random() * 4)
          let sx: number, sy: number, tx: number, ty: number
          if (edge === 0) { sx = 0; sy = Math.random() * H; tx = W; ty = Math.random() * H }
          else if (edge === 1) { sx = W; sy = Math.random() * H; tx = 0; ty = Math.random() * H }
          else if (edge === 2) { sx = Math.random() * W; sy = 0; tx = Math.random() * W; ty = H }
          else { sx = Math.random() * W; sy = H; tx = Math.random() * W; ty = 0 }

          const segCount = 8 + Math.floor(Math.random() * 4)
          const segs: { x: number; y: number }[] = [{ x: sx!, y: sy! }]
          for (let s = 1; s <= segCount; s++) {
            const t = s / segCount
            const bx = lerp(sx!, tx!, t) + (Math.random() - 0.5) * 80
            const by = lerp(sy!, ty!, t) + (Math.random() - 0.5) * 80
            segs.push({ x: bx, y: by })
          }
          s.lightnings.push({ segments: segs, life: 3 + Math.floor(Math.random() * 2), maxLife: 5 })
        }
      }

      for (let i = s.lightnings.length - 1; i >= 0; i--) {
        const lt = s.lightnings[i]
        lt.life--
        if (lt.life <= 0) { s.lightnings.splice(i, 1); continue }

        const alpha = lt.life / lt.maxLife
        ctx.globalAlpha = alpha * 0.9

        const lineGrad = ctx.createLinearGradient(
          lt.segments[0].x, lt.segments[0].y,
          lt.segments[lt.segments.length - 1].x, lt.segments[lt.segments.length - 1].y
        )
        lineGrad.addColorStop(0, '#ffffff')
        lineGrad.addColorStop(1, '#00ffcc')
        ctx.strokeStyle = lineGrad
        ctx.lineWidth = 1 + Math.random()

        ctx.beginPath()
        ctx.moveTo(lt.segments[0].x, lt.segments[0].y)
        for (let j = 1; j < lt.segments.length; j++) {
          ctx.lineTo(lt.segments[j].x, lt.segments[j].y)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0

      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'block',
      }}
    />
  )
}
