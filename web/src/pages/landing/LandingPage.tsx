// Public landing page: just the nav over a full-screen targeting grid.
// A soft accent light drifts across the grid and follows the pointer,
// lighting up the grid lines near it. Position lives in two CSS custom
// properties (--lx/--ly) written from one rAF loop — no React state.

import { useEffect, useRef } from 'react'
import './landing.css'

const EASE = 0.08          // how quickly the light catches the target
const IDLE_MS = 2500       // after this long without input, drift again

export default function LandingPage() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let x = window.innerWidth / 2
    let y = window.innerHeight / 3
    let tx = x
    let ty = y
    let lastInput = -Infinity
    let raf = 0

    const paint = () => {
      el.style.setProperty('--lx', `${x}px`)
      el.style.setProperty('--ly', `${y}px`)
    }

    const onMove = (e: PointerEvent) => {
      tx = e.clientX
      ty = e.clientY
      lastInput = performance.now()
      if (reduced) { x = tx; y = ty; paint() }
    }

    const tick = (t: number) => {
      if (t - lastInput > IDLE_MS) {
        // Slow Lissajous drift so the page is alive without a mouse.
        const w = window.innerWidth
        const h = window.innerHeight
        tx = w * (0.5 + 0.32 * Math.sin(t / 7000))
        ty = h * (0.45 + 0.28 * Math.sin(t / 5300 + 1))
      }
      x += (tx - x) * EASE
      y += (ty - y) * EASE
      paint()
      raf = requestAnimationFrame(tick)
    }

    paint()
    window.addEventListener('pointermove', onMove, { passive: true })
    if (!reduced) raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <main className="landing" ref={ref}>
      <h1 className="sr-only">MHEU</h1>
      <div className="landing__grid" aria-hidden />
      <div className="landing__lit" aria-hidden />
      <div className="landing__glow" aria-hidden />
    </main>
  )
}
