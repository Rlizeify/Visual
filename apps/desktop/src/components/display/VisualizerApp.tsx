import { useEffect, useRef } from 'react'
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

export default function VisualizerApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const audioCtx = new AudioContext()

    // Create a silent source so the AudioContext stays active
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()

    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width
    canvas.height = height

    const visualizer = butterchurn.createVisualizer(audioCtx, canvas, {
      width,
      height,
      pixelRatio: window.devicePixelRatio || 1,
    })

    const presets = butterchurnPresets.getPresets()
    const presetKeys = Object.keys(presets)
    let presetIndex = Math.floor(Math.random() * presetKeys.length)

    visualizer.loadPreset(presets[presetKeys[presetIndex]], 0)

    // Cycle preset every 30 seconds
    const cycleInterval = setInterval(() => {
      presetIndex = (presetIndex + 1) % presetKeys.length
      visualizer.loadPreset(presets[presetKeys[presetIndex]], 2.0) // 2s blend
    }, 30_000)

    // Render loop
    let rafId: number
    function render() {
      visualizer.render()
      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)

    // Handle resize
    function onResize() {
      const w = window.innerWidth
      const h = window.innerHeight
      canvas!.width = w
      canvas!.height = h
      visualizer.setRendererSize(w, h)
    }
    window.addEventListener('resize', onResize)

    cleanupRef.current = () => {
      clearInterval(cycleInterval)
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      osc.stop()
      audioCtx.close()
    }

    return () => {
      cleanupRef.current?.()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        background: '#000',
      }}
    />
  )
}
