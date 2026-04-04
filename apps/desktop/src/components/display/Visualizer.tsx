import { useEffect, useRef } from 'react'

interface BeatPayload {
  bass: number
  mid: number
  high: number
  energy: number
  isPlaying: boolean
}

type EntityType = 'blob' | 'ring' | 'ray' | 'tendril'

interface ShapeEntity {
  id: number
  type: EntityType
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  targetRadius: number
  rotation: number
  rotationSpeed: number
  hue: number
  hueSpeed: number
  alpha: number
  age: number
  maxAge: number
  energy: number
  morphTarget: number | null
  splitCharge: number
  scale: number
  points: { x: number; y: number }[]
}

let nextId = 0

function createBlob(x: number, y: number, radius: number, energy: number): ShapeEntity {
  const numPoints = 6 + Math.floor(Math.random() * 3)
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2
    const r = radius * (0.8 + Math.random() * 0.4)
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
  }
  return {
    id: nextId++,
    type: 'blob',
    x, y,
    vx: (Math.random() - 0.5) * 1.2,
    vy: (Math.random() - 0.5) * 1.2,
    radius,
    targetRadius: radius,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.02,
    hue: Math.random() * 360,
    hueSpeed: (Math.random() - 0.5) * 2,
    alpha: 1,
    age: 0,
    maxAge: 200 + Math.floor(Math.random() * 600),
    energy,
    morphTarget: null,
    splitCharge: 0,
    scale: 1,
    points,
  }
}

function createRing(x: number, y: number, energy: number): ShapeEntity {
  return {
    id: nextId++,
    type: 'ring',
    x, y,
    vx: 0, vy: 0,
    radius: 5,
    targetRadius: 400,
    rotation: 0,
    rotationSpeed: 0,
    hue: 330,
    hueSpeed: 0,
    alpha: 0.9,
    age: 0,
    maxAge: 999,
    energy,
    morphTarget: null,
    splitCharge: 0,
    scale: 1,
    points: [],
  }
}

function createRay(cx: number, cy: number, energy: number): ShapeEntity {
  return {
    id: nextId++,
    type: 'ray',
    x: cx, y: cy,
    vx: 0, vy: 0,
    radius: 0,
    targetRadius: 0,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.03,
    hue: 180,
    hueSpeed: 0,
    alpha: 1,
    age: 0,
    maxAge: 60 + Math.floor(Math.random() * 60),
    energy,
    morphTarget: null,
    splitCharge: 0,
    scale: 1,
    points: [],
  }
}

function createTendril(W: number, H: number): ShapeEntity {
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < 4; i++) {
    points.push({ x: Math.random() * W, y: Math.random() * H })
  }
  return {
    id: nextId++,
    type: 'tendril',
    x: 0, y: 0,
    vx: 0, vy: 0,
    radius: 0,
    targetRadius: 0,
    rotation: 0,
    rotationSpeed: 0,
    hue: 30,
    hueSpeed: 0.5,
    alpha: 0,
    age: 0,
    maxAge: 400 + Math.floor(Math.random() * 200),
    energy: 0,
    morphTarget: null,
    splitCharge: 0,
    scale: 1,
    points,
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
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

    // State
    let entities: ShapeEntity[] = []
    let frame = 0
    let lastBassSpawnFrame = -999
    let lastRingSpawnFrame = -999
    let lastRaySpawnFrame = -999

    // Smoothed beat values
    const smooth = { bass: 0, mid: 0, high: 0, energy: 0 }

    // Fractal zoom state
    let globalScale = 1.0
    let globalRotation = 0
    let zoomActive = false
    let zoomFrame = 0
    let zoomTotalFrames = 40
    let zoomScaleTarget = 1.4
    let zoomRotTarget = 0
    let zoomScaleStart = 1.0
    let zoomRotStart = 0
    let lastZoomTriggerFrame = -999

    function drawBlobEntity(ctx: CanvasRenderingContext2D, e: ShapeEntity) {
      const pts = e.points
      if (pts.length < 3) return

      const cos = Math.cos(e.rotation)
      const sin = Math.sin(e.rotation)

      // Rotate points around center
      const rotated = pts.map(p => ({
        x: e.x + (p.x * cos - p.y * sin) * e.scale,
        y: e.y + (p.x * sin + p.y * cos) * e.scale,
      }))

      ctx.beginPath()
      // Use bezier curves through the rotated points for organic shape
      const n = rotated.length
      ctx.moveTo(
        (rotated[n - 1].x + rotated[0].x) / 2,
        (rotated[n - 1].y + rotated[0].y) / 2
      )
      for (let i = 0; i < n; i++) {
        const curr = rotated[i]
        const next = rotated[(i + 1) % n]
        const midX = (curr.x + next.x) / 2
        const midY = (curr.y + next.y) / 2
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
      }
      ctx.closePath()

      ctx.globalAlpha = e.alpha
      ctx.fillStyle = `hsl(${e.hue}, 80%, 50%)`
      ctx.fill()

      // Glow
      ctx.globalAlpha = e.alpha * 0.3
      ctx.shadowColor = `hsl(${e.hue}, 80%, 50%)`
      ctx.shadowBlur = 25
      ctx.fill()
      ctx.shadowBlur = 0
    }

    function drawRingEntity(ctx: CanvasRenderingContext2D, e: ShapeEntity) {
      // Color shifts from hot pink (330) to electric blue (210) as it expands
      const t = Math.min(e.radius / 300, 1)
      const hue = 330 - t * 120
      const strokeW = 2 + smooth.mid * 6

      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${e.alpha})`
      ctx.lineWidth = strokeW
      ctx.globalAlpha = e.alpha
      ctx.stroke()
    }

    function drawRayEntity(ctx: CanvasRenderingContext2D, e: ShapeEntity, W: number, H: number) {
      const cx = W / 2
      const cy = H / 2
      const len = (100 + smooth.high * 300) * e.energy

      const endX = cx + Math.cos(e.rotation) * len
      const endY = cy + Math.sin(e.rotation) * len

      const grad = ctx.createLinearGradient(cx, cy, endX, endY)
      grad.addColorStop(0, `rgba(255,255,255,${e.alpha})`)
      grad.addColorStop(1, `rgba(0,210,200,${e.alpha * 0.3})`)

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(endX, endY)
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5 + e.energy * 2
      ctx.globalAlpha = e.alpha
      ctx.stroke()
    }

    function drawTendrilEntity(ctx: CanvasRenderingContext2D, e: ShapeEntity) {
      const pts = e.points
      if (pts.length < 4) return

      const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[3].x, pts[3].y)
      grad.addColorStop(0, `hsla(30, 90%, 55%, ${e.alpha})`)
      grad.addColorStop(1, `hsla(330, 80%, 55%, ${e.alpha})`)

      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y)
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.globalAlpha = e.alpha
      ctx.stroke()
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

      const spawning = beat.isPlaying ? 1.0 : 0.2

      // ── BACKGROUND: motion trail fade ──
      ctx.globalAlpha = 0.12
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.fillRect(0, 0, W, H)
      ctx.globalAlpha = 1

      // ── FRACTAL ZOOM ──
      if (smooth.energy > 0.85 && !zoomActive && (frame - lastZoomTriggerFrame) > 480 && beat.isPlaying) {
        zoomActive = true
        zoomFrame = 0
        zoomScaleStart = globalScale
        zoomRotStart = globalRotation
        zoomScaleTarget = 1.4
        zoomRotTarget = globalRotation + ((Math.random() - 0.5) * 2) * (15 * Math.PI / 180)
        lastZoomTriggerFrame = frame

        // Flash
        ctx.globalAlpha = 0.04
        ctx.fillStyle = 'rgba(255,100,50,1)'
        ctx.fillRect(0, 0, W, H)
        ctx.globalAlpha = 1
      }

      if (zoomActive) {
        zoomFrame++
        const half = zoomTotalFrames / 2
        let t: number
        if (zoomFrame <= half) {
          t = easeInOut(zoomFrame / half)
          globalScale = zoomScaleStart + (zoomScaleTarget - zoomScaleStart) * t
          globalRotation = zoomRotStart + (zoomRotTarget - zoomRotStart) * t
        } else {
          t = easeInOut((zoomFrame - half) / half)
          globalScale = zoomScaleTarget + (1.0 - zoomScaleTarget) * t
          globalRotation = zoomRotTarget // hold rotation
        }
        if (zoomFrame >= zoomTotalFrames) {
          zoomActive = false
          globalScale = 1.0
        }
      }

      // ── Apply global transform ──
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(globalScale, globalScale)
      ctx.rotate(globalRotation)
      ctx.translate(-cx, -cy)

      // ── SPAWN RULES ──
      const blobCount = entities.filter(e => e.type === 'blob').length
      const totalCount = entities.length

      // Ensure minimum blobs
      if (blobCount < 4 && totalCount < 18) {
        entities.push(createBlob(
          Math.random() * W,
          Math.random() * H,
          40 + Math.random() * 60,
          smooth.energy
        ))
      }

      // Bass blob spawn
      if (smooth.bass > 0.6 && (frame - lastBassSpawnFrame) > 30 && totalCount < 18 && Math.random() < spawning) {
        entities.push(createBlob(
          cx + (Math.random() - 0.5) * 200,
          cy + (Math.random() - 0.5) * 200,
          60 + smooth.bass * 80,
          smooth.energy
        ))
        lastBassSpawnFrame = frame
      }

      // Ring spawn
      if (smooth.energy > 0.7 && (frame - lastRingSpawnFrame) > 45 && totalCount < 18 && Math.random() < spawning) {
        entities.push(createRing(
          Math.random() * W,
          Math.random() * H,
          smooth.energy
        ))
        lastRingSpawnFrame = frame
      }

      // Ray burst spawn
      if (smooth.high > 0.65 && (frame - lastRaySpawnFrame) > 20 && totalCount < 18 && Math.random() < spawning) {
        const burstCount = Math.min(4 + Math.floor(Math.random() * 3), 18 - totalCount)
        for (let i = 0; i < burstCount; i++) {
          entities.push(createRay(cx, cy, smooth.energy))
        }
        lastRaySpawnFrame = frame
      }

      // Tendril spawn (random, rare)
      if (Math.random() < 0.003 * spawning && totalCount < 18) {
        entities.push(createTendril(W, H))
      }

      // ── UPDATE & DRAW ENTITIES ──
      const toRemove: Set<number> = new Set()
      const toAdd: ShapeEntity[] = []

      for (const e of entities) {
        e.age++
        e.hue = (e.hue + e.hueSpeed) % 360
        if (e.hue < 0) e.hue += 360

        // Dying phase
        if (e.age > e.maxAge) {
          e.alpha -= 0.02
          if (e.alpha <= 0) {
            toRemove.add(e.id)
            continue
          }
        }

        switch (e.type) {
          case 'blob': {
            e.rotation += e.rotationSpeed

            // Bass pulse deformation
            if (smooth.bass > 0.5 && e.points.length > 0) {
              const idx = Math.floor(Math.random() * e.points.length)
              const pushAmt = smooth.bass * 8
              const pt = e.points[idx]
              const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y)
              if (dist > 0) {
                pt.x += (pt.x / dist) * pushAmt
                pt.y += (pt.y / dist) * pushAmt
              }
            }

            // Points slowly return toward target radius
            for (const pt of e.points) {
              const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y)
              const target = e.radius
              if (dist > 0) {
                const diff = (target - dist) * 0.02
                pt.x += (pt.x / dist) * diff
                pt.y += (pt.y / dist) * diff
              }
            }

            // Drift
            e.x += e.vx
            e.y += e.vy

            // Soft bounce
            if (e.x < e.radius) { e.vx = Math.abs(e.vx) * 0.6; e.x = e.radius }
            if (e.x > W - e.radius) { e.vx = -Math.abs(e.vx) * 0.6; e.x = W - e.radius }
            if (e.y < e.radius) { e.vy = Math.abs(e.vy) * 0.6; e.y = e.radius }
            if (e.y > H - e.radius) { e.vy = -Math.abs(e.vy) * 0.6; e.y = H - e.radius }

            // Split charge
            e.splitCharge += e.energy * 0.002
            if (e.splitCharge >= 1 && e.radius > 30 && entities.length + toAdd.length < 18) {
              toRemove.add(e.id)
              const halfR = e.radius * 0.5
              toAdd.push(createBlob(e.x - 40, e.y, halfR, e.energy))
              toAdd.push(createBlob(e.x + 40, e.y, halfR, e.energy))
              toAdd[toAdd.length - 1].vx = Math.abs(e.vx) + 0.5
              toAdd[toAdd.length - 2].vx = -(Math.abs(e.vx) + 0.5)
              continue
            }

            // Morph target: check proximity to other blobs
            if (!e.morphTarget) {
              for (const other of entities) {
                if (other.id === e.id || other.type !== 'blob' || toRemove.has(other.id)) continue
                const dx = other.x - e.x
                const dy = other.y - e.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist < (e.radius + other.radius) * 0.7) {
                  // Smaller absorbs into larger
                  if (e.radius < other.radius) {
                    e.morphTarget = other.id
                  }
                }
              }
            }

            // Move toward morph target
            if (e.morphTarget !== null) {
              const target = entities.find(o => o.id === e.morphTarget)
              if (!target || toRemove.has(target.id)) {
                e.morphTarget = null
              } else {
                const dx = target.x - e.x
                const dy = target.y - e.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                e.vx += (dx / (dist || 1)) * 0.5
                e.vy += (dy / (dist || 1)) * 0.5
                e.radius *= 0.98

                if (dist < 10) {
                  // Merge
                  toRemove.add(e.id)
                  toRemove.add(target.id)
                  const newR = Math.sqrt(e.radius * e.radius + target.radius * target.radius)
                  toAdd.push(createBlob(
                    (e.x + target.x) / 2,
                    (e.y + target.y) / 2,
                    Math.min(newR, 160),
                    Math.max(e.energy, target.energy)
                  ))
                  continue
                }
              }
            }

            drawBlobEntity(ctx, e)
            break
          }

          case 'ring': {
            e.radius += 2 + e.energy * 4
            e.alpha -= 0.012
            if (e.alpha < 0.01) {
              toRemove.add(e.id)
              continue
            }
            drawRingEntity(ctx, e)
            break
          }

          case 'ray': {
            e.rotation += e.rotationSpeed
            // Fade out toward end of life
            if (e.age > e.maxAge * 0.6) {
              e.alpha = Math.max(0, 1 - (e.age - e.maxAge * 0.6) / (e.maxAge * 0.4))
            }
            drawRayEntity(ctx, e, W, H)
            break
          }

          case 'tendril': {
            // Drift control points
            for (const pt of e.points) {
              pt.x += (Math.random() - 0.5) * 1.5
              pt.y += (Math.random() - 0.5) * 1.5
            }

            // Fade in then fade out
            const lifeRatio = e.age / e.maxAge
            if (lifeRatio < 0.1) {
              e.alpha = lifeRatio / 0.1
            } else if (lifeRatio > 0.8) {
              e.alpha = (1 - lifeRatio) / 0.2
            } else {
              e.alpha = 0.6
            }
            if (e.alpha <= 0) {
              toRemove.add(e.id)
              continue
            }
            e.hue = 30 + smooth.high * 20

            drawTendrilEntity(ctx, e)
            break
          }
        }
      }

      ctx.restore()
      ctx.globalAlpha = 1

      // ── Cull & add ──
      entities = entities.filter(e => !toRemove.has(e.id))
      entities.push(...toAdd)

      // Hard cap: cull excess (oldest tendrils first, then smallest blobs)
      while (entities.length > 18) {
        const tendrilIdx = entities.findIndex(e => e.type === 'tendril')
        if (tendrilIdx >= 0) {
          entities.splice(tendrilIdx, 1)
          continue
        }
        let smallestIdx = 0
        let smallestR = Infinity
        for (let i = 0; i < entities.length; i++) {
          if (entities[i].type === 'blob' && entities[i].radius < smallestR) {
            smallestR = entities[i].radius
            smallestIdx = i
          }
        }
        entities.splice(smallestIdx, 1)
      }

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
