// 7-minute write surface. The user is committed to the box until the
// timer hits 0:00, at which point we auto-submit, flash a tag, and
// return them to the Meditations list.
//
// Contract:
//   - Duration & daily limit come from preferences (defaults: 420s / 1).
//   - If today's count is already at the limit, redirect immediately.
//   - Draft autosaves every 5s while body changes; persists body +
//     started_at so a resume on a new tab reconstructs the elapsed
//     clock from wall time.
//   - Resume reuses draft body + draft.started_at.
//   - Manual lock-in disabled until at least 30s have passed.
//   - On final submit, draft is deleted (handled in lockInMeditation).

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  countMeditationsForDay,
  lockInMeditation,
  loadDraft,
  saveDraft,
  elapsedSecondsSince,
} from '../lib/meditations'
import { loadPreferences } from '../lib/preferences'
import { todayLocalISODate } from '../lib/localDate'
import { DEFAULT_MEDITATION_DURATION_SECONDS } from '../lib/types'

const MIN_LOCKIN_SECONDS = 30
const AUTOSAVE_INTERVAL_MS = 5000
const TAG_FLASH_MS = 10000

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export default function MeditationsWrite() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = todayLocalISODate()

  const [duration, setDuration] = useState<number>(DEFAULT_MEDITATION_DURATION_SECONDS)
  const [startedAt, setStartedAt] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const [body, setBody] = useState('')
  const [booted, setBooted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const bodyRef = useRef(body)
  const startedAtRef = useRef(startedAt)
  const submittedRef = useRef(false)
  bodyRef.current = body
  startedAtRef.current = startedAt

  // Boot: hydrate prefs + today's draft + daily-count gate.
  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const [prefs, count, draft] = await Promise.all([
        loadPreferences(user.id),
        countMeditationsForDay(user.id, today),
        loadDraft(user.id, today),
      ])
      if (!active) return
      if (count >= prefs.meditation_daily_limit) {
        navigate('/obsession/meditations', { replace: true })
        return
      }
      setDuration(prefs.meditation_duration_seconds)
      if (draft) {
        setBody(draft.body ?? '')
        setStartedAt(draft.started_at)
        setElapsed(Math.min(elapsedSecondsSince(draft.started_at), prefs.meditation_duration_seconds))
      } else {
        const now = new Date().toISOString()
        setStartedAt(now)
        setElapsed(0)
        // Create the draft row up-front so an immediate refresh
        // resumes from this start time, not a fresh one.
        void saveDraft(user.id, today, '', now)
      }
      setBooted(true)
    })()
    return () => { active = false }
  }, [user, today, navigate])

  // Submit handler — used by both auto and manual paths.
  function doSubmit(reason: 'auto' | 'manual') {
    if (!user || submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    const text = bodyRef.current
    const start = startedAtRef.current || new Date().toISOString()
    lockInMeditation(user.id, text, start, today)
      .then(row => {
        setSubmitting(false)
        if (!row) {
          submittedRef.current = false
          return
        }
        const tag = reason === 'auto' ? 'TIMER LOCKED' : 'MANUAL LOCK-IN'
        setFlash(tag)
        window.setTimeout(() => navigate('/obsession/meditations', { replace: true }), TAG_FLASH_MS)
      })
  }

  // Tick. Recomputes elapsed from wall time so a paused / backgrounded
  // tab snaps to the correct value when it resumes.
  useEffect(() => {
    if (!booted || !startedAt) return
    const id = window.setInterval(() => {
      const e = elapsedSecondsSince(startedAtRef.current)
      if (e >= duration) {
        window.clearInterval(id)
        setElapsed(duration)
        window.setTimeout(() => doSubmit('auto'), 0)
      } else {
        setElapsed(e)
      }
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, startedAt, duration])

  // Autosave body changes.
  useEffect(() => {
    if (!user || !booted) return
    let lastBody = body
    const id = window.setInterval(() => {
      if (submittedRef.current) return
      const b = bodyRef.current
      if (b === lastBody) return
      lastBody = b
      void saveDraft(user.id, today, b, startedAtRef.current)
    }, AUTOSAVE_INTERVAL_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, booted, today])

  if (!booted) {
    return (
      <div className="obs-write-stage">
        <div className="obs-write-head">
          <span className="obs-pill">LOADING…</span>
        </div>
        <div className="obs-write-body" />
        <div className="obs-write-foot">&nbsp;</div>
      </div>
    )
  }

  const remaining = Math.max(0, duration - elapsed)
  const final = remaining <= 30
  const canManual = elapsed >= MIN_LOCKIN_SECONDS && !submittedRef.current
  const progressPct = Math.min(100, (elapsed / duration) * 100)

  return (
    <div className="obs-write-stage">
      <div className="obs-write-head">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 9, letterSpacing: '0.30em', color: 'var(--ac-phosphor-dim)' }}>
            [ DEBRIEF // {today} ]
          </span>
          <span style={{ fontSize: 11, letterSpacing: '0.20em', color: 'var(--ac-phosphor-bright)', marginTop: 4 }}>
            BODY → MEMORY → BANK
          </span>
        </div>
        <div className={`obs-write-timer${final ? ' obs-write-timer--final' : ''}`}>
          {fmt(remaining)}
        </div>
        <button
          type="button"
          className="ac-wire-button ac-wire-button--amber"
          disabled={!canManual || submitting}
          onClick={() => doSubmit('manual')}
        >
          [ LOCK IN ]
        </button>
      </div>

      <div className="obs-write-body">
        <textarea
          autoFocus
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="What did you do today? What was wasted? What will you not waste tomorrow?"
          spellCheck={false}
        />
      </div>

      <div className="obs-write-foot" style={{ position: 'relative' }}>
        <span>{body.length} CHARS // {Math.floor(elapsed / 60)}M {elapsed % 60}S ELAPSED</span>
        <span>AUTOSAVE // EVERY 5S</span>
        <div className="obs-write-progress" style={{ width: `${progressPct}%` }} />
      </div>

      {flash && (
        <div className="obs-tag-flash">
          <div className="obs-tag-flash-card">
            <div className="obs-tag-flash-label">[ LOCKED IN ]</div>
            <div className="obs-tag-flash-value">{flash}</div>
          </div>
        </div>
      )}
    </div>
  )
}
