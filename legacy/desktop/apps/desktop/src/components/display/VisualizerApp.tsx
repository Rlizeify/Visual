import { useEffect, useRef } from 'react'
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

export default function VisualizerApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveformBufRef = useRef<Float32Array>(new Float32Array(4096))
  const writePosRef = useRef(0)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const audioCtx = new AudioContext()
    audioCtx.resume().catch(() => {})

    // ─── AnalyserNode for Butterchurn ─────────────────────────────────────
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048

    // ScriptProcessorNode reads from our IPC-fed ring buffer → AnalyserNode
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const scriptNode = audioCtx.createScriptProcessor(4096, 0, 1)
    const muteGain = audioCtx.createGain()
    muteGain.gain.value = 0

    let readPos = 0
    scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
      const out = e.outputBuffer.getChannelData(0)
      const buf = waveformBufRef.current
      for (let i = 0; i < out.length; i++) {
        out[i] = buf[(readPos + i) % buf.length]
      }
      readPos = (readPos + out.length) % buf.length
    }

    scriptNode.connect(analyser)
    analyser.connect(muteGain)
    muteGain.connect(audioCtx.destination)

    // ─── IPC waveform listener ────────────────────────────────────────────
    const api = (window as any).api
    if (api?.onWaveformData) {
      api.onWaveformData((data: number[]) => {
        const buf = waveformBufRef.current
        const len = Math.min(data.length, buf.length)
        const wp = writePosRef.current
        for (let i = 0; i < len; i++) {
          buf[(wp + i) % buf.length] = data[i]
        }
        writePosRef.current = (wp + len) % buf.length
      })
    }

    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width
    canvas.height = height

    const visualizer = butterchurn.createVisualizer(audioCtx, canvas, {
      width,
      height,
      pixelRatio: window.devicePixelRatio || 1,
    })

    // Connect AnalyserNode (populated via IPC) to Butterchurn
    visualizer.connectAudio(analyser)

    const presets = butterchurnPresets.getPresets()
    const presetKeys = Object.keys(presets)
    let presetIndex = Math.floor(Math.random() * presetKeys.length)

    visualizer.loadPreset(presets[presetKeys[presetIndex]], 0)

    // Cycle preset every 30 seconds — 2.5s blend, render loop never stops
    const cycleInterval = setInterval(() => {
      presetIndex = (presetIndex + 1) % presetKeys.length
      visualizer.loadPreset(presets[presetKeys[presetIndex]], 2.5)
    }, 30_000)

    // Render loop — never interrupted during transitions
    let rafId: number
    function render() {
      visualizer.render()
      rafId = requestAnimationFrame(render)
    }
    rafId = requestAnimationFrame(render)

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
      if (api?.removeWaveformDataListeners) api.removeWaveformDataListeners()
      scriptNode.disconnect()
      audioCtx.close()
    }

    return () => {
      cleanupRef.current?.()
    }
  }, [])

  return (
    <>
      {/* 32px draggable titlebar — invisible but grabbable when not fullscreen */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '32px',
          zIndex: 9999,
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'block',
          background: '#000',
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      />
    </>
  )
}
