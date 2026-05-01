import { memo, useEffect, useRef } from 'react'
import { getVisualizerEngine, destroyVisualizerEngine, type VisualizerSettings } from './VisualizerEngine'

interface ButterchurnCanvasProps {
  showIdle: boolean
  onInitialized?: (preset: string, settings: VisualizerSettings) => void
}

// Wrapped in memo so parent re-renders never touch the canvas or engine.
const ButterchurnCanvas = memo(function ButterchurnCanvas({
  showIdle,
  onInitialized,
}: ButterchurnCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Capture callback at mount time so the empty-deps effect is lint-safe
  const initCbRef = useRef(onInitialized)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const engine = getVisualizerEngine()
    engine.initialize(canvas)
    initCbRef.current?.(engine.getCurrentPreset(), engine.getSettings())

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      engine.resize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      destroyVisualizerEngine()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: showIdle ? 0 : 1,
        pointerEvents: showIdle ? 'none' : 'auto',
        transition: 'opacity 1s ease',
      }}
    />
  )
})

export default ButterchurnCanvas
