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

    let initialized = false
    let retried = false
    let resizeObserver: ResizeObserver | null = null

    const tryInit = (): boolean => {
      if (initialized) return true
      const rect = canvas.getBoundingClientRect()
      // Wait for the canvas to be mounted, painted, and have non-zero size.
      // Initializing against a hidden/0x0 canvas yields a null WebGL context
      // and Butterchurn crashes in createFramebuffer.
      if (!canvas.isConnected || rect.width === 0 || rect.height === 0) {
        return false
      }

      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      canvas.width = w
      canvas.height = h

      const engine = getVisualizerEngine()
      try {
        engine.initialize(canvas)
      } catch (err) {
        console.warn('[ButterchurnCanvas] init failed:', err)
        if (!retried) {
          retried = true
          // Retry once after a tick — sometimes the GPU process isn't ready
          // the moment the canvas appears.
          setTimeout(() => {
            try {
              engine.initialize(canvas)
              initialized = true
              initCbRef.current?.(engine.getCurrentPreset(), engine.getSettings())
            } catch (err2) {
              console.error('[ButterchurnCanvas] init failed after retry — giving up:', err2)
            }
          }, 100)
          // Return true so the observer disconnects; the retry handles completion.
          return true
        }
        return false
      }

      initialized = true
      initCbRef.current?.(engine.getCurrentPreset(), engine.getSettings())
      return true
    }

    // First attempt — may fail if canvas isn't laid out yet
    if (!tryInit()) {
      // Re-attempt whenever the canvas size changes (e.g. after splash unmounts
      // or parent flips from display:none)
      resizeObserver = new ResizeObserver(() => {
        if (tryInit() && resizeObserver) {
          resizeObserver.disconnect()
          resizeObserver = null
        }
      })
      resizeObserver.observe(canvas)
    }

    const handleResize = () => {
      if (!initialized) return
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width || window.innerWidth))
      const h = Math.max(1, Math.floor(rect.height || window.innerHeight))
      canvas.width = w
      canvas.height = h
      getVisualizerEngine().resize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
      }
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
