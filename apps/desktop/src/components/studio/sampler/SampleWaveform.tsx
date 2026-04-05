import React, { useRef, useEffect, useCallback } from 'react'

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
  const animRef = useRef<number>(0)

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

    // Waveform
    const data = buffer.getChannelData(0)
    const step = Math.max(1, Math.floor(data.length / w))
    ctx.strokeStyle = '#27e0e1'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x < w; x++) {
      const idx = Math.floor((x / w) * data.length)
      let min = 1, max = -1
      for (let j = 0; j < step; j++) {
        const val = data[idx + j] ?? 0
        if (val < min) min = val
        if (val > max) max = val
      }
      const yMin = ((1 - max) / 2) * h
      const yMax = ((1 - min) / 2) * h
      ctx.moveTo(x, yMin)
      ctx.lineTo(x, yMax)
    }
    ctx.stroke()

    // Selected region overlay
    const sx = (startTime / duration) * w
    const ex = (endTime / duration) * w
    ctx.fillStyle = 'rgba(122, 1, 5, 0.35)'
    ctx.fillRect(0, 0, sx, h)
    ctx.fillRect(ex, 0, w - ex, h)

    // Start marker
    ctx.strokeStyle = '#eea91c'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke()

    // End marker
    ctx.strokeStyle = '#ff3a3a'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex, h); ctx.stroke()

    // Playing indicator line (pulse effect)
    if (playing) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200)
      ctx.fillStyle = `rgba(238, 169, 28, ${0.15 + pulse * 0.15})`
      ctx.fillRect(sx, 0, ex - sx, h)
    }
  }, [buffer, startTime, endTime, duration, playing])

  useEffect(() => {
    const loop = () => { draw(); animRef.current = requestAnimationFrame(loop) }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  const timeFromX = useCallback((clientX: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || duration === 0) return 0
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    return (x / rect.width) * duration
  }, [duration])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || duration === 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const sx = (startTime / duration) * rect.width
    const ex = (endTime / duration) * rect.width
    dragRef.current = Math.abs(x - sx) < Math.abs(x - ex) ? 'start' : 'end'
  }, [startTime, endTime, duration])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const t = timeFromX(e.clientX)
    if (dragRef.current === 'start') onStartChange(t)
    else onEndChange(t)
  }, [timeFromX, onStartChange, onEndChange])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])

  return (
    <canvas
      ref={canvasRef}
      className="sampler-waveform-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      title="Drag markers to set loop start/end points"
    />
  )
}
