import { useEffect, useRef, useState } from 'react'
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

interface Props {
  analyser: AnalyserNode | null
  selectedPreset: string
  blendTime: number
  cycleSpeed: number
  animationSpeed: number
}

export default function VisualizerPreview({ analyser, selectedPreset, blendTime, cycleSpeed, animationSpeed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vizRef = useRef<any>(null)
  const [hovered, setHovered] = useState(false)
  const blendRef = useRef(blendTime)
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const presetsRef = useRef<Record<string, any>>(butterchurnPresets.getPresets())
  const keysRef = useRef<string[]>(Object.keys(presetsRef.current))
  const idxRef = useRef(0)

  useEffect(() => { blendRef.current = blendTime }, [blendTime])
  const animSpeedRef = useRef(animationSpeed)
  useEffect(() => { animSpeedRef.current = animationSpeed }, [animationSpeed])

  // Init butterchurn on mount / when analyser changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser) return
    const ctx = analyser.context as AudioContext
    ctx.resume?.().catch(() => {})
    const w = canvas.offsetWidth || 400
    const h = canvas.offsetHeight || 300
    canvas.width = w
    canvas.height = h
    const viz = butterchurn.createVisualizer(ctx, canvas, {
      width: w, height: h, pixelRatio: window.devicePixelRatio || 1,
    })
    viz.connectAudio(analyser)
    viz.loadPreset(presetsRef.current[keysRef.current[0]], 0)
    vizRef.current = viz

    let rafId: number
    let lastTime: number | null = null
    const render = (timestamp: number) => {
      const elapsed = lastTime === null ? 0 : (timestamp - lastTime) * animSpeedRef.current
      lastTime = timestamp
      viz.render(timestamp, elapsed)
      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      canvas.width = width; canvas.height = height
      viz.setRendererSize(width, height)
    })
    ro.observe(canvas)

    return () => { cancelAnimationFrame(rafId); ro.disconnect(); vizRef.current = null }
  }, [analyser])

  // Load user-selected preset
  useEffect(() => {
    if (!vizRef.current || !selectedPreset || !presetsRef.current[selectedPreset]) return
    vizRef.current.loadPreset(presetsRef.current[selectedPreset], blendRef.current)
  }, [selectedPreset])

  // Restart cycle timer when speed changes
  useEffect(() => {
    if (cycleRef.current) clearInterval(cycleRef.current)
    cycleRef.current = setInterval(() => {
      if (!vizRef.current) return
      idxRef.current = (idxRef.current + 1) % keysRef.current.length
      vizRef.current.loadPreset(presetsRef.current[keysRef.current[idxRef.current]], blendRef.current)
    }, cycleSpeed * 1000)
    return () => { if (cycleRef.current) clearInterval(cycleRef.current) }
  }, [cycleSpeed])

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', background: '#000' }} />
      {hovered && (
        <button
          onClick={() => canvasRef.current?.requestFullscreen?.()}
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'transparent', border: 'none',
            color: '#eea91c', fontSize: 11, cursor: 'pointer',
            fontFamily: 'monospace', letterSpacing: '0.08em', padding: '2px 6px',
          }}
        >
          ⛶ FULLSCREEN
        </button>
      )}
    </div>
  )
}
