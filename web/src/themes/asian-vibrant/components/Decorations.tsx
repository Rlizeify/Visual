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
  // Bullet-proof viewport coverage: explicit 100vw × 100vh PLUS inset:0,
  // pointer-events:none always, never auto. Layered: pink-cream base
  // gradient mesh + tiled noise + vignette + ink-wash watermarks.
  const style: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    minHeight: '100vh',
    background: 'var(--av-paper-grain)',
    opacity: visible ? 1 : 0,
    transition: 'opacity 400ms ease',
    pointerEvents: 'none',
    zIndex: 40,
    overflow: 'hidden',
  }
  // Noise rendered into a 256x256 tile via static SVG (no filter region
  // gotcha — feTurbulence is wrapped in a single rect inside the tile,
  // so it tiles cleanly across any viewport size).
  const noise: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'><filter id='n' x='0' y='0' width='100%25' height='100%25'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.32 0 0 0 0 0.24 0 0 0 0 0.16 0 0 0 0.18 0'/></filter><rect x='0' y='0' width='256' height='256' filter='url(%23n)'/></svg>\")",
    backgroundRepeat: 'repeat',
    backgroundSize: '256px 256px',
    mixBlendMode: 'multiply',
    opacity: 0.55,
    pointerEvents: 'none',
  }
  const vignette: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'var(--av-paper-vignette)',
    pointerEvents: 'none',
    mixBlendMode: 'multiply',
  }
  // Distant ink-wash watermark blobs — quiet under everything.
  const watermark: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(ellipse 60% 30% at 15% 8%, rgba(45,62,102,0.10), transparent 60%),' +
      'radial-gradient(ellipse 40% 20% at 88% 14%, rgba(160,0,28,0.08), transparent 65%),' +
      'radial-gradient(ellipse 50% 22% at 92% 78%, rgba(91,15,15,0.10), transparent 60%)',
    pointerEvents: 'none',
  }
  return (
    <div style={style} aria-hidden>
      <div style={noise} />
      <div style={watermark} />
      <div style={vignette} />
    </div>
  )
}

function InkMountains({ visible, reduced }: LayerVisibleProps & { reduced: boolean }) {
  const style: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52vh',
    opacity: visible ? 1 : 0,
    transition: 'opacity 500ms ease',
    pointerEvents: 'none',
    zIndex: 41,
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
        <linearGradient id="av-ridge-farthest" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(45,62,102,0)" />
          <stop offset="100%" stopColor="rgba(45,62,102,0.18)" />
        </linearGradient>
        <linearGradient id="av-ridge-back" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(26,20,16,0)" />
          <stop offset="100%" stopColor="rgba(91,15,15,0.28)" />
        </linearGradient>
        <linearGradient id="av-ridge-mid" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(26,20,16,0.05)" />
          <stop offset="100%" stopColor="rgba(26,20,16,0.42)" />
        </linearGradient>
        <linearGradient id="av-ridge-front" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(26,20,16,0.18)" />
          <stop offset="100%" stopColor="rgba(26,20,16,0.62)" />
        </linearGradient>
        <filter id="av-ridge-blur"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id="av-ridge-blur-soft"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      {/* Layer 1 — farthest, indigo wash */}
      <path
        d="M0,300 C 140,240 280,290 420,250 C 560,210 700,280 840,240 C 980,200 1120,270 1260,230 C 1400,200 1500,260 1600,230 L 1600,600 L 0,600 Z"
        fill="url(#av-ridge-farthest)"
        filter="url(#av-ridge-blur)"
      />
      {/* Layer 2 — back, crimson wash */}
      <path
        d="M0,380 C 120,300 220,340 340,290 C 480,230 580,330 720,270 C 860,220 1000,330 1140,280 C 1280,240 1400,320 1600,270 L 1600,600 L 0,600 Z"
        fill="url(#av-ridge-back)"
        filter="url(#av-ridge-blur)"
      />
      {/* Layer 3 — mid */}
      <path
        d="M0,440 C 100,380 220,460 340,400 C 460,340 580,440 720,390 C 860,350 1000,440 1140,400 C 1280,360 1420,440 1600,400 L 1600,600 L 0,600 Z"
        fill="url(#av-ridge-mid)"
        filter="url(#av-ridge-blur-soft)"
      />
      {/* Layer 4 — front, darkest */}
      <path
        d="M0,510 C 130,470 240,520 360,485 C 480,450 600,510 720,475 C 840,445 960,505 1080,475 C 1200,450 1340,505 1600,475 L 1600,600 L 0,600 Z"
        fill="url(#av-ridge-front)"
      />
      {/* Pagoda silhouettes on mid ridge */}
      <g fill="rgba(26,20,16,0.65)" opacity="0.85">
        <path d="M430,408 l3,-14 l-2,0 l2,-5 l2,5 l-2,0 l3,14 z" />
        <path d="M450,412 l2,-10 l-1,0 l2,-4 l2,4 l-1,0 l2,10 z" />
        <path d="M1080,406 l3,-14 l-2,0 l2,-5 l2,5 l-2,0 l3,14 z" />
        <path d="M820,400 l4,-18 l-2,0 l2,-6 l2,6 l-2,0 l4,18 z" />
      </g>
      {/* Small pine trees on front ridge */}
      <g fill="rgba(26,20,16,0.75)" opacity="0.85">
        <path d="M280,485 l-4,8 l3,0 l-3,6 l3,0 l-3,5 l8,0 l-3,-5 l3,0 l-3,-6 l3,0 z" />
        <path d="M620,480 l-3,7 l2,0 l-2,5 l2,0 l-2,4 l6,0 l-2,-4 l2,0 l-2,-5 l2,-7 z" />
        <path d="M1180,478 l-4,8 l3,0 l-3,6 l3,0 l-3,5 l8,0 l-3,-5 l3,0 l-3,-6 l3,-8 z" />
      </g>
    </svg>
  )
}

/**
 * Sun disk — large, deep crimson, upper-right. Visible only when the
 * backdrop is visible (non-M routes). No animation; this is a fixed
 * scenic anchor like the sun in the reference image.
 */
function SunDisk({ visible }: LayerVisibleProps) {
  const style: CSSProperties = {
    position: 'fixed',
    top: '8vh',
    right: '7vw',
    width: '180px',
    height: '180px',
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: 'opacity 600ms ease',
    zIndex: 41,
  }
  return (
    <svg style={style} viewBox="0 0 180 180" aria-hidden>
      <defs>
        <radialGradient id="av-sun-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C81530" />
          <stop offset="55%" stopColor="#A0001C" />
          <stop offset="92%" stopColor="#5C0F0F" />
          <stop offset="100%" stopColor="rgba(92,15,15,0)" />
        </radialGradient>
        <radialGradient id="av-sun-halo" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgba(212,160,23,0.32)" />
          <stop offset="60%" stopColor="rgba(212,160,23,0.12)" />
          <stop offset="100%" stopColor="rgba(212,160,23,0)" />
        </radialGradient>
      </defs>
      <circle cx={90} cy={90} r={88} fill="url(#av-sun-halo)" />
      <circle cx={90} cy={90} r={62} fill="url(#av-sun-fill)" />
      {/* Hairline gold rim */}
      <circle cx={90} cy={90} r={62} fill="none" stroke="rgba(212,160,23,0.55)" strokeWidth="0.8" />
    </svg>
  )
}

/**
 * Distant ink-wash clouds drifting near the top of the viewport.
 * Pure SVG, no animation (cloud movement would compete with petals
 * + dragon). Three wispy bands at varied heights.
 */
function DistantClouds({ visible }: LayerVisibleProps) {
  const style: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '40vh',
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: 'opacity 600ms ease',
    zIndex: 41,
  }
  return (
    <svg style={style} viewBox="0 0 1600 400" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="av-cloud-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(248,232,213,0.55)" />
          <stop offset="100%" stopColor="rgba(248,232,213,0.05)" />
        </linearGradient>
        <filter id="av-cloud-blur"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <g filter="url(#av-cloud-blur)">
        <path d="M-50,80 Q 100,40 240,72 Q 380,100 520,68 Q 680,40 820,72 Q 980,100 1120,68 Q 1280,38 1420,68 Q 1560,90 1660,70 L 1660,30 L -50,30 Z" fill="url(#av-cloud-fill)" />
        <path d="M-50,180 Q 160,140 320,170 Q 480,200 640,168 Q 800,140 960,170 Q 1120,200 1280,168 Q 1440,140 1660,168 L 1660,130 L -50,130 Z" fill="url(#av-cloud-fill)" opacity="0.7" />
        <path d="M-50,280 Q 200,250 400,275 Q 600,300 800,272 Q 1000,250 1200,275 Q 1400,300 1660,272 L 1660,230 L -50,230 Z" fill="url(#av-cloud-fill)" opacity="0.45" />
      </g>
      {/* A few crisp wave-pattern strokes on top */}
      <g fill="none" stroke="rgba(244,236,216,0.45)" strokeWidth="1.2" strokeLinecap="round">
        <path d="M120,110 q 30,-12 60,0 q 30,12 60,0 q 30,-12 60,0" />
        <path d="M900,130 q 28,-10 56,0 q 28,10 56,0" />
        <path d="M1280,90 q 26,-10 52,0 q 26,10 52,0" />
      </g>
    </svg>
  )
}

/**
 * Background calligraphy — one giant kanji watermark anchored bottom-
 * right at very low opacity. Reads as "scripture in the field"
 * without competing with foreground content.
 */
function BackgroundCalligraphy({ visible }: LayerVisibleProps) {
  const style: CSSProperties = {
    position: 'fixed',
    bottom: '4vh',
    right: '3vw',
    fontSize: 'clamp(220px, 36vw, 480px)',
    lineHeight: 1,
    fontFamily: "'Ma Shan Zheng', serif",
    color: 'rgba(91, 15, 15, 0.10)',
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: 'opacity 700ms ease',
    zIndex: 41,
    userSelect: 'none',
    filter: 'blur(0.4px)',
  }
  return <div style={style} aria-hidden>龍</div>
}

/**
 * Corner blossom branches — two absolutely positioned SVGs that keep
 * their natural aspect ratio in the top-left and bottom-right corners.
 * Gnarled dark-brown branch with cherry-blossom clusters per the
 * reference image.
 */
function CornerBranches({ visible }: LayerVisibleProps) {
  const wrap: CSSProperties = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: 'opacity 600ms ease',
    zIndex: 42,
  }
  return (
    <div style={wrap} aria-hidden>
      {/* Top-left branch */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '320px', height: '260px' }}
        viewBox="0 0 320 260"
      >
        <defs>
          <linearGradient id="av-branch-bark" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#3D2417" />
            <stop offset="100%" stopColor="#2A1A12" />
          </linearGradient>
        </defs>
        {/* Main gnarled branch */}
        <path
          d="M -20,-10 Q 40,30 80,50 Q 120,72 160,80 Q 200,86 240,72 Q 270,62 300,40"
          stroke="url(#av-branch-bark)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M -20,-10 Q 40,30 80,50 Q 120,72 160,80 Q 200,86 240,72 Q 270,62 300,40"
          stroke="rgba(60,30,15,0.45)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* Off-shoots */}
        <path d="M 80,50 Q 70,80 60,110 Q 56,130 70,150" stroke="url(#av-branch-bark)" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M 160,80 Q 170,110 165,140 Q 162,160 178,180" stroke="url(#av-branch-bark)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M 240,72 Q 252,100 248,130" stroke="url(#av-branch-bark)" strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Blossom clusters */}
        <g>
          {[
            { cx: 30, cy: 12, r: 8, deep: false },
            { cx: 60, cy: 36, r: 6, deep: true },
            { cx: 90, cy: 58, r: 9, deep: false },
            { cx: 70, cy: 90, r: 7, deep: false },
            { cx: 56, cy: 130, r: 8, deep: true },
            { cx: 130, cy: 70, r: 10, deep: false },
            { cx: 170, cy: 90, r: 7, deep: true },
            { cx: 165, cy: 140, r: 8, deep: false },
            { cx: 200, cy: 76, r: 9, deep: false },
            { cx: 240, cy: 62, r: 8, deep: true },
            { cx: 270, cy: 50, r: 10, deep: false },
            { cx: 248, cy: 130, r: 7, deep: false },
          ].map((b, i) => (
            <g key={i}>
              <circle cx={b.cx} cy={b.cy} r={b.r + 2} fill="rgba(244,166,192,0.45)" />
              <circle cx={b.cx} cy={b.cy} r={b.r} fill={b.deep ? '#E67098' : '#F4A6C0'} />
              <circle cx={b.cx} cy={b.cy} r={b.r * 0.4} fill="rgba(212,160,23,0.6)" />
            </g>
          ))}
        </g>
      </svg>

      {/* Bottom-right branch */}
      <svg
        style={{ position: 'absolute', bottom: 0, right: 0, width: '300px', height: '240px' }}
        viewBox="0 0 300 240"
      >
        <defs>
          <linearGradient id="av-branch-bark-2" x1="1" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="#3D2417" />
            <stop offset="100%" stopColor="#2A1A12" />
          </linearGradient>
        </defs>
        <path
          d="M 320,260 Q 260,220 220,200 Q 180,180 140,170 Q 100,165 60,180 Q 30,192 -10,220"
          stroke="url(#av-branch-bark-2)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M 220,200 Q 232,170 228,140 Q 224,118 240,90" stroke="url(#av-branch-bark-2)" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M 140,170 Q 132,140 138,110 Q 142,90 128,68" stroke="url(#av-branch-bark-2)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M 60,180 Q 50,150 56,120" stroke="url(#av-branch-bark-2)" strokeWidth="4" strokeLinecap="round" fill="none" />
        <g>
          {[
            { cx: 280, cy: 240, r: 9, deep: false },
            { cx: 250, cy: 210, r: 7, deep: true },
            { cx: 232, cy: 175, r: 9, deep: false },
            { cx: 240, cy: 130, r: 8, deep: true },
            { cx: 240, cy: 90, r: 10, deep: false },
            { cx: 200, cy: 192, r: 7, deep: false },
            { cx: 165, cy: 178, r: 8, deep: true },
            { cx: 138, cy: 130, r: 9, deep: false },
            { cx: 128, cy: 68, r: 10, deep: false },
            { cx: 90, cy: 175, r: 8, deep: false },
            { cx: 56, cy: 120, r: 7, deep: true },
            { cx: 20, cy: 210, r: 9, deep: false },
          ].map((b, i) => (
            <g key={i}>
              <circle cx={b.cx} cy={b.cy} r={b.r + 2} fill="rgba(244,166,192,0.45)" />
              <circle cx={b.cx} cy={b.cy} r={b.r} fill={b.deep ? '#E67098' : '#F4A6C0'} />
              <circle cx={b.cx} cy={b.cy} r={b.r * 0.4} fill="rgba(212,160,23,0.6)" />
            </g>
          ))}
        </g>
      </svg>
    </div>
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
          { side: 'left',  offset: 8,  speed: 14, size: 22, color: 'rgba(160,0,28,0.26)',   charCount: 22 },
          { side: 'left',  offset: 38, speed: 9,  size: 16, color: 'rgba(212,160,23,0.28)', charCount: 28 },
          { side: 'right', offset: 8,  speed: 11, size: 22, color: 'rgba(212,160,23,0.28)', charCount: 22 },
        ]
      : [
          { side: 'left',  offset: 14,  speed: 16, size: 28, color: 'rgba(160,0,28,0.30)',   charCount: 26 },
          { side: 'left',  offset: 58,  speed: 11, size: 20, color: 'rgba(212,160,23,0.30)', charCount: 30 },
          { side: 'left',  offset: 96,  speed: 8,  size: 16, color: 'rgba(45,62,102,0.22)',  charCount: 34 },
          { side: 'right', offset: 14,  speed: 14, size: 28, color: 'rgba(212,160,23,0.30)', charCount: 28 },
          { side: 'right', offset: 58,  speed: 9,  size: 20, color: 'rgba(160,0,28,0.28)',   charCount: 32 },
          { side: 'right', offset: 96,  speed: 6,  size: 16, color: 'rgba(91,15,15,0.20)',   charCount: 34 },
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
  // Polish: wider size range (8-32px) and more hue variation.
  return {
    id,
    x: Math.random(),
    y: Math.random() - 0.2,
    size: 8 + Math.random() * 24,
    speed: 14 + Math.random() * 28,
    drift: 20 + Math.random() * 44,
    rot: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 36,
    hue: Math.random(),
  }
}

interface PetalsProps {
  paused: boolean
  reduced: boolean
  mobile: boolean
}

function Petals({ paused, reduced, mobile }: PetalsProps) {
  const COUNT = mobile ? 8 : 18
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
        // Three-stop hue range: pale → saturated → deep pink.
        const fill = p.hue < 0.33 ? '#F8C8DC' : p.hue < 0.7 ? '#F4A6C0' : '#E67098'
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

// ---------- dragon (polish rebuild — fully illustrated) ----------

interface DragonProps {
  paused: boolean
  reduced: boolean
  mobile: boolean
}

/**
 * Body segment geometry. Each segment is an ellipse anchored to a
 * point along a serpentine spine. The spine is recomputed every frame
 * from a single phase variable, then segments + scales + underside
 * band + legs ride that spine via SVG transforms.
 */
const DRAGON_SEG_COUNT = 11
const DRAGON_SEG_SPACING = 46  // px between segment centers along x
const DRAGON_HEAD_X = 0         // head is at x=0; body extends +x
const DRAGON_TAIL_X = DRAGON_HEAD_X + DRAGON_SEG_COUNT * DRAGON_SEG_SPACING

/** Returns y(x, phase) — serpentine spine. */
function spineY(x: number, phase: number): number {
  const k = x / 60
  return Math.sin(phase + k) * 26 + Math.sin(phase * 1.6 + k * 0.7) * 6
}

/** Returns tangent angle (degrees) along the spine at x. */
function spineAngle(x: number, phase: number): number {
  const dx = 4
  const y1 = spineY(x - dx, phase)
  const y2 = spineY(x + dx, phase)
  return (Math.atan2(y2 - y1, dx * 2) * 180) / Math.PI
}

/** Per-segment radius — taper toward tail. */
function segmentRadius(i: number): { rx: number; ry: number } {
  if (i === 0) return { rx: 28, ry: 22 } // neck just behind head
  const t = i / DRAGON_SEG_COUNT
  const ry = 24 - t * 16     // 24 -> 8
  const rx = 30 - t * 18     // 30 -> 12
  return { rx, ry }
}

/**
 * Fully-illustrated Dragon — discrete head, mane, body segments,
 * scales, underside banding, two legs with 3-toed gold claws,
 * tapered tail with flame tuft. Body undulates via per-segment
 * transforms driven by a single RAF. Flies across the viewport every
 * 60-90s (120-180s on mobile).
 */
function Dragon({ paused, reduced, mobile }: DragonProps) {
  const wrapRef = useRef<SVGSVGElement | null>(null)
  const bodyRef = useRef<SVGGElement | null>(null)
  const phaseRef = useRef(0)
  const [flightId, setFlightId] = useState(0)
  const [flightActive, setFlightActive] = useState(false)
  const { w, h } = useViewportSize()

  // Wait, then trigger a flight.
  useEffect(() => {
    if (reduced || paused) return
    const minMs = mobile ? 120_000 : 60_000
    const maxMs = mobile ? 180_000 : 90_000
    const wait = minMs + Math.random() * (maxMs - minMs)
    const firstWait = flightId === 0 ? Math.min(wait, 12_000) : wait
    const id = window.setTimeout(() => setFlightActive(true), firstWait)
    return () => window.clearTimeout(id)
  }, [flightId, paused, reduced, mobile])

  // Flight RAF — drives wrapper position + per-segment transforms.
  useEffect(() => {
    if (!flightActive || reduced) return
    const DURATION = 17_000
    const start = performance.now()
    const yCenter = (0.16 + Math.random() * 0.42) * h
    const totalTravel = w + 800
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - start
      const u = Math.min(1, elapsed / DURATION)
      const x = -500 + totalTravel * u
      const y = yCenter + Math.sin(u * Math.PI * 2.4) * 70
      const angle = Math.cos(u * Math.PI * 2.4) * 14
      phaseRef.current = (elapsed / 650) * Math.PI * 2

      if (wrapRef.current) {
        wrapRef.current.style.transform =
          `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${angle.toFixed(1)}deg)`
      }

      // Drive segment transforms.
      if (bodyRef.current) {
        const groups = bodyRef.current.children
        const phase = phaseRef.current
        for (let i = 0; i < groups.length; i++) {
          const seg = groups[i] as SVGGElement
          const sx = parseFloat(seg.dataset.x || '0')
          const sy = spineY(sx, phase)
          const sa = spineAngle(sx, phase)
          seg.setAttribute('transform', `translate(${sx} ${sy}) rotate(${sa})`)
        }
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
        left: '8%',
        top: '14%',
        transform: 'rotate(-6deg)',
        opacity: 0.42,
        pointerEvents: 'none',
        zIndex: 47,
      }
    : {
        position: 'fixed',
        left: 0,
        top: 0,
        transform: 'translate3d(-600px, 28vh, 0)',
        willChange: 'transform',
        pointerEvents: 'none',
        opacity: flightActive ? 0.94 : 0,
        transition: 'opacity 600ms ease',
        zIndex: 47,
      }

  // Pre-compute segment x positions for the initial render.
  const segments = useMemo(() => {
    const out: Array<{ x: number; rx: number; ry: number; i: number }> = []
    for (let i = 0; i < DRAGON_SEG_COUNT; i++) {
      const x = DRAGON_HEAD_X + 40 + i * DRAGON_SEG_SPACING
      const { rx, ry } = segmentRadius(i)
      out.push({ x, rx, ry, i })
    }
    return out
  }, [])

  // Initial transform for non-flight render (head at origin).
  const initialPhase = 0

  return (
    <svg
      ref={wrapRef}
      width="700"
      height="240"
      viewBox="-80 -120 700 240"
      style={wrapStyle}
      aria-hidden
    >
      <defs>
        {/* Body fill: warm cream (matches reference). */}
        <linearGradient id="av-dragon-body-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F8E8D5" />
          <stop offset="55%" stopColor="#F4ECD8" />
          <stop offset="100%" stopColor="#E8D4B0" />
        </linearGradient>
        {/* Underside red banding. */}
        <linearGradient id="av-dragon-underside" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(160,0,28,0)" />
          <stop offset="45%" stopColor="rgba(160,0,28,0.85)" />
          <stop offset="100%" stopColor="#8B0000" />
        </linearGradient>
        {/* Mane gold. */}
        <linearGradient id="av-dragon-mane" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="55%" stopColor="#D4A017" />
          <stop offset="100%" stopColor="#8C6E15" />
        </linearGradient>
        {/* Claw gold (radial — three-dimensional). */}
        <radialGradient id="av-dragon-claw" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="70%" stopColor="#D4A017" />
          <stop offset="100%" stopColor="#8C6E15" />
        </radialGradient>
        {/* Tail flame. */}
        <radialGradient id="av-dragon-flame" cx="30%" cy="50%" r="80%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="40%" stopColor="#E34234" />
          <stop offset="100%" stopColor="rgba(160,0,28,0)" />
        </radialGradient>
        {/* Diamond scale pattern overlay. */}
        <pattern id="av-dragon-scales" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 5 0 L 10 5 L 5 10 L 0 5 Z" fill="none" stroke="rgba(26,20,16,0.45)" strokeWidth="0.6" />
        </pattern>
      </defs>

      {/* === TAIL === (drawn first so body overlaps it) */}
      <g id="dragon-tail">
        {/* Tail flame at tip */}
        <g transform={`translate(${DRAGON_TAIL_X + 30} ${spineY(DRAGON_TAIL_X + 30, initialPhase)})`}>
          <path d="M 0 0 Q 18 -14 30 -6 Q 36 0 30 8 Q 18 14 0 0 Z" fill="url(#av-dragon-flame)" />
          <path d="M 0 -4 Q 14 -18 26 -12 Q 16 -6 0 -4 Z" fill="#FFD700" opacity="0.85" />
          <path d="M 0 6 Q 16 18 28 12 Q 18 8 0 6 Z" fill="#E34234" opacity="0.85" />
        </g>
        {/* Tail tapered stroke */}
        <path
          d={`M ${DRAGON_TAIL_X} 0 Q ${DRAGON_TAIL_X + 15} 4 ${DRAGON_TAIL_X + 30} 0`}
          stroke="#1A1410"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* === BACK LEG === (between mid + tail segments) */}
      <g id="dragon-back-leg" transform={`translate(${DRAGON_HEAD_X + 40 + 7 * DRAGON_SEG_SPACING} 8)`}>
        {/* Upper leg */}
        <path
          d="M -4 0 Q -2 18 6 28 Q 12 36 18 38"
          stroke="#1A1410"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M -4 0 Q -2 18 6 28 Q 12 36 18 38"
          stroke="#F4ECD8"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* Three claws */}
        <g>
          <path d="M 14 36 L 13 50 L 16 42 Z" fill="url(#av-dragon-claw)" stroke="#5C3F00" strokeWidth="0.6" />
          <path d="M 18 38 L 19 54 L 22 44 Z" fill="url(#av-dragon-claw)" stroke="#5C3F00" strokeWidth="0.6" />
          <path d="M 22 36 L 25 50 L 27 40 Z" fill="url(#av-dragon-claw)" stroke="#5C3F00" strokeWidth="0.6" />
        </g>
      </g>

      {/* === BODY SEGMENTS === (driven by RAF) */}
      <g id="dragon-body" ref={bodyRef}>
        {segments.map((s) => (
          <g
            key={s.i}
            data-x={s.x}
            transform={`translate(${s.x} ${spineY(s.x, initialPhase)}) rotate(${spineAngle(s.x, initialPhase)})`}
          >
            {/* Cream body */}
            <ellipse cx={0} cy={0} rx={s.rx} ry={s.ry} fill="url(#av-dragon-body-fill)" stroke="#1A1410" strokeWidth="1.6" />
            {/* Red underside band */}
            <path
              d={`M ${-s.rx + 2} 2 Q 0 ${s.ry + 1} ${s.rx - 2} 2 L ${s.rx - 4} ${s.ry - 2} Q 0 ${s.ry * 1.1} ${-s.rx + 4} ${s.ry - 2} Z`}
              fill="url(#av-dragon-underside)"
              opacity="0.9"
            />
            {/* Horizontal hairline stripes on underside */}
            <line x1={-s.rx + 6} y1={s.ry * 0.55} x2={s.rx - 6} y2={s.ry * 0.55} stroke="#5C0F0F" strokeWidth="0.6" opacity="0.7" />
            <line x1={-s.rx + 4} y1={s.ry * 0.78} x2={s.rx - 4} y2={s.ry * 0.78} stroke="#5C0F0F" strokeWidth="0.6" opacity="0.5" />
            {/* Diamond scales on top half */}
            <ellipse cx={0} cy={-s.ry * 0.35} rx={s.rx * 0.85} ry={s.ry * 0.5} fill="url(#av-dragon-scales)" opacity="0.7" />
            {/* Dorsal fin tufts on every other segment */}
            {s.i % 2 === 0 && s.i > 0 && (
              <path
                d={`M ${-s.rx * 0.3} ${-s.ry + 1} Q 0 ${-s.ry - 8} ${s.rx * 0.3} ${-s.ry + 1} Z`}
                fill="url(#av-dragon-mane)"
                stroke="#5C3F00"
                strokeWidth="0.7"
                opacity="0.9"
              />
            )}
          </g>
        ))}
      </g>

      {/* === MANE === (behind head, flowing back over first segments) */}
      <g id="dragon-mane">
        <path
          d="M 4 -16 Q 28 -36 60 -28 Q 80 -22 100 -28 Q 80 -16 60 -18 Q 30 -16 4 -8 Z"
          fill="url(#av-dragon-mane)"
          stroke="#5C3F00"
          strokeWidth="0.9"
          opacity="0.95"
        />
        <path
          d="M 8 -10 Q 36 -24 70 -16 Q 100 -10 130 -16 Q 100 -4 70 -6 Q 40 -4 12 0 Z"
          fill="url(#av-dragon-mane)"
          stroke="#5C3F00"
          strokeWidth="0.7"
          opacity="0.75"
        />
        <path
          d="M 0 8 Q 22 18 50 16 Q 78 10 110 14 Q 78 22 50 24 Q 22 22 0 18 Z"
          fill="url(#av-dragon-mane)"
          stroke="#5C3F00"
          strokeWidth="0.7"
          opacity="0.7"
        />
      </g>

      {/* === FRONT LEG === (just behind head) */}
      <g id="dragon-front-leg" transform={`translate(${DRAGON_HEAD_X + 56} 10)`}>
        <path
          d="M -4 0 Q -8 22 -2 34 Q 4 42 12 44"
          stroke="#1A1410"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M -4 0 Q -8 22 -2 34 Q 4 42 12 44"
          stroke="#F4ECD8"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <g>
          <path d="M 8 42 L 6 58 L 10 48 Z" fill="url(#av-dragon-claw)" stroke="#5C3F00" strokeWidth="0.6" />
          <path d="M 12 44 L 13 60 L 16 50 Z" fill="url(#av-dragon-claw)" stroke="#5C3F00" strokeWidth="0.6" />
          <path d="M 16 42 L 19 56 L 21 46 Z" fill="url(#av-dragon-claw)" stroke="#5C3F00" strokeWidth="0.6" />
        </g>
      </g>

      {/* === HEAD === (leftmost, at origin) */}
      <g id="dragon-head">
        {/* Head main shape — elongated wedge with rounded back */}
        <path
          d="M -64 -8 Q -78 -6 -70 8 Q -64 18 -50 20 Q -34 22 -20 18 Q -8 14 -2 4 Q 4 -6 -2 -16 Q -10 -26 -28 -28 Q -50 -28 -64 -8 Z"
          fill="url(#av-dragon-body-fill)"
          stroke="#1A1410"
          strokeWidth="2"
        />
        {/* Snout shading */}
        <path d="M -76 0 Q -82 6 -74 10 Q -68 12 -64 8 Q -68 4 -76 0 Z" fill="url(#av-dragon-body-fill)" stroke="#1A1410" strokeWidth="1.6" />
        {/* Open mouth */}
        <path
          d="M -78 4 Q -74 10 -64 12 Q -56 12 -50 8 L -52 14 Q -60 18 -70 16 Q -78 14 -78 4 Z"
          fill="#5C0F0F"
          stroke="#1A1410"
          strokeWidth="1.4"
        />
        {/* Tongue */}
        <path d="M -68 10 Q -62 14 -54 11 L -56 13 Q -60 15 -64 14 Q -67 13 -68 10 Z" fill="#E34234" />
        {/* Teeth */}
        <g fill="#F8E8D5" stroke="#1A1410" strokeWidth="0.6">
          <path d="M -72 6 L -71 10 L -70 6 Z" />
          <path d="M -66 7 L -65 11 L -64 7 Z" />
          <path d="M -60 7 L -59 11 L -58 7 Z" />
          <path d="M -56 7 L -55 10 L -54 7 Z" />
        </g>
        {/* Lower jaw line accent */}
        <path d="M -64 12 Q -52 18 -36 18" stroke="#1A1410" strokeWidth="1" fill="none" opacity="0.6" />

        {/* Eye — white sclera + dark pupil + highlight */}
        <g>
          <ellipse cx={-30} cy={-10} rx={6.5} ry={5} fill="#F8E8D5" stroke="#1A1410" strokeWidth="1.2" />
          <ellipse cx={-30} cy={-9} rx={4} ry={4} fill="#1A1410" />
          <ellipse cx={-28} cy={-11} rx={1.6} ry={1.8} fill="#FFD700" />
          <ellipse cx={-31} cy={-10} rx={0.7} ry={0.9} fill="#F8E8D5" />
          {/* Brow ridge */}
          <path d="M -38 -18 Q -30 -22 -22 -18" stroke="#1A1410" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>

        {/* Horns — two curved gold horns sweeping back */}
        <g>
          <path
            d="M -18 -22 Q -12 -38 -22 -52 Q -14 -46 -10 -32 Q -8 -22 -14 -20 Z"
            fill="url(#av-dragon-mane)"
            stroke="#5C3F00"
            strokeWidth="1"
          />
          <path d="M -22 -52 Q -20 -56 -16 -54" stroke="#5C3F00" strokeWidth="0.8" fill="none" />
          <path
            d="M -32 -20 Q -32 -36 -42 -48 Q -36 -42 -30 -32 Q -28 -22 -32 -18 Z"
            fill="url(#av-dragon-mane)"
            stroke="#5C3F00"
            strokeWidth="1"
          />
        </g>

        {/* Whiskers — two long curving wisps from snout */}
        <g fill="none" stroke="#1A1410" strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
          <path d="M -72 0 Q -90 -14 -110 -8 Q -126 -4 -140 -16" />
          <path d="M -70 14 Q -88 26 -110 22 Q -126 18 -140 28" />
        </g>
        {/* Whisker gold tips */}
        <circle cx={-140} cy={-16} r={2} fill="#FFD700" />
        <circle cx={-140} cy={28} r={2} fill="#FFD700" />

        {/* Forehead ridge bump */}
        <path d="M -20 -22 Q -12 -28 -4 -20" stroke="#1A1410" strokeWidth="1.2" fill="none" opacity="0.7" />
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
      <BackgroundCalligraphy visible={showBackdrop} />
      <DistantClouds visible={showBackdrop} />
      <SunDisk visible={showBackdrop} />
      <InkMountains visible={showBackdrop} reduced={reduced} />
      <CornerBranches visible={showBackdrop} />
      <KanjiColumns paused={paused} reduced={reduced} mobile={mobile} />
      <Petals paused={paused} reduced={reduced} mobile={mobile} />
      <Dragon paused={paused} reduced={reduced} mobile={mobile} />
    </>
  )
}
