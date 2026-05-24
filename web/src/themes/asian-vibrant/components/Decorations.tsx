import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

/**
 * Asian Vibrant — decorative environment layers (rebuild).
 *
 * Five overlays:
 *   1. Rice-paper backdrop  (non-M routes — replaces fog)
 *   2. Ink-wash mountains   (non-M routes, slow 1-2px sway)
 *   3. Kanji columns        (all routes, ONE shared RAF across all columns)
 *   4. Cherry petals        (all routes, five-lobed blossom silhouette)
 *   5. Dragon               (all routes, every 60-90s, 15s crossing)
 *
 * Performance contract:
 *   - prefers-reduced-motion: freeze every animation to a single
 *     static frame.
 *   - document.visibilityState === 'hidden': pause every loop.
 *   - Kanji + petals throttled to ~30fps via RAF gate.
 *   - Dragon uses a single SVG <path> + transform — no per-frame
 *     DOM creation.
 *
 * Mobile (width < 600px):
 *   - 4 kanji columns → 2
 *   - 8 petals → 4
 *   - Dragon interval doubled
 *
 * Audit fixes consolidated into this rebuild:
 *   B3 — kanji wrap calc now includes 12px per-row padding
 *   B4 — all kanji columns share a single RAF (was 4 separate RAFs)
 *   B5 — RAF resume no longer stalls one frame
 *   B6 — petal initial position seeded via useLayoutEffect
 *   V5 — mountains have slow horizontal sway
 *   V6 — dragon stripped to single brushstroke body + head
 *   V7 — petal silhouette is now five-lobed
 */

// ---------- character pool ----------

const KANJI_POOL = [
  '山','川','月','日','風','雨','雲','雪','春','夏','秋','冬','花','木','鳥','魚',
  '水','火','土','金','石','海','空','星','光','影','朝','夜','音','声','歌','詩',
  '書','画','紙','墨','筆','茶','竹','松','梅','桜','蘭','菊','鶴','龍','雀','蝶',
  '時','流','静','響',
]

const KANJI_ROW_PADDING_Y = 6 // px per side -> 12px total row padding (audit B3)

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

interface LayerVisibleProps { visible: boolean }

function RicePaperBackdrop({ visible }: LayerVisibleProps) {
  const style: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'var(--av-paper-grain)',
    opacity: visible ? 1 : 0,
    transition: 'opacity 400ms ease',
    pointerEvents: visible ? 'auto' : 'none',
    zIndex: 40,
  }
  const noise: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.32 0 0 0 0 0.24 0 0 0 0 0.16 0 0 0 0.16 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
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

function InkMountains({ visible, reduced }: LayerVisibleProps & { reduced: boolean }) {
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
    // V5: subtle horizontal sway. Frozen under reduced motion.
    animation: reduced ? undefined : 'avMountainSway 40s ease-in-out infinite',
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
      <path
        d="M0,360 C 120,280 200,320 320,260 C 460,200 560,300 700,240 C 840,190 980,300 1120,250 C 1260,210 1380,290 1600,240 L 1600,600 L 0,600 Z"
        fill="url(#av-ridge-back)"
        filter="url(#av-ridge-blur)"
      />
      <path
        d="M0,440 C 100,380 220,460 340,400 C 460,340 580,440 720,390 C 860,350 1000,440 1140,400 C 1280,360 1420,440 1600,400 L 1600,600 L 0,600 Z"
        fill="url(#av-ridge-front)"
      />
      <g fill="rgba(26,20,16,0.55)" opacity="0.7">
        <path d="M430,408 l3,-14 l-2,0 l2,-5 l2,5 l-2,0 l3,14 z" />
        <path d="M450,412 l2,-10 l-1,0 l2,-4 l2,4 l-1,0 l2,10 z" />
        <path d="M1080,406 l3,-14 l-2,0 l2,-5 l2,5 l-2,0 l3,14 z" />
      </g>
    </svg>
  )
}

// ---------- kanji columns (consolidated RAF) ----------

interface KanjiColumnSpec {
  side: 'left' | 'right'
  offset: number       // px from edge
  speed: number        // px per second
  size: number         // font size px
  color: string
  charCount: number
}

interface KanjiColumnsProps {
  paused: boolean
  reduced: boolean
  mobile: boolean
}

/**
 * One RAF drives all columns. Each column holds its own DOM ref +
 * scroll offset; the loop iterates them once per frame and writes a
 * single transform per column. Replaces 4 independent RAF loops
 * (audit B4).
 */
function KanjiColumns({ paused, reduced, mobile }: KanjiColumnsProps) {
  const specs: KanjiColumnSpec[] = useMemo(
    () => mobile
      ? [
          { side: 'left',  offset: 10, speed: 14, size: 22, color: 'rgba(139,26,26,0.18)', charCount: 22 },
          { side: 'right', offset: 10, speed: 11, size: 22, color: 'rgba(201,162,39,0.20)', charCount: 22 },
        ]
      : [
          { side: 'left',  offset: 16, speed: 16, size: 26, color: 'rgba(139,26,26,0.22)', charCount: 26 },
          { side: 'left',  offset: 60, speed: 11, size: 20, color: 'rgba(201,162,39,0.22)', charCount: 30 },
          { side: 'right', offset: 16, speed: 14, size: 26, color: 'rgba(201,162,39,0.22)', charCount: 28 },
          { side: 'right', offset: 60, speed:  9, size: 20, color: 'rgba(139,26,26,0.22)', charCount: 32 },
        ],
    [mobile]
  )

  // Stable per-column random sequence — regenerates only when specs change.
  const sequences = useMemo(
    () => specs.map(s => randomKanjiSequence(s.charCount)),
    [specs]
  )

  const refs = useRef<Array<HTMLDivElement | null>>([])
  const offsetsRef = useRef<number[]>(specs.map(() => 0))
  const lastTimeRef = useRef(0)

  // Reset offsets when specs change shape (mobile flip).
  useEffect(() => {
    offsetsRef.current = specs.map(() => 0)
  }, [specs])

  useEffect(() => {
    if (reduced || paused) {
      lastTimeRef.current = 0
      return
    }
    let raf = 0
    const FRAME_GATE = 33 // ~30fps
    const tick = (t: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = t
      const dt = t - lastTimeRef.current
      if (dt >= FRAME_GATE) {
        for (let i = 0; i < specs.length; i++) {
          const s = specs[i]
          const rowH = s.size + KANJI_ROW_PADDING_Y * 2 // audit B3
          const wrap = rowH * sequences[i].length
          let off = offsetsRef.current[i] + (s.speed * dt) / 1000
          if (off >= wrap) off -= wrap
          offsetsRef.current[i] = off
          const el = refs.current[i]
          if (el) el.style.transform = `translate3d(0, ${off}px, 0)`
        }
        lastTimeRef.current = t
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      lastTimeRef.current = 0
    }
  }, [paused, reduced, specs, sequences])

  return (
    <>
      {specs.map((s, i) => {
        const wrapStyle: CSSProperties = {
          position: 'fixed',
          top: 0,
          [s.side]: `${s.offset}px`,
          width: `${s.size + 8}px`,
          height: '100vh',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 45,
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        }
        const innerStyle: CSSProperties = {
          fontFamily: "'Ma Shan Zheng', serif",
          fontSize: `${s.size}px`,
          lineHeight: 1,
          color: s.color,
          textAlign: 'center',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
        }
        const seq = sequences[i]
        return (
          <div key={`${s.side}-${s.offset}`} style={wrapStyle} aria-hidden>
            <div ref={el => { refs.current[i] = el }} style={innerStyle}>
              {/* Sequence rendered twice for seamless wrap. */}
              {[...seq, ...seq].map((ch, j) => (
                <div key={j} style={{ padding: `${KANJI_ROW_PADDING_Y}px 0` }}>{ch}</div>
              ))}
            </div>
          </div>
        )
      })}
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

  // Initialize specs once per COUNT change.
  if (specsRef.current.length !== COUNT) {
    specsRef.current = Array.from({ length: COUNT }, (_, i) => makePetal(i))
  }

  // Audit B6: seed initial position BEFORE paint via useLayoutEffect.
  // useViewportSize starts with the real viewport on mount so this
  // mostly catches resize between mount and first RAF.
  useLayoutEffect(() => {
    for (let i = 0; i < specsRef.current.length; i++) {
      const p = specsRef.current[i]
      const el = refs.current[i]
      if (!el) continue
      el.style.transform = `translate3d(${(p.x * w).toFixed(1)}px, ${(p.y * h).toFixed(1)}px, 0) rotate(${p.rot}deg)`
    }
  }, [w, h])

  useEffect(() => {
    if (reduced || paused) {
      lastTime.current = 0
      return
    }
    let raf = 0
    const FRAME_GATE = 33
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
  }, [paused, reduced, w, h])

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 46, overflow: 'hidden' }} aria-hidden>
      {specsRef.current.map((p, i) => {
        const fill = p.hue < 0.5 ? '#F8C8DC' : '#E89BB5'
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
              willChange: 'transform',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.10))',
              opacity: 0.85,
            }}
          >
            <FiveLobePetal size={p.size} fill={fill} />
          </div>
        )
      })}
    </div>
  )
}

/**
 * Five-lobed cherry blossom silhouette (audit V7).
 * Five teardrop petals fanning from a center point at 72° intervals,
 * notched tips — reads unmistakably as cherry blossom even at small
 * sizes.
 */
function FiveLobePetal({ size, fill }: { size: number; fill: string }) {
  const cx = 16
  const cy = 16
  const lobes: string[] = []
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    const tipX = cx + Math.cos(a) * 12
    const tipY = cy + Math.sin(a) * 12
    const lx = cx + Math.cos(a - 0.5) * 6
    const ly = cy + Math.sin(a - 0.5) * 6
    const rx = cx + Math.cos(a + 0.5) * 6
    const ry = cy + Math.sin(a + 0.5) * 6
    // Outline an almond petal from base via two quadratic curves.
    lobes.push(`M ${cx} ${cy} Q ${lx.toFixed(1)} ${ly.toFixed(1)}, ${tipX.toFixed(1)} ${tipY.toFixed(1)} Q ${rx.toFixed(1)} ${ry.toFixed(1)}, ${cx} ${cy} Z`)
  }
  return (
    <svg viewBox="0 0 32 32" width={size} height={size}>
      <g fill={fill} stroke="rgba(139,26,26,0.45)" strokeWidth="0.6" strokeLinejoin="round">
        {lobes.map((d, i) => <path key={i} d={d} />)}
      </g>
      <circle cx="16" cy="16" r="1.4" fill="rgba(139,26,26,0.5)" />
    </svg>
  )
}

// ---------- dragon ----------

interface DragonProps {
  paused: boolean
  reduced: boolean
  mobile: boolean
}

/** Build a serpentine SVG path for the dragon body. */
function buildDragonBodyPath(t: number): string {
  const segCount = 14
  const segLen = 30
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= segCount; i++) {
    const x = i * segLen
    const phase = t * Math.PI * 2 + i * 0.55
    const y = Math.sin(phase) * 22 + Math.sin(phase * 1.7) * 6
    pts.push({ x, y })
  }
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

/**
 * Dragon — single brushstroke body + minimal head silhouette
 * (audit V6 fix). Removed mane tufts, eye whisker, claws, tail flick
 * — the form reads as dragon at glance via the long serpentine spine
 * and a small horned head.
 */
function Dragon({ paused, reduced, mobile }: DragonProps) {
  const ref = useRef<SVGSVGElement | null>(null)
  const pathRef = useRef<SVGPathElement | null>(null)
  const [flightId, setFlightId] = useState(0)
  const [flightActive, setFlightActive] = useState(false)
  const { w, h } = useViewportSize()

  useEffect(() => {
    if (reduced || paused) return
    const minMs = mobile ? 120_000 : 60_000
    const maxMs = mobile ? 180_000 : 90_000
    const wait = minMs + Math.random() * (maxMs - minMs)
    const firstWait = flightId === 0 ? Math.min(wait, 12_000) : wait
    const id = window.setTimeout(() => {
      setFlightActive(true)
    }, firstWait)
    return () => window.clearTimeout(id)
  }, [flightId, paused, reduced, mobile])

  useEffect(() => {
    if (!flightActive || reduced) return
    const DURATION = 15_000
    const start = performance.now()
    const yCenter = (0.18 + Math.random() * 0.5) * h
    const totalTravel = w + 600
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - start
      const u = Math.min(1, elapsed / DURATION)
      const x = -300 + totalTravel * u
      const y = yCenter + Math.sin(u * Math.PI * 3) * 60
      const undulation = (elapsed / 700) % 1
      const angle = Math.cos(u * Math.PI * 3) * 18
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
      {/* Body — single serpentine brushstroke. */}
      <path
        ref={pathRef}
        d={buildDragonBodyPath(0)}
        fill="none"
        stroke="url(#av-dragon-body)"
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.92"
      />
      {/* Head — minimal silhouette: brushed teardrop with one horn. */}
      <g>
        <path
          d="M -6 0 Q 4 -10 12 -2 Q 14 6 4 8 Q -8 8 -6 0 Z"
          fill="#8B1A1A"
          stroke="#5C0F0F"
          strokeWidth="1.2"
        />
        <path d="M -2 -8 L -10 -22 L -4 -20 Z" fill="#C9A227" opacity="0.9" />
      </g>
    </svg>
  )
}

// ---------- root decorations ----------

interface Props {
  /** True when rice paper + ink mountains should show.
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
      <InkMountains visible={showBackdrop} reduced={reduced} />
      <KanjiColumns paused={paused} reduced={reduced} mobile={mobile} />
      <Petals paused={paused} reduced={reduced} mobile={mobile} />
      <Dragon paused={paused} reduced={reduced} mobile={mobile} />
    </>
  )
}
