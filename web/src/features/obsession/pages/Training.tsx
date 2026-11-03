// Training surface.
//
// Two blocks:
//   1. Goals      — 5k/half/full/ironman/custom with target date.
//   2. MyNetDiary — drop a CSV exported from MND, we parse + insert.
//      The fuel log groups MND rows by upload batch.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  fetchGoals,
  createGoal,
  markGoalAchieved,
  deleteGoal,
  fetchMyNetDiaryEntries,
  ingestMyNetDiaryCsv,
  deleteMyNetDiaryBatch,
} from '../lib/training'
import { formatHudDate } from '../lib/localDate'
import type {
  ObsessionTrainingGoalRow,
  ObsessionMyNetDiaryEntryRow,
  ObsessionGoalKind,
} from '../lib/types'

const GOAL_KINDS: ObsessionGoalKind[] = ['5k', 'half', 'full', 'ironman', 'custom']

export default function Training() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [goals, setGoals] = useState<ObsessionTrainingGoalRow[]>([])
  const [mnd, setMnd] = useState<ObsessionMyNetDiaryEntryRow[]>([])
  const [loading, setLoading] = useState(true)

  // Goal form draft.
  const [gName, setGName] = useState('')
  const [gKind, setGKind] = useState<ObsessionGoalKind>('5k')
  const [gDate, setGDate] = useState('')

  // CSV upload state.
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvMsg, setCsvMsg] = useState<string | null>(null)

  async function reload() {
    if (!user) return
    setLoading(true)
    const [g, m] = await Promise.all([
      fetchGoals(user.id),
      fetchMyNetDiaryEntries(user.id),
    ])
    setGoals(g); setMnd(m); setLoading(false)
  }

  useEffect(() => { void reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user])

  async function addGoal() {
    if (!user) return
    const name = gName.trim()
    if (!name) return
    await createGoal(user.id, { name, kind: gKind, target_date: gDate || null })
    setGName(''); setGDate('')
    await reload()
  }

  async function onCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return
    const file = e.target.files?.[0]
    if (!file) return
    setCsvBusy(true); setCsvMsg(null)
    try {
      const text = await file.text()
      const r = await ingestMyNetDiaryCsv(user.id, text)
      setCsvMsg(`INGESTED ${r.inserted} ROWS // ${r.skipped} SKIPPED`)
      await reload()
    } catch (err) {
      setCsvMsg(`CSV ERROR // ${(err as Error).message}`)
    }
    e.target.value = ''
    setCsvBusy(false)
  }

  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession')}>← OBSESSION</button>

      <div className="obs-title-sub">[ CHANNEL-02 ]</div>
      <h1 className="obs-title" style={{ fontSize: 48 }}>TRAINING</h1>
      <div className="obs-title-sub" style={{ marginTop: 14 }}>
        GOALS // FUEL TRACE
      </div>

      <div className="obs-section-head">
        GOALS <span className="obs-section-rule" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="GOAL NAME — e.g. SAN FRAN MARATHON"
          value={gName}
          onChange={e => setGName(e.target.value)}
        />
        <select value={gKind} onChange={e => setGKind(e.target.value as ObsessionGoalKind)}>
          {GOAL_KINDS.map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
        </select>
        <input type="date" value={gDate} onChange={e => setGDate(e.target.value)} />
        <button className="ac-wire-button ac-wire-button--amber" onClick={addGoal}>[ FILE ]</button>
      </div>

      <div style={{ marginTop: 14 }}>
        {goals.length === 0 && <span className="obs-pill">NO GOALS // FILE ONE ABOVE</span>}
        {goals.map(g => (
          <div key={g.id} className="obs-entry-row">
            <div className="obs-entry-row-date">{g.target_date ? formatHudDate(g.target_date) : 'NO DATE'}</div>
            <div className="obs-entry-row-body">
              <strong style={{ color: 'var(--ac-phosphor-bright)' }}>[{g.kind.toUpperCase()}]</strong> {g.name}
              {g.achieved_at && <span style={{ color: 'var(--ac-amber)', marginLeft: 8 }}> ✓ ACHIEVED</span>}
            </div>
            <button className="ac-wire-button" onClick={() => markGoalAchieved(user!.id, g.id, !g.achieved_at).then(reload)}>
              {g.achieved_at ? '[ UNDO ]' : '[ MARK ACHIEVED ]'}
            </button>
            <button className="ac-wire-button ac-wire-button--danger" onClick={() => deleteGoal(user!.id, g.id).then(reload)}>
              [ DROP ]
            </button>
          </div>
        ))}
      </div>

      <div className="obs-section-head">
        MYNETDIARY UPLOAD <span className="obs-section-rule" />
      </div>

      <div className="obs-row">
        <span className="obs-row-label">CSV EXPORT</span>
        <input type="file" accept=".csv,text/csv" onChange={onCsvFile} disabled={csvBusy} />
      </div>
      {csvMsg && <div style={{ marginTop: 8 }}><span className="obs-pill">{csvMsg}</span></div>}

      {loading && <div style={{ marginTop: 14 }}><span className="obs-pill">LOADING…</span></div>}

      {mnd.length > 0 && (
        <>
          <div className="obs-section-head">
            FUEL LOG <span className="obs-section-rule" />
          </div>
          {Array.from(new Set(mnd.map(m => m.upload_batch).filter(Boolean))).slice(0, 5).map(batch => {
            const rows = mnd.filter(m => m.upload_batch === batch)
            const totalCal = rows.reduce((s, r) => s + (r.calories ?? 0), 0)
            return (
              <div key={batch ?? 'unbatched'} className="obs-entry-row">
                <div className="obs-entry-row-date">{formatHudDate(rows[0].entry_date)}</div>
                <div className="obs-entry-row-body">
                  {rows.length} ITEMS // {Math.round(totalCal)} KCAL
                </div>
                <button className="ac-wire-button ac-wire-button--danger" onClick={() => deleteMyNetDiaryBatch(user!.id, batch!).then(reload)}>
                  [ DROP BATCH ]
                </button>
              </div>
            )
          })}
        </>
      )}
    </>
  )
}
