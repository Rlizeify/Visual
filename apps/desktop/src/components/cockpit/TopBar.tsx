import { useEffect, useState } from 'react'

interface TopBarProps {
  trackName: string
}

export default function TopBar({ trackName }: TopBarProps) {
  const [time, setTime] = useState('')

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
        <div className="power-indicator" title="System Online" />
      </div>
    </div>
  )
}
