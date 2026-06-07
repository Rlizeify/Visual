// Lifts logging surface. The user picks/creates an exercise, then
// appends sets one at a time. Each set carries weight, reps, stop
// reason (W/P/V/F), and intensity (0/1/2). The exercise field
// remembers the last selection so a typical workout requires only
// touching the weight + reps + stop fields.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  fetchExercises,
  upsertExercise,
  createSession,
  appendSet,
  fetchSets,
  formatShorthand,
  type NewSetInput,
} from '../lib/lifts'
import { todayLocalISODate } from '../lib/localDate'
import type {
  ObsessionLiftsExerciseRow,
  ObsessionLiftsSessionRow,
  ObsessionLiftsSetRow,
  ObsessionStopReason,
  ObsessionIntensity,
} from '../lib/types'

const STOP_REASONS: ObsessionStopReason[] = ['W', 'P', 'V', 'F']
const STOP_LABEL: Record<ObsessionStopReason, string> = {
  W: 'WARMUP',
  P: 'PUMP',
  V: 'VOLUME',
  F: 'FAILURE',
}

export default function LiftsLog() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const today = useMemo(() => todayLocalISODate(), [])

  const [exercises, setExercises] = useState<ObsessionLiftsExerciseRow[]>([])
  const [session, setSession] = useState<ObsessionLiftsSessionRow | null>(null)
  const [sets, setSets] = useState<ObsessionLiftsSetRow[]>([])

  // Set draft state.
  const [exerciseName, setExerciseName] = useState<string>('')
  const [newExerciseName, setNewExerciseName] = useState('')
  const [weight, setWeight] = useState<string>('')
  const [reps, setReps] = useState<string>('')
  const [stop, setStop] = useState<ObsessionStopReason>('V')
  const [intensity, setIntensity] = useState<ObsessionIntensity>(1)
  const [saving, setSaving] = useState(false)

  // Boot: load exercises and create or load today's session.
  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const ex = await fetchExercises(user.id)
      if (!active) return
      setExercises(ex)
      if (ex[0]) setExerciseName(ex[0].name)
      const s = await createSession(user.id, today)
      if (!active) return
      if (s) {
        setSession(s)
        const ss = await fetchSets(user.id, s.id)
        if (active) setSets(ss)
      }
    })()
    return () => { active = false }
  }, [user, today])

  async function handleAddExercise() {
    if (!user) return
    const name = newExerciseName.trim()
    if (!name) return
    const row = await upsertExercise(user.id, name)
    if (!row) return
    const ex = await fetchExercises(user.id)
    setExercises(ex)
    setExerciseName(row.name)
    setNewExerciseName('')
  }

  async function handleAppendSet() {
    if (!user || !session) return
    if (!exerciseName) return
    const r = parseInt(reps, 10)
    if (!Number.isFinite(r) || r < 1) return
    const w = weight.trim() === '' ? 0 : Number(weight)
    if (!Number.isFinite(w) || w < 0) return
    setSaving(true)
    const input: NewSetInput = {
      exercise_name: exerciseName,
      set_order: sets.length + 1,
      weight: w,
      reps: r,
      stop_reason: stop,
      intensity,
    }
    const row = await appendSet(user.id, session.id, input)
    if (row) setSets(prev => [...prev, row])
    setSaving(false)
    // Keep exercise + weight, clear reps so the next set is just keyboard.
    setReps('')
  }

  const shorthand = formatShorthand(sets)

  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession/lifts')}>← LIFTS</button>

      <div className="obs-title-sub">[ CHANNEL-03 // LOG ]</div>
      <h1 className="obs-title" style={{ fontSize: 40 }}>SESSION</h1>
      <div className="obs-title-sub" style={{ marginTop: 14 }}>
        APPEND-ONLY // {today}
      </div>

      <div className="obs-section-head">
        EXERCISE BANK <span className="obs-section-rule" />
      </div>

      <div className="obs-row">
        <span className="obs-row-label">SELECT</span>
        <select
          value={exerciseName}
          onChange={e => setExerciseName(e.target.value)}
        >
          <option value="">— SELECT EXERCISE —</option>
          {exercises.map(ex => (
            <option key={ex.id} value={ex.name}>{ex.name}</option>
          ))}
        </select>
      </div>
      <div className="obs-row">
        <span className="obs-row-label">ADD NEW</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newExerciseName}
            onChange={e => setNewExerciseName(e.target.value)}
            placeholder="e.g. INCLINE DB PRESS"
            style={{ flex: 1 }}
          />
          <button className="ac-wire-button" onClick={handleAddExercise}>[ ADD ]</button>
        </div>
      </div>

      <div className="obs-section-head">
        APPEND SET <span className="obs-section-rule" />
      </div>

      <div className="obs-row">
        <span className="obs-row-label">WEIGHT (LB)</span>
        <input
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="—"
          step="2.5"
          min="0"
        />
      </div>
      <div className="obs-row">
        <span className="obs-row-label">REPS</span>
        <input
          type="number"
          inputMode="numeric"
          value={reps}
          onChange={e => setReps(e.target.value)}
          placeholder="0"
          min="1"
        />
      </div>
      <div className="obs-row">
        <span className="obs-row-label">STOP REASON</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STOP_REASONS.map(r => {
            const selected = r === stop
            return (
              <button
                key={r}
                type="button"
                className={`ac-wire-button${selected ? ' ac-wire-button--amber' : ''}`}
                aria-pressed={selected}
                onClick={() => setStop(r)}
              >
                {/* Leading ● is the non-color affordance — toggle state is
                    legible without the amber tint (a11y U6 finding). */}
                [ {selected && '● '}{r} // {STOP_LABEL[r]} ]
              </button>
            )
          })}
        </div>
      </div>
      <div className="obs-row">
        <span className="obs-row-label">INTENSITY</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(i => {
            const selected = i === intensity
            return (
              <button
                key={i}
                type="button"
                className={`ac-wire-button${selected ? ' ac-wire-button--amber' : ''}`}
                aria-pressed={selected}
                onClick={() => setIntensity(i as ObsessionIntensity)}
              >
                [ {selected && '● '}{i}{i === 2 ? ' ↑' : ''} ]
              </button>
            )
          })}
        </div>
      </div>

      {(() => {
        // Mirror the server-side gates in handleAppendSet so the button
        // can ONLY click through when the click will actually persist a
        // set. The old `!reps` check passed '0' through (string '0' is
        // truthy) and handleAppendSet silently returned — U5 finding.
        const repsN = parseInt(reps, 10)
        const repsValid = Number.isFinite(repsN) && repsN >= 1
        const exerciseValid = !!exerciseName
        const blocked = !exerciseValid || !repsValid
        let hint: string | null = null
        if (!exerciseValid && !repsValid) hint = 'PICK AN EXERCISE AND SET REPS'
        else if (!exerciseValid)          hint = 'PICK AN EXERCISE'
        else if (!repsValid)              hint = 'SET REPS ≥ 1'
        return (
          <div style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ac-wire-button ac-wire-button--amber"
              disabled={saving || blocked}
              onClick={handleAppendSet}
            >
              [ APPEND SET #{sets.length + 1} ]
            </button>
            <span className="obs-pill">{sets.length} SETS THIS SESSION</span>
            {hint && (
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: 'var(--ac-phosphor-dim)',
                }}
              >
                ⚠ {hint}
              </span>
            )}
          </div>
        )
      })()}

      <div className="obs-section-head">
        SHORTHAND <span className="obs-section-rule" />
      </div>

      <div className="obs-entry-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
        <div className="obs-lift-shorthand" style={{ fontSize: 15 }}>
          {shorthand || '— NO SETS YET —'}
        </div>
      </div>

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <button
          className="ac-wire-button"
          onClick={() => navigate('/obsession/lifts')}
        >
          [ END SESSION ]
        </button>
      </div>
    </>
  )
}
