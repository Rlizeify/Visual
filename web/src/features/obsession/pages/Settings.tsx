// Obsession — per-user preferences surface.
//
// Knobs:
//   - meditation_duration_seconds  (60..1800, default 420)
//   - meditation_daily_limit       (1..10, default 1)
//   - source_preference_conflicts  ('strava' | 'mynetdiary' | 'ask')
//
// Lowering the duration prompts confirm — the discipline cap is the
// whole point of the feature, so we don't let the user erode it
// silently. Daily-limit raises require no confirm.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  loadPreferences, savePreferences, validatePreferencesPatch,
  DURATION_MIN, DURATION_MAX, DURATION_STEP, LIMIT_MIN, LIMIT_MAX,
} from '../lib/preferences'
import { exportSurface, exportBundle, type ObsessionSurface } from '../lib/export'
import type {
  ObsessionPreferencesRow,
  SourceConflictPreference,
} from '../lib/types'

const SOURCE_OPTIONS: { value: SourceConflictPreference; label: string; help: string }[] = [
  { value: 'ask',        label: 'ASK ME',     help: 'Conflict pill stays visible; you resolve manually.' },
  { value: 'strava',     label: 'STRAVA',     help: 'When in doubt, trust the run-trace.' },
  { value: 'mynetdiary', label: 'MYNETDIARY', help: 'When in doubt, trust the fuel log.' },
]

export default function Settings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [prefs, setPrefs] = useState<ObsessionPreferencesRow | null>(null)
  const [duration, setDuration] = useState(420)
  const [limit, setLimit] = useState(1)
  const [src, setSrc] = useState<SourceConflictPreference>('ask')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true
    loadPreferences(user.id).then(p => {
      if (!active) return
      setPrefs(p)
      setDuration(p.meditation_duration_seconds)
      setLimit(p.meditation_daily_limit)
      setSrc(p.source_preference_conflicts)
    })
    return () => { active = false }
  }, [user])

  const validationError = validatePreferencesPatch({
    meditation_duration_seconds: duration,
    meditation_daily_limit: limit,
  })

  // Snap an out-of-step / out-of-range duration to the nearest legal
  // value. Wired to the input's onBlur so the user sees the correction
  // immediately when they leave the field instead of being silently
  // blocked from saving.
  function snapDuration() {
    const clamped = Math.max(DURATION_MIN, Math.min(DURATION_MAX, duration))
    const snapped = Math.round(clamped / DURATION_STEP) * DURATION_STEP
    if (snapped !== duration) setDuration(snapped)
  }

  function snapLimit() {
    const clamped = Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, Math.round(limit)))
    if (clamped !== limit) setLimit(clamped)
  }

  async function save() {
    if (!user || !prefs) return
    if (validationError) return
    if (duration < prefs.meditation_duration_seconds) {
      const ok = window.confirm(
        `Lower the lock from ${prefs.meditation_duration_seconds}s to ${duration}s?\n\nThe discipline cap is the point. Confirm to proceed.`
      )
      if (!ok) return
    }
    setBusy(true); setMsg(null)
    try {
      const next = await savePreferences(user.id, {
        meditation_duration_seconds: duration,
        meditation_daily_limit: limit,
        source_preference_conflicts: src,
      })
      setPrefs(next)
      setMsg('SAVED // ACK')
    } catch (err) {
      setMsg(`SAVE FAILED // ${(err as Error).message}`)
    }
    setBusy(false)
  }

  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession')}>← OBSESSION</button>

      <div className="obs-title-sub">[ CHANNEL-04 ]</div>
      <h1 className="obs-title" style={{ fontSize: 48 }}>SETTINGS</h1>
      <div className="obs-title-sub" style={{ marginTop: 14 }}>
        DURATION // LIMITS // CONFLICT POLICY
      </div>

      <div className="obs-section-head">
        MEDITATION LOCK <span className="obs-section-rule" />
      </div>

      <div className="obs-row">
        <span className="obs-row-label">DURATION (S)</span>
        <input
          type="number"
          min={DURATION_MIN}
          max={DURATION_MAX}
          step={DURATION_STEP}
          value={duration}
          // Clamp at type-time so the value never goes wildly out of
          // range, but defer the step-snap to onBlur so users can type
          // mid-stream digits ("420" passes through "4" -> "42" -> "420"
          // without each intermediate getting snapped).
          onChange={e => setDuration(Math.max(DURATION_MIN, Math.min(DURATION_MAX, Number(e.target.value) || DURATION_MIN)))}
          onBlur={snapDuration}
          // Selecting on focus prevents the triple-click-append bug
          // where typing into a focused field would extend the value
          // instead of replacing it.
          onFocus={e => e.currentTarget.setSelectionRange(0, e.currentTarget.value.length)}
        />
      </div>
      <div className="obs-row">
        <span className="obs-row-label">DURATION (M)</span>
        <span style={{ color: 'var(--ac-phosphor-bright)' }}>
          {Math.floor(duration / 60)}M {duration % 60}S
        </span>
      </div>
      <div className="obs-row">
        <span className="obs-row-label">DAILY LIMIT</span>
        <input
          type="number"
          min={LIMIT_MIN}
          max={LIMIT_MAX}
          step={1}
          value={limit}
          onChange={e => setLimit(Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, Number(e.target.value) || LIMIT_MIN)))}
          onBlur={snapLimit}
          onFocus={e => e.currentTarget.setSelectionRange(0, e.currentTarget.value.length)}
        />
      </div>

      <div className="obs-section-head">
        SOURCE CONFLICT POLICY <span className="obs-section-rule" />
      </div>

      <div role="radiogroup" aria-label="Source conflict policy" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SOURCE_OPTIONS.map(o => {
          const selected = o.value === src
          return (
            <button
              key={o.value}
              type="button"
              className={`ac-wire-button${selected ? ' ac-wire-button--amber' : ''}`}
              aria-pressed={selected}
              onClick={() => setSrc(o.value)}
              title={o.help}
            >
              [ {selected && '● '}{o.label} ]
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, letterSpacing: '0.18em', color: 'var(--ac-phosphor-dim)' }}>
        {SOURCE_OPTIONS.find(o => o.value === src)?.help}
      </div>

      {validationError && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--ac-warn, #d96a3c)',
          }}
        >
          ⚠ {validationError.toUpperCase()}
        </div>
      )}

      <div style={{ marginTop: 28, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          className="ac-wire-button ac-wire-button--amber"
          disabled={busy || validationError !== null}
          onClick={save}
        >
          {busy ? '[ SAVING… ]' : '[ COMMIT SETTINGS ]'}
        </button>
        {msg && <span className="obs-pill">{msg}</span>}
      </div>

      <div className="obs-section-head">
        EXPORT <span className="obs-section-rule" />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {(['meditations', 'training', 'lifts', 'preferences'] as ObsessionSurface[]).map(s => (
          <div key={s} className="obs-row">
            <span className="obs-row-label">{s.toUpperCase()}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="ac-wire-button" disabled={!user} onClick={() => exportSurface(user!.id, s, 'json')}>
                [ JSON ]
              </button>
              <button className="ac-wire-button" disabled={!user} onClick={() => exportSurface(user!.id, s, 'csv')}>
                [ CSV ]
              </button>
            </div>
          </div>
        ))}
        <div className="obs-row">
          <span className="obs-row-label">FULL BUNDLE</span>
          <button className="ac-wire-button ac-wire-button--amber" disabled={!user} onClick={() => exportBundle(user!.id)}>
            [ DUMP ALL // JSON ]
          </button>
        </div>
      </div>
    </>
  )
}
