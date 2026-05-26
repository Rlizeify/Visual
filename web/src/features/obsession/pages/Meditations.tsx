// Meditations list. Shows lock-in history, today's status (drafted /
// done / locked-out), and a single CTA to /obsession/meditations/write.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  fetchMeditations,
  countMeditationsForDay,
  loadDraft,
  durationSecondsOf,
  elapsedSecondsSince,
} from '../lib/meditations'
import { loadPreferences } from '../lib/preferences'
import { todayLocalISODate, formatHudDate } from '../lib/localDate'
import type {
  ObsessionMeditationRow,
  ObsessionMeditationDraftRow,
  ObsessionPreferencesRow,
} from '../lib/types'

export default function Meditations() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ObsessionMeditationRow[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [prefs, setPrefs] = useState<ObsessionPreferencesRow | null>(null)
  const [draft, setDraft] = useState<ObsessionMeditationDraftRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const today = useMemo(() => todayLocalISODate(), [])

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    Promise.all([
      fetchMeditations(user.id),
      countMeditationsForDay(user.id, today),
      loadPreferences(user.id),
      loadDraft(user.id, today),
    ]).then(([r, c, p, d]) => {
      if (!active) return
      setRows(r); setTodayCount(c); setPrefs(p); setDraft(d); setLoading(false)
    })
    return () => { active = false }
  }, [user, today])

  const limit = prefs?.meditation_daily_limit ?? 1
  const remaining = Math.max(0, limit - todayCount)
  const canWrite = remaining > 0 && !!prefs
  const draftMinutes = draft ? Math.floor(elapsedSecondsSince(draft.started_at) / 60) : 0
  const ctaLabel = draft
    ? `[ RESUME // ${draftMinutes}M ELAPSED ]`
    : '[ INITIATE DEBRIEF ]'

  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession')}>← OBSESSION</button>

      <div className="obs-title-sub">[ CHANNEL-01 ]</div>
      <h1 className="obs-title" style={{ fontSize: 48 }}>MEDITATIONS</h1>
      <div className="obs-title-sub" style={{ marginTop: 14 }}>
        DAILY DEBRIEF // {prefs ? Math.floor(prefs.meditation_duration_seconds / 60) : 7}-MIN LOCK
      </div>

      <div className="obs-crosshair">[ TODAY ]</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="obs-pill obs-pill--amber">
          {String(todayCount).padStart(2, '0')} / {String(limit).padStart(2, '0')} TODAY
        </span>
        {draft && <span className="obs-pill">DRAFT IN PROGRESS</span>}
        {!canWrite && <span className="obs-pill obs-pill--red">LOCK-OUT // RETURN TOMORROW</span>}
        <button
          type="button"
          className="ac-wire-button ac-wire-button--amber"
          disabled={!canWrite}
          onClick={() => navigate('/obsession/meditations/write')}
          style={{ marginLeft: 'auto' }}
        >
          {ctaLabel}
        </button>
      </div>

      <div className="obs-section-head">
        HISTORY <span className="obs-section-rule" />
      </div>

      {loading && <div className="obs-pill">LOADING…</div>}
      {!loading && rows.length === 0 && (
        <div className="obs-pill">NO ENTRIES // LOCK IN YOUR FIRST</div>
      )}

      {rows.map(r => {
        const open = expanded === r.id
        return (
          <div key={r.id} className="obs-entry-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
              <div className="obs-entry-row-date">{formatHudDate(r.day_of_entry)}</div>
              <div className="obs-entry-row-body" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.body.slice(0, 140) || '—'}
              </div>
              <span className="obs-entry-row-tag">
                {Math.floor(durationSecondsOf(r) / 60)}M
              </span>
              <button className="ac-wire-button" onClick={() => setExpanded(open ? null : r.id)}>
                {open ? '[ COLLAPSE ]' : '[ READ ]'}
              </button>
            </div>
            {open && (
              <pre style={{
                margin: '10px 0 0',
                fontFamily: 'Times New Roman, Georgia, serif',
                fontSize: 15,
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                color: 'var(--ac-phosphor-bright)',
              }}>{r.body}</pre>
            )}
          </div>
        )
      })}

      <div className="obs-crosshair">[ END OF TRANSMISSION ]</div>

      <Link to="/obsession/settings" style={{ fontSize: 10, letterSpacing: '0.20em', color: 'var(--ac-phosphor-dim)' }}>
        ADJUST DURATION OR DAILY LIMIT →
      </Link>
    </>
  )
}
