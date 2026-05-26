// Persistent corner HUD readouts. Mounted by ObsessionLayout so they
// appear on every Obsession surface. The "tl" plate shows a live
// local time, "tr" shows DAY N + user accent pip, "bl" shows the
// build identifier, "br" shows the current local date.
//
// Time updates every 1s. Date/day update at midnight via the same
// interval (cheap, no listener gymnastics).

import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { todayLocalISODate, formatHudDate } from '../lib/localDate'
import { getDayCount } from '../lib/dayCount'

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function HudCorners() {
  const { user } = useAuth()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const day = user ? getDayCount(user.id) : 1
  const iso = todayLocalISODate(now)

  return (
    <>
      <div className="obs-hud-corner obs-hud-corner--tl">
        <span className="live">●</span>&nbsp;OBS-CTRL // {formatTime(now)}
      </div>
      <div className="obs-hud-corner obs-hud-corner--tr">
        SUBJ // DAY {String(day).padStart(3, '0')}
      </div>
      <div className="obs-hud-corner obs-hud-corner--bl">
        CH-01 // PRIVATE // RLS-LOCKED
      </div>
      <div className="obs-hud-corner obs-hud-corner--br">
        {formatHudDate(iso)}
      </div>
    </>
  )
}
