/* DeckWaveform.tsx — canvas waveform + playback position indicator */

import { useRef, useEffect, useCallback } from 'react'

interface Props {
  buffer: AudioBuffer | null
  currentTime: number
  duration: number
  onSeek: (t: number) => void
}

export default function DeckWaveform({ buffer, currentTime, duration, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveCache = useRef<Float32Array | null>(null)

  // Pre-compute downsampled waveform on buffer change
  useEffect(() => {
    if (!buffer) { waveCache.current = null; return }
    const raw = buffer.getChannelData(0)
    const buckets = 600
    const perBucket = Math.floor(raw.length / buckets)
    const peaks = new Float32Array(buckets)
    for (let i = 0; i < buckets; i++) {
      let max = 0
      const start = i * perBucket
      for (let j = start; j < start + perBucket; j++) {
        const v = Math.abs(raw[j])
        if (v > max) max = v
      }
      peaks[i] = max
    }
    waveCache.current = peaks
  }, [buffer])

  // Draw waveform + position
  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    if (!ctx) return

    const w = cvs.offsetWidth
    const h = cvs.offsetHeight
    cvs.width = w
    cvs.height = h

    ctx.clearRect(0, 0, w, h)

    const peaks = waveCache.current
    if (!peaks) {
      ctx.fillStyle = '#87150a'
      ctx.font = '11px Share Tech Mono'
      ctx.textAlign = 'center'
      ctx.fillText('NO TRACK', w / 2, h / 2 + 4)
      return
    }

    // Waveform bars
    const barW = w / peaks.length
    for (let i = 0; i < peaks.length; i++) {
      const barH = peaks[i] * h * 0.9
      const x = i * barW
      const progress = i / peaks.length
      const posRatio = duration > 0 ? currentTime / duration : 0
      ctx.fillStyle = progress < posRatio ? '#eea91c' : '#87150a'
      ctx.fillRect(x, (h - barH) / 2, Math.max(barW - 0.5, 0.5), barH)
    }

    // Position indicator
    if (duration > 0) {
      const px = (currentTime / duration) * w
      ctx.strokeStyle = '#27e0e1'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
    }
  })

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onSeek(ratio * duration)
  }, [duration, onSeek])

  return (
    <canvas
      ref={canvasRef}
      className="dj-waveform"
      onClick={handleClick}
      title="Click to seek"
    />
  )
}
