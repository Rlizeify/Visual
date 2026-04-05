import { useEffect, useRef, useCallback, useState, type MutableRefObject } from 'react'
import { Tooltip } from '../shared'
import HubTutorial from './HubTutorial'
import sdGlitchFontUrl from '../../styles/fonts/SDGlitch.ttf?url'

declare global {
  interface Window {
    hubApi: {
      openCockpit: () => void
      openStudio: () => void
      openVisualizer: () => void
      getSplashText: () => string
      launchTool: (toolName: string) => void
    }
  }
}

/* ─── Wave Background Canvas ──────────────────────────────────────────────── */

function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let animId = 0

    const colors = [
      '#1a0035', '#00897b', '#c2185b', '#0d0030',
      '#4a0080', '#1a0035', '#00897b', '#0d0030',
    ]

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    function draw(t: number) {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#05000f'
      ctx.fillRect(0, 0, W, H)

      const bandCount = colors.length
      const segments = 6 // number of wave peaks across width
      for (let i = 0; i < bandCount; i++) {
        const baseY = (H / (bandCount + 1)) * (i + 1)
        const phase = t * 0.0003 + i * 0.8
        const amp = 40 + Math.sin(t * 0.0002 + i) * 20

        // Build array of wave points
        const points: { x: number; y: number }[] = []
        for (let s = 0; s <= segments; s++) {
          const x = (W / segments) * s
          const y = baseY
            + Math.sin(phase + x * 0.003) * amp
            + Math.cos(phase * 0.7 + x * 0.002) * amp * 0.5
          points.push({ x, y })
        }

        ctx.beginPath()
        // Start at bottom-left, organic curve up to first point
        ctx.moveTo(0, H)
        ctx.bezierCurveTo(0, H - amp * 0.3, 0, points[0].y + amp * 0.2, 0, points[0].y)

        // Draw smooth bezier through all wave points
        for (let j = 0; j < points.length - 1; j++) {
          const p0 = points[j]
          const p1 = points[j + 1]
          const dx = p1.x - p0.x
          const cp1x = p0.x + dx / 3
          const cp2x = p0.x + (dx * 2) / 3
          // Control points offset for organic liquid feel
          const cp1y = p0.y + Math.sin(phase + cp1x * 0.004) * amp * 0.3
          const cp2y = p1.y - Math.cos(phase * 0.6 + cp2x * 0.003) * amp * 0.3
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y)
        }

        // Close: curve down to bottom-right, then wavy bottom edge
        const lastPt = points[points.length - 1]
        ctx.bezierCurveTo(W, lastPt.y + amp * 0.2, W, H - amp * 0.1, W, H)
        // Bottom edge: melting liquid curve instead of straight line
        const bottomSag = Math.sin(phase * 1.3) * 15 + 10
        ctx.bezierCurveTo(W * 0.66, H + bottomSag, W * 0.33, H + bottomSag * 0.7, 0, H)
        ctx.closePath()
        ctx.globalAlpha = 0.7
        ctx.fillStyle = colors[i]
        ctx.fill()
      }

      // Radial gradient overlay — center bright, edges dark
      ctx.globalAlpha = 1
      const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(1, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} style={styles.canvas} />
}

/* ─── Neon Flicker Logic ──────────────────────────────────────────────────── */

function useNeonFlicker(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    function scheduleFlicker() {
      const delay = 4000 + Math.random() * 4000
      timeout = setTimeout(() => {
        const el = ref.current
        if (el) {
          el.classList.add('neon-flicker')
          setTimeout(() => el.classList.remove('neon-flicker'), 200)
        }
        scheduleFlicker()
      }, delay)
    }
    scheduleFlicker()
    return () => clearTimeout(timeout)
  }, [ref])
}

/* ─── Hub App ─────────────────────────────────────────────────────────────── */

export default function HubApp() {
  const logoRef = useRef<HTMLDivElement>(null)
  const [splashText, setSplashText] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useNeonFlicker(logoRef)

  useEffect(() => {
    try {
      setSplashText(window.hubApi.getSplashText())
    } catch {
      setSplashText('Awesome!')
    }
  }, [])

  // Splash audio on mount
  useEffect(() => {
    const audio = new Audio('./assets/neonlight.mp3')
    audio.loop = true
    audio.volume = 0
    audioRef.current = audio
    try { audio.play() } catch { /* autoplay blocked */ }
    // Ramp volume from 0 to 1.0 over ~1000ms to prevent audio pop
    const rampIv = setInterval(() => {
      if (audio.volume < 0.95) {
        audio.volume = Math.min(1.0, audio.volume + 0.05)
      } else {
        audio.volume = 1.0
        clearInterval(rampIv)
      }
    }, 50)
    return () => {
      clearInterval(rampIv)
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
  }, [])

  const fadeOutAndRun = useCallback((action: () => void) => {
    const audio = audioRef.current
    if (audio && audio.volume > 0) {
      const iv = setInterval(() => {
        const next = audio.volume - 0.05
        if (next <= 0) {
          audio.volume = 0
          audio.pause()
          clearInterval(iv)
        } else {
          audio.volume = next
        }
      }, 25)
    }
    action()
  }, [])

  const openCockpit = useCallback(() => fadeOutAndRun(() => window.hubApi.openCockpit()), [fadeOutAndRun])
  const openStudio = useCallback(() => fadeOutAndRun(() => window.hubApi.openStudio()), [fadeOutAndRun])
  const launchTool = useCallback((name: string) => window.hubApi.launchTool(name), [])

  const [showTutorial, setShowTutorial] = useState(false)

  return (
    <>
      <style>{cssText}</style>
      <WaveCanvas />
      <div style={styles.overlay}>
        {/* Logo */}
        <div ref={logoRef} style={styles.logoWrap} className="glow-pulse">
          <div style={styles.logoBlueBorder}>MHEU</div>
          <div style={styles.logoText}>MHEU</div>
        </div>

        {/* Splash text */}
        <div className="splash-wobble" style={styles.tagline}>{splashText}</div>

        {/* Buttons */}
        <div style={styles.buttonRow}>
          <div data-tutorial="cockpit-btn">
            <HubButton label="COCKPIT" color="#ffb347" onClick={openCockpit} />
          </div>
          <div data-tutorial="studio-btn">
            <HubButton label="STUDIO" color="#ff2d9b" onClick={openStudio} />
          </div>
        </div>

        {/* Tools */}
        <div data-tutorial="tools-section" style={styles.toolsSection}>
          <div style={styles.toolsLabel}>TOOLS</div>
          <div style={styles.buttonRow}>
            <Tooltip
              text="Binary Synth"
              detail="Generate sounds by drawing binary waveforms. Click cells to toggle bits on/off, creating unique timbres."
            >
              <HubButton label="BINARY SYNTH" color="#00cfff" onClick={() => launchTool('binary-synth')} />
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Help button */}
      <button
        data-tutorial="help-btn"
        className="hub-help-btn"
        onClick={() => setShowTutorial(true)}
        aria-label="Open tutorial"
      >
        ?
      </button>

      {/* Tutorial overlay */}
      {showTutorial && <HubTutorial onClose={() => setShowTutorial(false)} />}
    </>
  )
}

/* ─── Button Component ────────────────────────────────────────────────────── */

function HubButton({ label, color, onClick }: {
  label: string; color: string; onClick: () => void
}) {
  return (
    <button
      className="hub-btn"
      style={{
        '--btn-color': color,
        '--btn-glow': color.replace(')', ',0.1)').replace('rgb', 'rgba').replace('#', ''),
      } as React.CSSProperties}
      onClick={onClick}
    >
      <span style={{ color }}>{label}</span>
    </button>
  )
}

/* ─── Inline Styles ───────────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  canvas: {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  logoWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  logoText: {
    fontFamily: "'SD Glitch', sans-serif",
    fontSize: 120,
    color: '#ff2d9b',
    textShadow: `
      0 0 7px #fff,
      0 0 10px #fff,
      0 0 21px #fff,
      0 0 42px #ff2d9b,
      0 0 82px #ff2d9b,
      0 0 92px #ff2d9b,
      0 0 102px #ff2d9b,
      0 0 151px #ff2d9b
    `,
    position: 'relative',
    zIndex: 2,
    lineHeight: 1,
    letterSpacing: '0.05em',
  },
  logoBlueBorder: {
    fontFamily: "'SD Glitch', sans-serif",
    fontSize: 120,
    color: '#00cfff',
    textShadow: `
      0 0 40px #00cfff,
      0 0 80px #00cfff
    `,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
    transform: 'scale(1.02)',
    transformOrigin: 'center center',
    lineHeight: 1,
    letterSpacing: '0.05em',
    pointerEvents: 'none',
  },
  tagline: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 13,
    color: '#ffb347',
    letterSpacing: '0.3em',
    marginBottom: 48,
  },
  buttonRow: {
    display: 'flex',
    gap: 40,
  },
  toolsSection: {
    marginTop: 48,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  toolsLabel: {
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    color: '#555',
    letterSpacing: '0.3em',
  },
}

/* ─── CSS (font-face, animations, hover) ──────────────────────────────────── */

const cssText = `
@font-face {
  font-family: 'SD Glitch';
  src: url('${sdGlitchFontUrl}') format('truetype');
  font-weight: normal;
  font-style: normal;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #05000f;
}

body {
  user-select: none;
  -webkit-user-select: none;
  -webkit-app-region: drag;
}

button, a {
  -webkit-app-region: no-drag;
}

/* Glow pulse animation */
.glow-pulse > div:first-child {
  animation: glow-breathe 3s ease-in-out infinite;
}

@keyframes glow-breathe {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Neon flicker */
.neon-flicker > div:nth-child(2) {
  animation: flicker-seq 200ms steps(1);
}

@keyframes flicker-seq {
  0%   { opacity: 1; }
  20%  { opacity: 0.8; }
  40%  { opacity: 1; }
  60%  { opacity: 0.6; }
  80%  { opacity: 1; }
  100% { opacity: 1; }
}

/* Hub buttons */
.hub-btn {
  width: 180px;
  height: 56px;
  background: #08000f;
  border: 2px solid var(--btn-color);
  font-family: 'Inter', sans-serif;
  font-size: 18px;
  text-transform: uppercase;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 0;
  transition: background 0.2s, box-shadow 0.2s;
}

.hub-btn:hover {
  background: color-mix(in srgb, var(--btn-color) 10%, #08000f);
  box-shadow: 0 0 20px var(--btn-color), 0 0 40px color-mix(in srgb, var(--btn-color) 30%, transparent);
}

.hub-btn:active {
  transform: scale(0.97);
}

/* Splash text wobble — neon sign that isn't quite stable */
@keyframes splash-wobble {
  0%, 100% { transform: rotate(-1deg); }
  50% { transform: rotate(1deg); }
}

.splash-wobble {
  animation: splash-wobble 3s ease-in-out infinite;
  display: inline-block;
}

/* Help button */
.hub-help-btn {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 179, 71, 0.4);
  background: transparent;
  color: rgba(255, 179, 71, 0.7);
  font-family: 'Share Tech Mono', monospace;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
  -webkit-app-region: no-drag;
}

.hub-help-btn:hover {
  background: rgba(255, 179, 71, 0.1);
  color: #ffb347;
  border-color: rgba(255, 179, 71, 0.7);
}

.hub-help-btn:active {
  transform: scale(0.95);
}
`
