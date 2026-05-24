import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

/**
 * Asian Vibrant — decorative environment layers.
 *
 * Renders five overlays:
 *   1. Rice-paper backdrop (only on non-M routes — replaces the fog).
 *   2. Ink-wash mountains (only on non-M routes).
 *   3. Vertical kanji columns scrolling at the viewport edges (all routes).
 *   4. Cherry blossom petals drifting diagonally (all routes).
 *   5. Periodic dragon flight every 60-90s (all routes).
 *
 * Performance contract:
 *   - prefers-reduced-motion: reduce  → freeze every animation to a
 *     single static frame.
 *   - document.visibilityState === 'hidden' → pause every loop.
 *   - Kanji + petals throttled to ~30fps via requestAnimationFrame gate.
 *   - Dragon uses a single SVG <path> + transform along a precomputed
 *     bezier — no per-frame DOM creation.
 *
 * Mobile (width < 600px):
 *   - 4 kanji columns → 2
 *   - 8 petals → 4
 *   - Dragon interval doubles
 */

// ---------- character pool ----------

const KANJI_POOL = [
  '山','川','月','日','風','雨','雲','雪','春','夏','秋','冬','花','木','鳥','魚',
  '水','火','土','金','石','海','空','星','光','影','朝','夜','音','声','歌','詩',
  '書','画','紙','墨','筆','茶','竹','松','梅','桜','蘭','菊','鶴','龍','雀','蝶',
  '時','流','静','響',
]

function randomKanjiSequence(count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(KANJI_POOL[Math.floor(Math.random() * KANJI_POOL.length)])
  }
  return out
}

// ---------- shared hooks ----------

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  )
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  return visible
}

function useViewportSize(): { w: number; h: number; mobile: boolean } {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return { w: 1440, h: 900, mobile: false }
    return { w: window.innerWidth, h: window.innerHeight, mobile: window.innerWidth < 600 }
  })
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight, mobile: window.innerWidth < 600 })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

// ---------- rice paper + ink mountains ----------

interface PaperProps {
  visible: boolean
}

export function RicePaperBackdrop({ visible }: PaperProps) {
  const style: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'var(--av-paper-grain)',
    opacity: visible ? 1 : 0,
    transition: 'opacity 400ms ease',
    pointerEvents: visible ? 'auto' : 'none',
    zIndex: 40,
  }
  // Subtle SVG noise overlay for paper-fiber texture.
  const noise: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.32 0 0 0 0 0.24 0 0 0 0 0.16 0 0 0 0.16 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
    mixBlendMode: 'multiply',
    opacity: 0.55,
    pointerEvents: 'none',
  }
  return (
    <div style={style} aria-hidden>
      <div style={noise} />
    </div>
  )
}

export function InkMountains({ visible }: PaperProps) {
  // Two stacked mountain ridges — back ridge softer/farther, front sharper/closer.
  const style: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38vh',
    opacity: visible ? 1 : 0,
    transition: 'opacity 500ms ease',
    pointerEvents: 'none',
    zIndex: 41,
  }
  return (
    <svg
      style={style}
      viewBox="0 0 1600 600"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="av-ridge-back" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(26,20,16,0)" />
          <stop offset="100%" stopColor="rgba(26,20,16,0.22)" />
        </linearGradient>
        <linearGradient id="av-ridge-front" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(26,20,16,0.05)" />
          <stop offset="100%" stopColor="rgba(26,20,16,0.42)" />
        </linearGradient>
        <filter id="av-ridge-blur"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      {/* Back ridge — distant, softer */}
      <path
        d="M0,360 C 120,280 200,320 320,260 C 460,200 560,300 700,240 C 840,190 980,300 1120,250 C 1260,210 1380,290 1600,240 L 1600,600 L 0,600 Z"
        fill="url(#av-ridge-back)"
        filter="url(#av-ridge-blur)"
      />
      {/* Front ridge — closer, with subtle pine silhouettes */}
      <path
        d="M0,440 C 100,380 220,460 340,400 C 460,340 580,440 720,390 C 860,350 1000,440 1140,400 C 1280,360 1420,440 1600,400 L 1600,600 L 0,600 Z"
        fill="url(#av-ridge-front)"
      />
      {/* A pair of tiny pines on the front ridge */}
      <g fill="rgba(26,20,16,0.55)" opacity="0.7">
        <path d="M430,408 l3,-14 l-2,0 l2,-5 l2,5 l-2,0 l3,14 z" />
        <path d="M450,412 l2,-10 l-1,0 l2,-4 l2,4 l-1,0 l2,10 z" />
        <path d="M1080,406 l3,-14 l-2,0 l2,-5 l2,5 l-2,0 l3,14 z" />
      </g>
    </svg>
  )
}

// ---------- vertical kanji columns ----------

interface KanjiColumnProps {
  side: 'left' | 'right'
  offset: number       // px from edge
  speed: number        // px per second
  size: number         // font size px
  color: string
  charCount: number
  paused: boolean
  reduced: boolean
}

function KanjiColumn({ side, offset, speed, size, color, charCount, paused, reduced }: KanjiColumnProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const offsetRef = useRef(0)
  const lastTime = useRef(0)
  const chars = useMemo(() => randomKanjiSequence(charCount), [charCount])

  useEffect(() => {
    if (reduced) return // freeze
    if (paused) return
    let raf = 0
    const FRAME_GATE = 33 // ~30fps
    const tick = (t: number) => {
      if (!lastTime.current) lastTime.current = t
      const dt = t - lastTime.current
      if (dt >= FRAME_GATE) {
        offsetRef.current += (speed * dt) / 1000
        // Wrap when we've translated one character row down — the
        // duplicated list keeps the column visually continuous.
        const wrap = size * chars.length
        if (offsetRef.current >= wrap) offsetRef.current -= wrap
        if (ref.current) {
          ref.current.style.transform = `translate3d(0, ${offsetRef.current}px, 0)`
        }
        lastTime.current = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      lastTime.current = 0
    }
  }, [paused, reduced, speed, size, chars.length])

  const wrapStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    [side]: `${offset}px`,
    width: `${size + 8}px`,
    height: '100vh',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 45,
    maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
  }

  const innerStyle: CSSProperties = {
    fontFamily: "'Ma Shan Zheng', serif",
    fontSize: `${size}px`,
    lineHeight: 1,
    color,
    textAlign: 'center',
    willChange: 'transform',
    transform: 'translate3d(0, 0, 0)',
  }

  return (
    <div style={wrapStyle} aria-hidden>
      <div ref={ref} style={innerStyle}>
        {/* Render the sequence twice so wrap is seamless */}
        {[...chars, ...chars].map((ch, i) => (
          <div key={i} style={{ padding: '6px 0' }}>{ch}</div>
        ))}
      </div>
    </div>
  )
}

interface KanjiColumnsProps {
  paused: boolean
  reduced: boolean
  mobile: boolean
}

function KanjiColumns({ paused, reduced, mobile }: KanjiColumnsProps) {
  // 4 columns on desktop, 2 on mobile. Different speeds + sizes for variety.
  const columns = mobile
    ? [
        { side: 'left' as const,  offset: 10, speed: 14, size: 22, color: 'rgba(139,26,26,0.18)', charCount: 22 },
        { side: 'right' as const, offset: 10, speed: 11, size: 22, color: 'rgba(201,162,39,0.20)', charCount: 22 },
      ]
    : [
        { side: 'left' as const,  offset: 16, speed: 16, size: 26, color: 'rgba(139,26,26,0.22)', charCount: 26 },
        { side: 'left' as const,  offset: 60, speed: 11, size: 20, color: 'rgba(201,162,39,0.22)', charCount: 30 },
        { side: 'right' as const, offset: 16, speed: 14, size: 26, color: 'rgba(201,162,39,0.22)', charCount: 28 },
        { side: 'right' as const, offset: 60, speed:  9, size: 20, color: 'rgba(139,26,26,0.22)', charCount: 32 },
      ]
  return (
    <>
      {columns.map((c, i) => (
        <KanjiColumn key={i} {...c} paused={paused} reduced={reduced} />
      ))}
    </>
  )
}

// ---------- cherry petals ----------

interface PetalSpec {
  id: number
  x: number       // starting viewport x (0..1)
  y: number       // starting viewport y (0..1)
  size: number    // px
  speed: number   // vertical px/sec
  drift: number   // horizontal sway amplitude px
  rot: number     // initial rotation deg
  rotSpeed: number // deg/sec
  hue: number     // 0=pale, 1=deep
}

function makePetal(id: number): PetalSpec {
  return {
    id,
    x: Math.random(),
    y: Math.random() - 0.2,
    size: 12 + Math.random() * 16,
    speed: 18 + Math.random() * 22,
    drift: 24 + Math.random() * 36,
    rot: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 30,
    hue: Math.random(),
  }
}

interface PetalsProps {
  paused: boolean
  reduced: boolean
  mobile: boolean
}

function Petals({ paused, reduced, mobile }: PetalsProps) {
  const COUNT = mobile ? 4 : 8
  const refs = useRef<Array<HTMLDivElement | null>>([])
  const specsRef = useRef<PetalSpec[]>([])
  const elapsedRef = useRef(0)
  const lastTime = useRef(0)
  const { w, h } = useViewportSize()

  // initialize specs once
  if (specsRef.current.length !== COUNT) {
    specsRef.current = Array.from({ length: COUNT }, (_, i) => makePetal(i))
  }

  useEffect(() => {
    if (reduced || paused) return
    let raf = 0
    const FRAME_GATE = 33 // ~30fps
    const tick = (t: number) => {
      if (!lastTime.current) lastTime.current = t
      const dt = t - lastTime.current
      if (dt >= FRAME_GATE) {
        elapsedRef.current += dt / 1000
        for (let i = 0; i < specsRef.current.length; i++) {
          const p = specsRef.current[i]
          const el = refs.current[i]
          if (!el) continue
          const baseY = p.y * h + elapsedRef.current * p.speed
          const wrappedY = ((baseY % (h + 80)) + (h + 80)) % (h + 80) - 40
          const swayX = p.x * w + Math.sin(elapsedRef.current * 0.6 + p.id) * p.drift
          const rot = p.rot + elapsedRef.current * p.rotSpeed
          el.style.transform = `translate3d(${swayX.toFixed(1)}px, ${wrappedY.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg)`
        }
        lastTime.current = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      lastTime.current = 0
    }
  }, [paused, reduced, w, h, COUNT])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 46, overflow: 'hidden' }} aria-hidden>
      {specsRef.current.map((p, i) => {
        const fill = p.hue < 0.5 ? '#F8C8DC' : '#E89BB5'
        const initialX = p.x * w
        const initialY = p.y * h
        return (
          <div
            key={p.id}
            ref={(el) => { refs.current[i] = el }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${p.size}px`,
              height: `${p.size}px`,
              transform: `translate3d(${initialX}px, ${initialY}px, 0) rotate(${p.rot}deg)`,
              willChange: 'transform',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.10))',
              opacity: 0.85,
            }}
          >
            <svg viewBox="0 0 32 32" width={p.size} height={p.size}>
              {/* Five-lobed cherry blossom petal (single petal — simpler + reads as blossom in motion) */}
              <path
                d="M16 4 C 22 8, 24 16, 16 28 C 8 16, 10 8, 16 4 Z"
                fill={fill}
                stroke="rgba(139,26,26,0.45)"
                strokeWidth="0.6"
              />
              {/* Notch at tip */}
              <path d="M16 26 L 14 22 L 18 22 Z" fill="rgba(139,26,26,0.35)" />
            </svg>
          </div>
        )
      })}
    </div>
  )
}

// ---------- dragon ----------

interface DragonProps {
  paused: boolean
  reduced: boolean
  mobile: boolean
}

/** Build a long serpentine SVG path for the dragon body. */
function buildDragonBodyPath(t: number): string {
  // t in 0..1 — body undulation phase. Sine wave with two harmonics.
  // The body is 14 segments long. Each segment offsets vertically by a phase-shifted sine.
  const segCount = 14
  const segLen = 30
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= segCount; i++) {
    const x = i * segLen
    const phase = t * Math.PI * 2 + i * 0.55
    const y = Math.sin(phase) * 22 + Math.sin(phase * 1.7) * 6
    pts.push({ x, y })
  }
  // Smooth path through points (Catmull-Rom-ish via quad mid-points).
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const mx = (p1.x + p2.x) / 2
    const my = (p1.y + p2.y) / 2
    d += ` Q ${p1.x} ${p1.y}, ${mx} ${my}`
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`
  return d
}

function Dragon({ paused, reduced, mobile }: DragonProps) {
  const ref = useRef<SVGSVGElement | null>(null)
  const pathRef = useRef<SVGPathElement | null>(null)
  const [flightId, setFlightId] = useState(0)
  const [flightActive, setFlightActive] = useState(false)
  const { w, h } = useViewportSize()

  // Schedule next flight every 60-90s (120-180s on mobile).
  useEffect(() => {
    if (reduced || paused) return
    const minMs = mobile ? 120_000 : 60_000
    const maxMs = mobile ? 180_000 : 90_000
    const wait = minMs + Math.random() * (maxMs - minMs)
    // Kick off the first flight in a shorter window so the user sees it.
    const firstWait = flightId === 0 ? Math.min(wait, 12_000) : wait
    const id = window.setTimeout(() => {
      setFlightActive(true)
    }, firstWait)
    return () => window.clearTimeout(id)
  }, [flightId, paused, reduced, mobile])

  // Animate the flight + body undulation.
  useEffect(() => {
    if (!flightActive || reduced) return
    const DURATION = 15_000 // ms — full screen traversal
    const start = performance.now()
    // Start off-screen left at random vertical center; serpentine across.
    const yCenter = (0.18 + Math.random() * 0.5) * h
    const totalTravel = w + 600
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - start
      const u = Math.min(1, elapsed / DURATION)
      // Position along arc: x linear, y modulated by sine for serpentine path.
      const x = -300 + totalTravel * u
      const y = yCenter + Math.sin(u * Math.PI * 3) * 60
      const undulation = (elapsed / 700) % 1
      const angle = Math.cos(u * Math.PI * 3) * 18 // tilt toward motion
      if (ref.current) {
        ref.current.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg)`
      }
      if (pathRef.current) {
        pathRef.current.setAttribute('d', buildDragonBodyPath(undulation))
      }
      if (u < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setFlightActive(false)
        setFlightId(id => id + 1)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [flightActive, reduced, w, h])

  // When reduced motion is on, render a static dragon up in a corner of the
  // viewport so the theme still hints at it.
  const wrapStyle: CSSProperties = reduced
    ? {
        position: 'fixed',
        left: '10%',
        top: '15%',
        transform: 'rotate(-8deg)',
        opacity: 0.35,
        pointerEvents: 'none',
        zIndex: 47,
      }
    : {
        position: 'fixed',
        left: 0,
        top: 0,
        transform: 'translate3d(-400px, 30vh, 0)',
        willChange: 'transform',
        pointerEvents: 'none',
        opacity: flightActive ? 0.85 : 0,
        transition: 'opacity 500ms ease',
        zIndex: 47,
      }

  return (
    <svg
      ref={ref}
      width="500" height="120" viewBox="-20 -60 500 120"
      style={wrapStyle}
      aria-hidden
    >
      <defs>
        <linearGradient id="av-dragon-body" x1="0" x2="1">
          <stop offset="0%"  stopColor="#5C0F0F" />
          <stop offset="60%" stopColor="#8B1A1A" />
          <stop offset="100%" stopColor="#C9A227" />
        </linearGradient>
      </defs>
      {/* Body — long serpentine path, brushy stroke */}
      <path
        ref={pathRef}
        d={buildDragonBodyPath(0)}
        fill="none"
        stroke="url(#av-dragon-body)"
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.92"
      />
      {/* Mane along first third of body — tufts as small wedges */}
      <g fill="#8B1A1A" opacity="0.85">
        <path d="M 20 -8 l -8 -10 l 4 0 l -2 -6 l 9 6 z" />
        <path d="M 50 -12 l -8 -10 l 4 0 l -2 -6 l 9 6 z" />
        <path d="M 80 -10 l -8 -10 l 4 0 l -2 -6 l 9 6 z" />
      </g>
      {/* Head with horn + eye + whisker */}
      <g>
        <ellipse cx="6" cy="0" rx="18" ry="12" fill="#8B1A1A" stroke="#5C0F0F" strokeWidth="1.5" />
        <path d="M -8 -8 l -10 -14 l 4 2 l -2 -8 l 12 14 z" fill="#C9A227" />
        <circle cx="2" cy="-3" r="2.4" fill="#F4ECD8" />
        <circle cx="2" cy="-3" r="1.2" fill="#1A1410" />
        <path d="M -10 4 q -14 4 -22 12" stroke="#C9A227" strokeWidth="1.4" fill="none" />
        <path d="M -8 7  q -14 8 -18 18" stroke="#8B1A1A" strokeWidth="1.4" fill="none" />
      </g>
      {/* Claws — three small wedges off the body */}
      <g fill="#C9A227" opacity="0.9">
        <path d="M 160 18 l -3 9 l 3 -2 l 2 8 l 2 -8 l 3 2 z" />
        <path d="M 300 14 l -3 9 l 3 -2 l 2 8 l 2 -8 l 3 2 z" />
      </g>
      {/* Tail flick */}
      <path
        d="M 430 0 q 24 -6 36 -20 q -6 16 -14 26 q 14 -2 22 -8"
        stroke="#8B1A1A" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.85"
      />
    </svg>
  )
}

// ---------- root decorations ----------

interface Props {
  /** True when the rice paper + ink mountains should show.
   *  False on the M tab (visualizer underneath). */
  showBackdrop: boolean
}

export default function AsianVibrantDecorations({ showBackdrop }: Props) {
  const reduced = useReducedMotion()
  const visible = useDocumentVisible()
  const { mobile } = useViewportSize()
  const paused = !visible

  return (
    <>
      <RicePaperBackdrop visible={showBackdrop} />
      <InkMountains visible={showBackdrop} />
      <KanjiColumns paused={paused} reduced={reduced} mobile={mobile} />
      <Petals paused={paused} reduced={reduced} mobile={mobile} />
      <Dragon paused={paused} reduced={reduced} mobile={mobile} />
    </>
  )
}
