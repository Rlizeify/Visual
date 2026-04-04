import { useEffect, useState, useRef } from 'react'

interface TopBarProps {
  trackName: string
}

export default function TopBar({ trackName }: TopBarProps) {
  const [time, setTime] = useState('')
  const [beatFlash, setBeatFlash] = useState(false)
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const h = String(now.getHours()).padStart(2, '0')
      const m = String(now.getMinutes()).padStart(2, '0')
      const s = String(now.getSeconds()).padStart(2, '0')
      setTime(`${h}:${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Flash power indicator on beat pulse
  useEffect(() => {
    const onPulse = () => {
      setBeatFlash(true)
      if (flashTimeout.current) clearTimeout(flashTimeout.current)
      flashTimeout.current = setTimeout(() => setBeatFlash(false), 120)
    }
    window.addEventListener('ui:beat-pulse', onPulse)
    return () => {
      window.removeEventListener('ui:beat-pulse', onPulse)
      if (flashTimeout.current) clearTimeout(flashTimeout.current)
    }
  }, [])

  return (
    <div className="top-bar panel">
      <span className="top-bar__logo">VISUAL</span>
      <div className="top-bar__track">
        <div className="lcd-readout">
          {trackName || 'NO SIGNAL'}
        </div>
      </div>
      <div className="top-bar__right">
        <span className="clock">{time}</span>
        <div
          className={`power-indicator${beatFlash ? ' beat-flash' : ''}`}
          title="System Online"
        />
      </div>
    </div>
  )
}
