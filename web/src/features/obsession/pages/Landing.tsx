// Obsession landing — bracketed monumental title, DAY-N counter,
// 4 nav tiles, deterministic daily quote, bird button → /amor.

import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { fetchQuotePool, pickQuoteFor } from '../lib/quotes'
import type { ObsessionQuotePoolRow } from '../lib/types'
import { getDayCount } from '../lib/dayCount'
import { todayLocalISODate, formatHudDate } from '../lib/localDate'
import NavTile from '../components/NavTile'
import BirdButton from '../components/BirdButton'

export default function Landing() {
  const { user } = useAuth()
  const [pool, setPool] = useState<ObsessionQuotePoolRow[]>([])

  useEffect(() => {
    let active = true
    fetchQuotePool().then(rows => { if (active) setPool(rows) })
    return () => { active = false }
  }, [])

  const day = user ? getDayCount(user.id) : 1
  const quote = user ? pickQuoteFor(user.id, pool) : null
  const iso = todayLocalISODate()

  return (
    <>
      <div>
        <div className="obs-title-sub">[ MHEU // SUB-SYSTEM // OBSESSION ]</div>
        <h1 className="obs-title">OBSESSION</h1>
        <div className="obs-title-sub" style={{ marginTop: 14 }}>
          ROUTINE OF ATTENTION&nbsp;&nbsp;&nbsp;//&nbsp;&nbsp;&nbsp;{formatHudDate(iso)}
        </div>
      </div>

      <div className="obs-crosshair">[ STATUS ]</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        <div className="obs-day">
          DAY <strong>{String(day).padStart(3, '0')}</strong>
        </div>
        <span className="obs-pill obs-pill--ok">UPLINK NOMINAL</span>
        <span className="obs-pill">CHANNEL // PRIVATE</span>
      </div>

      <div className="obs-section-head">
        SURFACES <span className="obs-section-rule" />
      </div>

      <div className="obs-tile-grid">
        <NavTile num="01" name="MEDITATIONS" desc="7-MIN DAILY DEBRIEF" to="/obsession/meditations" />
        <NavTile num="02" name="TRAINING"    desc="RUN / FUEL TRACE"    to="/obsession/training" />
        <NavTile num="03" name="LIFTS"       desc="HYPERTROPHY LOG"     to="/obsession/lifts" />
        <NavTile num="04" name="SETTINGS"    desc="DURATION // LIMITS"  to="/obsession/settings" />
      </div>

      <div className="obs-section-head">
        DIRECTIVE <span className="obs-section-rule" />
      </div>

      {quote
        ? <p className="obs-quote">{quote.quote_text}</p>
        : <p className="obs-quote" style={{ opacity: 0.4 }}>// awaiting transmission</p>}

      <BirdButton />
    </>
  )
}
