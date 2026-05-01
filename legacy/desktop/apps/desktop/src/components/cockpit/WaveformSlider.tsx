import { useEffect, useRef } from 'react'

interface Props {
  analyser: AnalyserNode | null
  volume: number   // 0–100
  onVolumeChange: (v: number) => void
}

export default function WaveformSlider({ analyser, volume, onVolumeChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const volRef = useRef(volume)

  useEffect(() => { volRef.current = volume }, [volume])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const buf = new Uint8Array(analyser?.fftSize ?? 2048)
    let rafId: number

    const draw = () => {
      const W = canvas.offsetWidth
      const H = 32
      if (canvas.width !== W) canvas.width = W
      canvas.height = H
      ctx.clearRect(0, 0, W, H)

      if (analyser) analyser.getByteTimeDomainData(buf)

      const vol = volRef.current / 100
      const grad = ctx.createLinearGradient(0, 0, W, 0)
      grad.addColorStop(0, '#87150a')
      grad.addColorStop(1, '#eea91c')
      ctx.strokeStyle = grad
      ctx.lineWidth = 2
      ctx.beginPath()
      const step = W / buf.length
      for (let i = 0; i < buf.length; i++) {
        const v = ((buf[i] / 128) - 1) * vol
        const y = H / 2 + v * (H / 2 - 2)
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y)
      }
      ctx.stroke()
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [analyser])

  return (
    <div style={{ position: 'relative', flex: 1, height: 32, display: 'flex', alignItems: 'center' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <input
        type="range" min={0} max={100} value={volume}
        onChange={e => onVolumeChange(Number(e.target.value))}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 1, margin: 0 }}
      />
    </div>
  )
}
