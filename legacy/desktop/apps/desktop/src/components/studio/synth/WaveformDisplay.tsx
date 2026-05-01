import React, { useRef, useEffect } from 'react'

interface Props {
  analyser: AnalyserNode | null
}

export default function WaveformDisplay({ analyser }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const ro = new ResizeObserver(() => {
      canvas.width = parent.offsetWidth
      canvas.height = parent.offsetHeight
    })
    ro.observe(parent)
    canvas.width = parent.offsetWidth
    canvas.height = parent.offsetHeight
    return () => ro.disconnect()
  }, [])

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !analyser) return
    const ctx2d = canvas.getContext('2d')!
    const bufferLength = analyser.fftSize
    const dataArray = new Float32Array(bufferLength)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const w = canvas.width
      const h = canvas.height
      ctx2d.fillStyle = '#0a0a0a'
      ctx2d.fillRect(0, 0, w, h)

      analyser.getFloatTimeDomainData(dataArray)

      ctx2d.beginPath()
      ctx2d.strokeStyle = '#27e0e1'
      ctx2d.lineWidth = 1.5

      const sliceWidth = w / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const y = (dataArray[i] * 0.5 + 0.5) * h
        if (i === 0) ctx2d.moveTo(x, y)
        else ctx2d.lineTo(x, y)
        x += sliceWidth
      }
      ctx2d.stroke()
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
