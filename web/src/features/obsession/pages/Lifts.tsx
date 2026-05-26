// Lifts surface — history of sessions w/ shorthand display.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  fetchSessions,
  fetchExercises,
  fetchSetsForSessions,
  formatShorthand,
} from '../lib/lifts'
import { formatHudDate } from '../lib/localDate'
import type {
  ObsessionLiftsSessionRow,
  ObsessionLiftsExerciseRow,
  ObsessionLiftsSetRow,
} from '../lib/types'
import type { ReactNode } from 'react'

export default function Lifts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ObsessionLiftsSessionRow[]>([])
  const [exercises, setExercises] = useState<ObsessionLiftsExerciseRow[]>([])
  const [setsBySession, setSetsBySession] = useState<Record<string, ObsessionLiftsSetRow[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    ;(async () => {
      const [ss, ex] = await Promise.all([
        fetchSessions(user.id),
        fetchExercises(user.id),
      ])
      if (!active) return
      setSessions(ss)
      setExercises(ex)
      const bulk = await fetchSetsForSessions(user.id, ss.map(s => s.id))
      if (!active) return
      setSetsBySession(bulk)
      setLoading(false)
    })()
    return () => { active = false }
  }, [user])

  function renderShorthand(s: ObsessionLiftsSessionRow) {
    const sets = setsBySession[s.id] ?? []
    if (sets.length === 0) return <span style={{ color: 'var(--ac-phosphor-faint)' }}>—</span>
    const text = formatShorthand(sets)
    // Colour the stop-reason letters and the up-arrow by class.
    const parts: ReactNode[] = []
    let i = 0
    for (const ch of text) {
      if (ch === 'W' || ch === 'P' || ch === 'V' || ch === 'F') {
        parts.push(<span key={i++} className={`stop-${ch}`}>{ch}</span>)
      } else if (ch === '↑') {
        parts.push(<span key={i++} className="up">{ch}</span>)
      } else {
        parts.push(<span key={i++}>{ch}</span>)
      }
    }
    return <span className="obs-lift-shorthand">{parts}</span>
  }

  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession')}>← OBSESSION</button>

      <div className="obs-title-sub">[ CHANNEL-03 ]</div>
      <h1 className="obs-title" style={{ fontSize: 48 }}>LIFTS</h1>
      <div className="obs-title-sub" style={{ marginTop: 14 }}>
        WEIGHT // REPS // STOP REASON // INTENSITY
      </div>

      <div className="obs-crosshair">[ CURRENT ]</div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="ac-wire-button ac-wire-button--amber" onClick={() => navigate('/obsession/lifts/log')}>
          [ LOG SESSION ]
        </button>
        <span className="obs-pill">{exercises.length} EXERCISES IN BANK</span>
        <span className="obs-pill">{sessions.length} SESSIONS LOGGED</span>
      </div>

      <div className="obs-section-head">
        SESSION HISTORY <span className="obs-section-rule" />
      </div>

      {loading && <div className="obs-pill">LOADING…</div>}
      {!loading && sessions.length === 0 && (
        <div className="obs-pill">NO SESSIONS // LOG YOUR FIRST</div>
      )}

      {sessions.map(s => (
        <div key={s.id} className="obs-entry-row">
          <div className="obs-entry-row-date">{formatHudDate(s.session_date)}</div>
          <div className="obs-entry-row-body">{renderShorthand(s)}</div>
          {s.notes && <span className="obs-entry-row-tag">NOTES</span>}
        </div>
      ))}

      <div style={{ marginTop: 28, fontSize: 9, letterSpacing: '0.20em', color: 'var(--ac-phosphor-dim)' }}>
        LEGEND // W = WARMUP // P = PUMP // V = VOLUME // F = FAILURE // ↑ = INTENSITY 2
      </div>
    </>
  )
}
