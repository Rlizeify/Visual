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

type ThemeName = 'BLOB' | 'RADIAL' | 'INTERFERENCE' | 'STARBURST'
const THEMES: ThemeName[] = ['BLOB', 'RADIAL', 'INTERFERENCE', 'STARBURST']

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

  const themeRef = useRef<{
    current: ThemeName
    previous: ThemeName
    transition: number       // 0 = fully old, 1 = fully new
    transitioning: boolean
    smoothedEnergy: number
    energyHistory: number[]
    lastSwitchFrame: number
    wasPlaying: boolean
  }>({
    current: 'BLOB',
    previous: 'BLOB',
    transition: 1,
    transitioning: false,
    smoothedEnergy: 0,
    energyHistory: [],
    lastSwitchFrame: 0,
    wasPlaying: false,
  })

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

    function drawBlobShape(ctx: CanvasRenderingContext2D, blob: Blob, radius: number, time: number) {
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

    // ── Theme draw functions ──

    function drawBlobTheme(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, beat: BeatPayload, intensity: number) {
      const s = state
      const e = beat.energy * intensity

      // LAYER 1: Background fade + gradient
      ctx.globalAlpha = 0.15
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1.0

      const breathe = Math.sin(time * 0.0005) * 0.5 + 0.5
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

      // LAYER 2: Lava blobs
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
        drawBlobShape(ctx, blob, r, time)
        ctx.fill()

        ctx.globalAlpha = 0.15
        ctx.shadowColor = blob.color
        ctx.shadowBlur = 30
        ctx.fill()
        ctx.shadowBlur = 0
      }
      ctx.globalAlpha = 1.0

      // LAYER 3: Mid frequency waves
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

      // LAYER 4: High frequency sparks
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
          const mid2 = beat.mid * intensity
          const sy = yCenter + Math.sin(sx * freq + time * 0.002 + phaseOff) * (mid2 * (60 + waveIdx * 30))

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

      // LAYER 5: Energy ring
      const energy = beat.energy * intensity
      const baseRingR = H * 0.3
      const hue = (time * 0.05) % 360
      ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`
      ctx.lineWidth = 2 + energy * 6
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, baseRingR, 0, Math.PI * 2)
      ctx.stroke()

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

      // LAYER 6: Jagged lightning
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
          for (let seg = 1; seg <= segCount; seg++) {
            const t = seg / segCount
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
    }

    function drawRadialTheme(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, beat: BeatPayload, intensity: number) {
      // Background fade
      ctx.globalAlpha = 0.12
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1.0

      const cx = W / 2
      const cy = H / 2
      const energy = beat.energy * intensity
      const bass = beat.bass * intensity
      const numRays = 64
      const rotation = time * 0.0003
      const maxLen = Math.max(W, H) * 0.5

      // Bass center pulse
      const pulseR = 20 + bass * 80
      const pulseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR)
      pulseGrad.addColorStop(0, `hsla(${(time * 0.08) % 360}, 100%, 70%, ${0.6 * intensity})`)
      pulseGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = pulseGrad
      ctx.beginPath()
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2)
      ctx.fill()

      // Rays
      for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2 + rotation
        const rayEnergy = energy * (0.5 + Math.sin(time * 0.003 + i * 0.5) * 0.5)
        const len = maxLen * rayEnergy
        const hue = ((i / numRays) * 360 + time * 0.05) % 360

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len)
        ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${0.6 * intensity})`
        ctx.lineWidth = 1.5 + energy * 2
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0
    }

    function drawInterferenceTheme(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, beat: BeatPayload, intensity: number) {
      // Background fade
      ctx.globalAlpha = 0.1
      ctx.fillStyle = '#000005'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1.0

      const mid = beat.mid * intensity
      const energy = beat.energy * intensity
      const freq1 = 0.01 + mid * 0.03
      const freq2 = 0.015 + mid * 0.02
      const amp = 30 + energy * 120
      const amp2 = 20 + energy * 80
      const lineSpacing = 4

      for (let y = 0; y < H; y += lineSpacing) {
        const xOff = Math.sin(y * freq1 + time * 0.002) * amp
          + Math.sin(y * freq2 + time * 0.0015) * amp2

        // Color shifts between deep blue and teal
        const t = (Math.sin(y * 0.005 + time * 0.001) + 1) * 0.5
        const r = Math.round(lerp(0, 0, t))
        const g = Math.round(lerp(60, 220, t))
        const b = Math.round(lerp(180, 200, t))

        ctx.beginPath()
        ctx.moveTo(W / 2 + xOff - 200, y)
        ctx.lineTo(W / 2 + xOff + 200, y)
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.5 * intensity})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0
    }

    function drawStarburstTheme(ctx: CanvasRenderingContext2D, W: number, H: number, time: number, beat: BeatPayload, intensity: number) {
      // Background fade
      ctx.globalAlpha = 0.08
      ctx.fillStyle = '#050005'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1.0

      const cx = W / 2
      const cy = H / 2
      const bass = beat.bass * intensity
      const energy = beat.energy * intensity
      const numArms = 8
      const baseRotation = time * 0.0004
      const armLength = Math.min(W, H) * 0.4 * (0.5 + energy * 0.5)
      const pulseMag = bass * 40

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(baseRotation)

      for (let i = 0; i < numArms; i++) {
        const angle = (i / numArms) * Math.PI * 2
        const pulse = Math.sin(time * 0.003 + i) * pulseMag

        // Bezier control points
        const cp1x = Math.cos(angle + 0.3) * (armLength * 0.5 + pulse)
        const cp1y = Math.sin(angle + 0.3) * (armLength * 0.5 + pulse)
        const cp2x = Math.cos(angle - 0.2) * (armLength * 0.8 + pulse)
        const cp2y = Math.sin(angle - 0.2) * (armLength * 0.8 + pulse)
        const ex = Math.cos(angle) * (armLength + pulse)
        const ey = Math.sin(angle) * (armLength + pulse)

        // Gradient: hot pink center → transparent edge
        const grad = ctx.createLinearGradient(0, 0, ex, ey)
        grad.addColorStop(0, `rgba(255, 50, 150, ${0.8 * intensity})`)
        grad.addColorStop(1, `rgba(255, 50, 150, 0)`)

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey)
        ctx.strokeStyle = grad
        ctx.lineWidth = 3 + bass * 8
        ctx.stroke()

        // Mirror arm for thickness
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.bezierCurveTo(
          Math.cos(angle - 0.3) * (armLength * 0.5 + pulse),
          Math.sin(angle - 0.3) * (armLength * 0.5 + pulse),
          Math.cos(angle + 0.2) * (armLength * 0.8 + pulse),
          Math.sin(angle + 0.2) * (armLength * 0.8 + pulse),
          ex, ey
        )
        ctx.strokeStyle = grad
        ctx.lineWidth = 2 + bass * 4
        ctx.stroke()
      }

      ctx.restore()
      ctx.globalAlpha = 1.0
    }

    const drawTheme: Record<ThemeName, (ctx: CanvasRenderingContext2D, W: number, H: number, time: number, beat: BeatPayload, intensity: number) => void> = {
      BLOB: drawBlobTheme,
      RADIAL: drawRadialTheme,
      INTERFERENCE: drawInterferenceTheme,
      STARBURST: drawStarburstTheme,
    }

    function render(time: number) {
      const W = canvas!.width
      const H = canvas!.height
      const beat = beatRef.current
      const s = state
      const tm = themeRef.current
      s.frame++

      const intensity = beat.isPlaying ? 1.0 : 0.2

      // ── Theme switching logic ──
      const energy = beat.energy * intensity
      tm.smoothedEnergy = tm.smoothedEnergy * 0.95 + energy * 0.05
      tm.energyHistory.push(energy)
      if (tm.energyHistory.length > 120) tm.energyHistory.shift()

      const framesSinceSwitch = s.frame - tm.lastSwitchFrame

      // Detect new song: isPlaying went false→true
      const justStartedPlaying = beat.isPlaying && !tm.wasPlaying
      tm.wasPlaying = beat.isPlaying

      // High energy moment or new song triggers switch
      const highEnergyTrigger = energy > tm.smoothedEnergy * 1.8 && framesSinceSwitch > 900 // ~15s at 60fps
      if ((highEnergyTrigger || justStartedPlaying) && !tm.transitioning) {
        const candidates = THEMES.filter(t => t !== tm.current)
        const next = candidates[Math.floor(Math.random() * candidates.length)]
        tm.previous = tm.current
        tm.current = next
        tm.transition = 0
        tm.transitioning = true
        tm.lastSwitchFrame = s.frame
      }

      // Advance transition
      if (tm.transitioning) {
        tm.transition = Math.min(1, tm.transition + 1 / 60)
        if (tm.transition >= 1) {
          tm.transitioning = false
        }
      }

      // ── Draw ──
      if (tm.transitioning) {
        // Draw old theme at decreasing alpha
        ctx.save()
        ctx.globalAlpha = 1 - tm.transition
        drawTheme[tm.previous](ctx, W, H, time, beat, intensity)
        ctx.restore()

        // Draw new theme at increasing alpha
        ctx.save()
        ctx.globalAlpha = tm.transition
        drawTheme[tm.current](ctx, W, H, time, beat, intensity)
        ctx.restore()
      } else {
        drawTheme[tm.current](ctx, W, H, time, beat, intensity)
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
