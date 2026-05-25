import { useEffect, useRef, useState, type CSSProperties } from 'react'

/**
 * AC-130 Thermal — persistent HUD decorations.
 *
 * Renders the always-on chrome that frames every route except /m:
 *   - Top-left timestamp / mode / offset plate (live clock).
 *   - Top-right lat/lon / alt / LOS plate (bounded drift).
 *   - Bottom-right FIRE/LASER/BORE/SEE status block (occasional flicker).
 *   - Bottom-left N: OFF — DISARM literal.
 *   - Optional centered reticle (uses --user-accent for the center pip).
 *   - Full-screen vignette + scan-line layers.
 *
 * On /m the visualizer dominates the screen, so most overlays go
 * transparent (still mounted to avoid layout shift). Scan lines +
 * vignette stay at very low alpha.
 *
 * Motion is gated by:
 *   - prefers-reduced-motion: reduce → everything frozen.
 *   - document.visibilityState === 'hidden' → RAF paused.
 *   - FRAME_GATE = 33ms → 30fps cap so this layer is cheap.
 */

const FRAME_GATE_MS = 33  // 30fps cap for the shared RAF.

// ----- hooks -----------------------------------------------------------

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduced
}

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState !== 'hidden'
  })
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handler = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])
  return visible
}

function useViewportSize() {
  const [size, setSize] = useState({ w: typeof window === 'undefined' ? 1024 : window.innerWidth, h: typeof window === 'undefined' ? 768 : window.innerHeight })
  useEffect(() => {
    if (typeof window === 'undefined') return
    let t: number | null = null
    const handler = () => {
      if (t !== null) window.cancelAnimationFrame(t)
      t = window.requestAnimationFrame(() => {
        setSize({ w: window.innerWidth, h: window.innerHeight })
        t = null
      })
    }
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
      if (t !== null) window.cancelAnimationFrame(t)
    }
  }, [])
  return size
}

// ----- deterministic seed from session ---------------------------------

/**
 * Generate a stable "home" position for this browser session.
 * Per-tab; resets on hard reload. Stays the same as the user
 * navigates within the SPA so the HUD doesn't teleport.
 */
function useSessionAnchor() {
  const [anchor] = useState(() => {
    const lat = -40 + Math.random() * 80         // -40 .. +40
    const lon = -180 + Math.random() * 360       // -180 .. +180
    const alt = 8000 + Math.random() * 4000      // 8000 .. 12000 ft
    const los = Math.floor(Math.random() * 360)
    return { lat, lon, alt, los }
  })
  return anchor
}

// ----- HUD plates -------------------------------------------------------

interface Props {
  /** When false (i.e. on /m), most overlays fade to near-zero so the
   * visualizer can breathe. Scan lines + vignette stay at low alpha. */
  showOverlays: boolean
}

export default function AC130ThermalDecorations({ showOverlays }: Props) {
  const reduced = useReducedMotion()
  const visible = useDocumentVisible()
  const { w: vw } = useViewportSize()
  const isMobile = vw < 600

  const anchor = useSessionAnchor()

  // Live state ticked by the shared RAF.
  const [now, setNow] = useState(() => new Date())
  const [drift, setDrift] = useState({ lat: 0, lon: 0, los: 0 })
  const [fireOn, setFireOn] = useState(true)
  const [hotSpots, setHotSpots] = useState<Array<{ id: number; x: number; y: number; r: number; bornAt: number }>>([])

  const lastTickRef = useRef<number>(0)
  const lastDriftRef = useRef<number>(0)
  const lastFireRef = useRef<number>(0)
  const lastHotRef = useRef<number>(0)
  const hotIdRef = useRef<number>(0)

  // Shared RAF loop.
  useEffect(() => {
    if (reduced || !visible) return
    let raf = 0
    let cancelled = false

    const loop = (t: number) => {
      if (cancelled) return
      if (t - lastTickRef.current >= FRAME_GATE_MS) {
        lastTickRef.current = t

        // 1-second clock tick.
        const nowMs = Date.now()
        setNow(new Date(nowMs))

        // 3-second coordinate drift tick.
        const driftInterval = isMobile ? 6000 : 3000
        if (t - lastDriftRef.current >= driftInterval) {
          lastDriftRef.current = t
          setDrift(d => {
            const nextLat = Math.max(-0.01, Math.min(0.01, d.lat + (Math.random() - 0.5) * 0.002))
            const nextLon = Math.max(-0.01, Math.min(0.01, d.lon + (Math.random() - 0.5) * 0.002))
            const nextLos = (d.los + (Math.random() - 0.5) * 0.6 + 360) % 360
            return { lat: nextLat, lon: nextLon, los: nextLos }
          })
        }

        // 2-second fire-flicker tick (1-in-20 chance to flicker).
        if (t - lastFireRef.current >= 2000) {
          lastFireRef.current = t
          if (Math.random() < 0.05) {
            setFireOn(false)
            window.setTimeout(() => setFireOn(true), 80)
          }
        }

        // 8-15s thermal hot-spot tick.
        const hotInterval = isMobile ? 16000 : 8000
        if (t - lastHotRef.current >= hotInterval + Math.random() * 7000) {
          lastHotRef.current = t
          const count = isMobile ? 1 : 1 + Math.floor(Math.random() * 2)
          const fresh: typeof hotSpots = []
          for (let i = 0; i < count; i++) {
            fresh.push({
              id: ++hotIdRef.current,
              x: 8 + Math.random() * 84,
              y: 12 + Math.random() * 76,
              r: 30 + Math.random() * 60,
              bornAt: nowMs,
            })
          }
          setHotSpots(prev => [...prev.filter(s => nowMs - s.bornAt < 3000), ...fresh])
        } else {
          // Expire stale hot spots.
          setHotSpots(prev => {
            const filtered = prev.filter(s => nowMs - s.bornAt < 3000)
            return filtered.length === prev.length ? prev : filtered
          })
        }
      }
      raf = window.requestAnimationFrame(loop)
    }

    raf = window.requestAnimationFrame(loop)
    return () => {
      cancelled = true
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [reduced, visible, isMobile])

  // ---- formatters ------------------------------------------------------

  const pad2 = (n: number) => String(Math.floor(n)).padStart(2, '0')
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const ddmmyyyy = `${pad2(now.getUTCDate())}${months[now.getUTCMonth()]}${now.getUTCFullYear()}`
  const hhmmss = `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}:${pad2(now.getUTCSeconds())}`

  const fmtLat = (deg: number) => {
    const hemi = deg >= 0 ? 'N' : 'S'
    const abs = Math.abs(deg)
    const d = Math.floor(abs)
    const m = (abs - d) * 60
    return `${hemi} ${pad2(d)}°${m.toFixed(3)}'`
  }
  const fmtLon = (deg: number) => {
    const hemi = deg >= 0 ? 'E' : 'W'
    const abs = Math.abs(deg)
    const d = Math.floor(abs)
    const m = (abs - d) * 60
    return `${hemi} ${String(d).padStart(3, '0')}°${m.toFixed(3)}'`
  }

  // ---- style helpers ---------------------------------------------------

  const hudAlpha = showOverlays ? 1 : 0.20
  const fadeStyle: CSSProperties = {
    opacity: hudAlpha,
    transition: 'opacity 280ms linear',
  }

  const plateBase: CSSProperties = {
    position: 'fixed',
    fontFamily: 'var(--ac-font-mono)',
    fontSize: '10px',
    letterSpacing: '0.16em',
    color: 'var(--ac-phosphor)',
    textShadow: '0 0 4px rgba(255, 255, 255, 0.45)',
    pointerEvents: 'none',
    zIndex: 47,
    lineHeight: 1.5,
    textTransform: 'uppercase',
    ...fadeStyle,
  }

  // ---- compass tape (top-center) ---------------------------------------

  const compassHeading = Math.floor((anchor.los + drift.los) % 360)
  const compassTicks: Array<{ label: string; offset: number }> = []
  // 9 ticks centered on heading, every 10°.
  for (let i = -4; i <= 4; i++) {
    const deg = (compassHeading + i * 10 + 360) % 360
    let label = String(deg).padStart(3, '0')
    if (deg === 0) label = 'N'
    else if (deg === 90) label = 'E'
    else if (deg === 180) label = 'S'
    else if (deg === 270) label = 'W'
    compassTicks.push({ label, offset: i })
  }

  // ---- render ----------------------------------------------------------

  return (
    <>
      {/* Vignette + scan lines — always on, even on /m. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
          background: 'var(--ac-vignette)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 41,
          backgroundImage: 'var(--ac-scanline-bg)',
          backgroundRepeat: 'repeat',
          opacity: showOverlays ? 1 : 0.6,
          animation: reduced ? undefined : 'ac-scanline-drift 10s linear infinite',
        }}
      />

      {/* Thermal hot spots — soft white blobs. Suppressed on /m. */}
      {showOverlays && hotSpots.map(s => {
        const age = Date.now() - s.bornAt
        const t = Math.min(1, age / 3000)
        // ease-in-out fade: peak at 50%
        const alpha = 0.25 * Math.sin(Math.PI * t)
        return (
          <div
            key={s.id}
            aria-hidden
            style={{
              position: 'fixed',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.r}px`,
              height: `${s.r}px`,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(255,255,255,${alpha}) 0%, rgba(255,255,255,0) 70%)`,
              pointerEvents: 'none',
              zIndex: 42,
            }}
          />
        )
      })}

      {/* Top-left plate: timestamp / mode / offset */}
      <div style={{
        ...plateBase,
        top: '8px',
        left: '8px',
        textAlign: 'left',
      }}>
        <div>{ddmmyyyy} AVT</div>
        <div>{hhmmss} UTC</div>
        <div style={{ color: 'var(--ac-phosphor-dim)' }}>MODE: WHOT</div>
        <div style={{ color: 'var(--ac-phosphor-dim)' }}>OFFSET +0.0</div>
      </div>

      {/* Top-right plate: coordinates / altitude / LOS */}
      <div style={{
        ...plateBase,
        top: '8px',
        right: '8px',
        textAlign: 'right',
      }}>
        <div>{fmtLat(anchor.lat + drift.lat)}</div>
        <div>{fmtLon(anchor.lon + drift.lon)}</div>
        <div style={{ color: 'var(--ac-phosphor-dim)' }}>
          ALT {Math.floor(anchor.alt).toString().padStart(5, '0')} FT
        </div>
        <div style={{ color: 'var(--ac-phosphor-dim)' }}>
          LOS {compassHeading.toString().padStart(3, '0')}°
        </div>
      </div>

      {/* Top-center compass tape (desktop only) */}
      {!isMobile && (
        <div style={{
          ...plateBase,
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '14px',
          fontSize: '9px',
          letterSpacing: '0.12em',
        }}>
          {compassTicks.map((t, i) => (
            <span
              key={i}
              style={{
                color: t.offset === 0 ? 'var(--ac-phosphor-bright)' : 'var(--ac-phosphor-dim)',
                fontWeight: t.offset === 0 ? 700 : 400,
              }}
            >
              {t.offset === 0 ? `▼${t.label}` : t.label}
            </span>
          ))}
        </div>
      )}

      {/* Bottom-right status block: FIRE/LASER/BORE/SEE */}
      <div style={{
        ...plateBase,
        bottom: '8px',
        right: '8px',
        textAlign: 'right',
        fontSize: '11px',
        letterSpacing: '0.15em',
      }}>
        <div style={{
          color: fireOn ? 'var(--ac-ir-red)' : 'var(--ac-ir-red-bright)',
          textShadow: fireOn ? '0 0 6px rgba(255, 42, 26, 0.55)' : 'none',
        }}>
          FIRE: {fireOn ? 'ACTIVE' : '-- ---'}
        </div>
        <div>LASER: 1111</div>
        <div>BORE: VALID</div>
        <div>SEE: VALID</div>
      </div>

      {/* Bottom-left literal */}
      <div style={{
        ...plateBase,
        bottom: '8px',
        left: '8px',
        fontSize: '11px',
        letterSpacing: '0.15em',
      }}>
        N: OFF — DISARM
      </div>

      {/* Bottom-center: build ID + ready timer (desktop only) */}
      {!isMobile && showOverlays && (
        <div style={{
          ...plateBase,
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          letterSpacing: '0.20em',
          color: 'var(--ac-phosphor-dim)',
        }}>
          L1514 RDY · {hhmmss}
        </div>
      )}
    </>
  )
}
