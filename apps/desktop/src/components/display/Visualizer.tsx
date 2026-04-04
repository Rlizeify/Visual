import { useEffect, useRef } from 'react'

interface BeatPayload {
  bass: number
  mid: number
  high: number
  energy: number
  isPlaying: boolean
}

const TWO_PI = Math.PI * 2
const COLS = 40
const ROWS = 30
const PARTICLE_COUNT = 300

interface Particle {
  x: number
  y: number
  prevX: number
  prevY: number
  speed: number
  life: number
  hue: number
}

interface Shockwave {
  radius: number
  hue: number
  alpha: number
  lineWidth: number
}

export default function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const beatRef = useRef<BeatPayload>({ bass: 0, mid: 0, high: 0, energy: 0, isPlaying: false })

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

    // ── Flow field ──
    const fieldAngles = new Float32Array(COLS * ROWS)
    const fieldSpeeds = new Float32Array(COLS * ROWS)

    // ── Particles (pre-allocated) ──
    const particles: Particle[] = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(spawnParticle(window.innerWidth, window.innerHeight))
    }

    // ── Shockwaves ──
    const shockwaves: Shockwave[] = []

    // ── State ──
    let frame = 0
    let globalRotation = 0
    let hueShift = 0
    let targetHueShift = 0
    let lastShockwaveFrame = -999
    let lastInversionFrame = -999
    let inversionProgress = -1 // -1 = inactive, 0..39 = active frames
    const smooth = { bass: 0, mid: 0, high: 0, energy: 0 }

    function spawnParticle(W: number, H: number): Particle {
      // Spawn at a random edge
      let x: number, y: number
      const edge = Math.random() * 4 | 0
      if (edge === 0) { x = 0; y = Math.random() * H }
      else if (edge === 1) { x = W; y = Math.random() * H }
      else if (edge === 2) { x = Math.random() * W; y = 0 }
      else { x = Math.random() * W; y = H }
      return { x, y, prevX: x, prevY: y, speed: 1 + Math.random() * 1.5, life: 0.5 + Math.random() * 0.5, hue: Math.random() * 360 }
    }

    function render() {
      const W = canvas!.width
      const H = canvas!.height
      const cx = W / 2
      const cy = H / 2
      const beat = beatRef.current
      frame++

      // Smooth beat data
      smooth.bass = smooth.bass * 0.75 + beat.bass * 0.25
      smooth.mid = smooth.mid * 0.75 + beat.mid * 0.25
      smooth.high = smooth.high * 0.75 + beat.high * 0.25
      smooth.energy = smooth.energy * 0.75 + beat.energy * 0.25

      const time = frame

      // ── Background fade (trail effect) ──
      ctx.globalAlpha = 0.08
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1

      // ── Update flow field ──
      const cellW = W / COLS
      const cellH = H / ROWS
      const inversionMult = inversionProgress >= 0 && inversionProgress < 20 ? -1 : 1

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const idx = row * COLS + col
          let angle = Math.sin(col * 0.2 + time * 0.003) * Math.cos(row * 0.15 + time * 0.002) * TWO_PI

          // Bass radial disturbance from center
          if (smooth.bass > 0.1) {
            const cellCx = (col + 0.5) * cellW
            const cellCy = (row + 0.5) * cellH
            const dx = cellCx - cx
            const dy = cellCy - cy
            const dist = Math.sqrt(dx * dx + dy * dy)
            angle += smooth.bass * 2.0 * Math.exp(-dist / 300)
          }

          fieldAngles[idx] = angle * inversionMult
          fieldSpeeds[idx] = 1 + smooth.energy * 2
        }
      }

      // ── Field inversion lifecycle ──
      if (inversionProgress >= 0) {
        inversionProgress++
        if (inversionProgress >= 40) inversionProgress = -1
      }

      // ── Color zone targeting ──
      if (smooth.bass > smooth.mid && smooth.bass > smooth.high) {
        targetHueShift = 0 // red/pink range (340-20, offset ~0)
      } else if (smooth.mid > smooth.bass && smooth.mid > smooth.high) {
        targetHueShift = 180 // blue/teal
      } else {
        targetHueShift = 50 // white/yellow
      }
      hueShift += (targetHueShift - hueShift) * 0.02

      // ── Pulse events ──
      // Shockwave
      if (smooth.energy > 0.75 && (frame - lastShockwaveFrame) > 180 && beat.isPlaying) {
        lastShockwaveFrame = frame
        if (shockwaves.length < 3) {
          shockwaves.push({ radius: 0, hue: hueShift, alpha: 0.8, lineWidth: 6 })
        }
      }

      // Field inversion
      if (smooth.energy > 0.88 && (frame - lastInversionFrame) > 480 && beat.isPlaying) {
        lastInversionFrame = frame
        inversionProgress = 0
        // Canvas flash
        ctx.globalAlpha = 0.06
        ctx.fillStyle = 'rgba(255, 60, 120, 1)'
        ctx.fillRect(0, 0, W, H)
        ctx.globalAlpha = 1
      }

      // ── Global rotation ──
      globalRotation += 0.0002
      if (smooth.energy > 0.85) {
        globalRotation += (Math.random() - 0.5) * 0.16
      }

      // ── Apply global transform ──
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(globalRotation)
      ctx.translate(-cx, -cy)

      // ── Update & draw particles ──
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i]

        // Respawn dead or out-of-bounds particles
        if (p.life <= 0 || p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) {
          const fresh = spawnParticle(W, H)
          p.x = fresh.x; p.y = fresh.y
          p.prevX = fresh.x; p.prevY = fresh.y
          p.speed = fresh.speed; p.life = fresh.life; p.hue = fresh.hue
        }

        // Flow field lookup
        const col = Math.min(Math.max((p.x / W * COLS) | 0, 0), COLS - 1)
        const row = Math.min(Math.max((p.y / H * ROWS) | 0, 0), ROWS - 1)
        const idx = row * COLS + col
        const angle = fieldAngles[idx]
        const fieldSpeed = fieldSpeeds[idx]

        const moveSpeed = p.speed * fieldSpeed * (1 + smooth.energy * 3)

        // Store previous position
        p.prevX = p.x
        p.prevY = p.y

        // Move along flow field
        p.x += Math.cos(angle) * moveSpeed
        p.y += Math.sin(angle) * moveSpeed

        // Age
        p.life -= 0.003
        p.hue = (p.hue + 0.3) % 360

        // Draw trail line
        const drawHue = (p.hue + hueShift) % 360
        const lw = smooth.high > 0.5 ? 2 : 1

        ctx.beginPath()
        ctx.moveTo(p.prevX, p.prevY)
        ctx.lineTo(p.x, p.y)
        ctx.strokeStyle = `hsla(${drawHue}, 90%, 60%, 0.6)`
        ctx.lineWidth = lw
        ctx.stroke()
      }

      ctx.restore()

      // ── Draw shockwaves (no transform, screen space) ──
      const diagonal = Math.sqrt(W * W + H * H) / 2
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i]
        sw.radius += 15
        sw.alpha -= 0.8 / (diagonal / 15) // fade to 0 by the time it reaches edge
        sw.lineWidth = Math.max(0.5, 6 * (1 - sw.radius / diagonal))

        if (sw.radius > diagonal || sw.alpha <= 0) {
          shockwaves.splice(i, 1)
          continue
        }

        ctx.beginPath()
        ctx.arc(cx, cy, sw.radius, 0, TWO_PI)
        ctx.strokeStyle = `hsla(${sw.hue}, 100%, 70%, ${Math.max(0, sw.alpha)})`
        ctx.lineWidth = sw.lineWidth
        ctx.globalAlpha = Math.max(0, sw.alpha)
        ctx.stroke()
      }

      ctx.globalAlpha = 1

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
