import React, { useRef, useEffect, useCallback, useState } from 'react'

interface Props {
  buffer: AudioBuffer | null
  startTime: number
  endTime: number
  duration: number
  playing: boolean
  onStartChange: (t: number) => void
  onEndChange: (t: number) => void
}

type DragTarget = 'start' | 'end' | null

export default function SampleWaveform({
  buffer, startTime, endTime, duration, playing,
  onStartChange, onEndChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<DragTarget>(null)
  const panRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 })
  const animRef = useRef<number>(0)

  // Zoom state: zoom = 1 means full waveform, zoom = 50 means 2% visible
  const [zoom, setZoom] = useState(1)
  // viewStart: fraction of the total duration at the left edge of the viewport [0, 1)
  const [viewStart, setViewStart] = useState(0)

  // Clamp viewStart so the visible window stays in bounds
  const clampView = useCallback((vs: number, z: number) => {
    const viewWidth = 1 / z
    return Math.max(0, Math.min(vs, 1 - viewWidth))
  }, [])

  // Convert a canvas-pixel X to a time value, accounting for zoom
  const timeFromX = useCallback((clientX: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || duration === 0) return 0
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const frac = viewStart + (x / rect.width) * (1 / zoom)
    return Math.max(0, Math.min(frac * duration, duration))
  }, [duration, viewStart, zoom])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * devicePixelRatio
    canvas.height = rect.height * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    const w = rect.width
    const h = rect.height

    // Background
    ctx.fillStyle = '#010103'
    ctx.fillRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = 'rgba(122, 1, 5, 0.25)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }

    if (!buffer || duration === 0) {
      ctx.fillStyle = '#87150a'
      ctx.font = '13px "Share Tech Mono", monospace'
      ctx.textAlign = 'center'
      ctx.fillText('NO SAMPLE LOADED', w / 2, h / 2)
      return
    }

    // Visible fraction of the waveform
    const viewWidth = 1 / zoom
    const vStart = viewStart
    const vEnd = viewStart + viewWidth

    // Waveform
    const data = buffer.getChannelData(0)
    const totalSamples = data.length
    ctx.strokeStyle = '#27e0e1'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x < w; x++) {
      const frac0 = vStart + (x / w) * viewWidth
      const frac1 = vStart + ((x + 1) / w) * viewWidth
      const idx0 = Math.floor(frac0 * totalSamples)
      const idx1 = Math.max(idx0 + 1, Math.floor(frac1 * totalSamples))
      let min = 1, max = -1
      for (let j = idx0; j < idx1 && j < totalSamples; j++) {
        const val = data[j] ?? 0
        if (val < min) min = val
        if (val > max) max = val
      }
      const yMin = ((1 - max) / 2) * h
      const yMax = ((1 - min) / 2) * h
      ctx.moveTo(x, yMin)
      ctx.lineTo(x, yMax)
    }
    ctx.stroke()

    // Helper: convert a time fraction [0,1] to canvas X
    const fracToX = (frac: number) => ((frac - vStart) / viewWidth) * w

    // Selected region overlay
    const sx = fracToX(startTime / duration)
    const ex = fracToX(endTime / duration)
    ctx.fillStyle = 'rgba(122, 1, 5, 0.35)'
    if (sx > 0) ctx.fillRect(0, 0, sx, h)
    if (ex < w) ctx.fillRect(ex, 0, w - ex, h)

    // Start marker
    if (sx >= 0 && sx <= w) {
      ctx.strokeStyle = '#eea91c'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke()
    }

    // End marker
    if (ex >= 0 && ex <= w) {
      ctx.strokeStyle = '#ff3a3a'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex, h); ctx.stroke()
    }

    // Playing indicator line (pulse effect)
    if (playing) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200)
      ctx.fillStyle = `rgba(238, 169, 28, ${0.15 + pulse * 0.15})`
      const psx = Math.max(0, sx)
      const pex = Math.min(w, ex)
      if (pex > psx) ctx.fillRect(psx, 0, pex - psx, h)
    }

    // Zoom indicator
    if (zoom > 1.01) {
      ctx.fillStyle = 'rgba(255, 179, 71, 0.85)'
      ctx.font = '11px "Share Tech Mono", monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${zoom.toFixed(1)}x`, w - 6, 14)
    }
  }, [buffer, startTime, endTime, duration, playing, zoom, viewStart])

  useEffect(() => {
    const loop = () => { draw(); animRef.current = requestAnimationFrame(loop) }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  // Mouse wheel zoom centered on cursor
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (!canvasRef.current || duration === 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseFrac = viewStart + (mouseX / rect.width) * (1 / zoom)

    // Smooth zoom: scale factor based on deltaY
    const factor = 1 - e.deltaY * 0.002
    const newZoom = Math.max(1, Math.min(50, zoom * factor))
    // Keep the point under the cursor fixed
    const newViewStart = mouseFrac - (mouseX / rect.width) * (1 / newZoom)
    setZoom(newZoom)
    setViewStart(clampView(newViewStart, newZoom))
  }, [zoom, viewStart, duration, clampView])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || duration === 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left

    // Check proximity to markers first
    const viewWidth = 1 / zoom
    const sx = ((startTime / duration - viewStart) / viewWidth) * rect.width
    const ex = ((endTime / duration - viewStart) / viewWidth) * rect.width
    const distToStart = Math.abs(x - sx)
    const distToEnd = Math.abs(x - ex)
    const threshold = 8 // pixels

    if (distToStart < threshold || distToEnd < threshold) {
      dragRef.current = distToStart < distToEnd ? 'start' : 'end'
    } else if (zoom > 1.01) {
      // Pan mode when zoomed in and not near a marker
      panRef.current = { active: true, lastX: e.clientX }
    } else {
      // At 1x zoom, default to marker drag
      dragRef.current = distToStart < distToEnd ? 'start' : 'end'
    }
  }, [startTime, endTime, duration, zoom, viewStart])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const t = timeFromX(e.clientX)
      if (dragRef.current === 'start') onStartChange(t)
      else onEndChange(t)
    } else if (panRef.current.active) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = e.clientX - panRef.current.lastX
      const timeDelta = (dx / rect.width) * (1 / zoom)
      setViewStart(vs => clampView(vs - timeDelta, zoom))
      panRef.current.lastX = e.clientX
    }
  }, [timeFromX, onStartChange, onEndChange, zoom, clampView])

  const onMouseUp = useCallback(() => {
    dragRef.current = null
    panRef.current.active = false
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="sampler-waveform-canvas"
      data-tutorial-id="studio-sample-waveform"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      title="Scroll to zoom, drag to pan. Drag markers to set loop points."
    />
  )
}
