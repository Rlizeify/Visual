// Training surface.
//
// Three blocks:
//   1. Goals    — 5k/half/full/ironman/custom with target date.
//   2. Strava   — connect (kicks /api/oauth?provider=strava), pull
//                 last 90d of activities into obsession_strava_activities.
//   3. MyNetDiary — drop a CSV exported from MND, we parse + insert.
//
// Activity feed shows last 30 Strava + MND rows merged by date.
// Conflict markers fire when a Strava session has a calorie burn
// estimate in the same day as a heavy MND food log — currently
// rendered as a passive "[ CONFLICT ]" pill (UI-only, no auto-resolve).

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import {
  fetchGoals,
  createGoal,
  markGoalAchieved,
  deleteGoal,
  fetchStravaTokenStatus,
  fetchStravaActivities,
  triggerStravaSync,
  fetchMyNetDiaryEntries,
  ingestMyNetDiaryCsv,
  deleteMyNetDiaryBatch,
} from '../lib/training'
import { formatHudDate, localISODateOf } from '../lib/localDate'
import type {
  ObsessionTrainingGoalRow,
  ObsessionStravaActivityRow,
  ObsessionStravaTokenRow,
  ObsessionMyNetDiaryEntryRow,
  ObsessionGoalKind,
} from '../lib/types'

const GOAL_KINDS: ObsessionGoalKind[] = ['5k', 'half', 'full', 'ironman', 'custom']

function metersToMiles(m: number | null): string {
  if (m === null) return '—'
  return `${(m / 1609.344).toFixed(2)} MI`
}
function secondsToHms(s: number | null): string {
  if (s === null) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

export default function Training() {
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()

  const [goals, setGoals] = useState<ObsessionTrainingGoalRow[]>([])
  const [stravaToken, setStravaToken] = useState<ObsessionStravaTokenRow | null>(null)
  const [activities, setActivities] = useState<ObsessionStravaActivityRow[]>([])
  const [mnd, setMnd] = useState<ObsessionMyNetDiaryEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // Goal form draft.
  const [gName, setGName] = useState('')
  const [gKind, setGKind] = useState<ObsessionGoalKind>('5k')
  const [gDate, setGDate] = useState('')

  // CSV upload state.
  const [csvBusy, setCsvBusy] = useState(false)
  const [csvMsg, setCsvMsg] = useState<string | null>(null)

  const stravaConnected = !!stravaToken
  const stravaConnectedFlag = search.get('strava_connected')
  const stravaError = search.get('error')

  async function reload() {
    if (!user) return
    setLoading(true)
    const [g, t, a, m] = await Promise.all([
      fetchGoals(user.id),
      fetchStravaTokenStatus(user.id),
      fetchStravaActivities(user.id),
      fetchMyNetDiaryEntries(user.id),
    ])
    setGoals(g); setStravaToken(t); setActivities(a); setMnd(m); setLoading(false)
  }

  useEffect(() => { void reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user])

  // If we just landed back from Strava's redirect, run a sync and
  // clear the query param.
  useEffect(() => {
    if (!stravaConnectedFlag || !session?.access_token) return
    void (async () => {
      setSyncing(true)
      const r = await triggerStravaSync(session.access_token)
      setSyncing(false)
      setSyncMsg(r.ok ? `SYNCED ${r.count ?? 0} ACTIVITIES` : `SYNC FAILED — ${r.error}`)
      await reload()
      search.delete('strava_connected')
      setSearch(search, { replace: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stravaConnectedFlag, session?.access_token])

  function startStravaOAuth() {
    if (!session?.access_token) return
    const url = `/api/oauth?provider=strava&session=${encodeURIComponent(session.access_token)}`
    window.location.href = url
  }

  async function syncStrava() {
    if (!session?.access_token) return
    setSyncing(true)
    const r = await triggerStravaSync(session.access_token)
    setSyncing(false)
    setSyncMsg(r.ok ? `SYNCED ${r.count ?? 0} ACTIVITIES` : `SYNC FAILED — ${r.error}`)
    await reload()
  }

  async function disconnectStrava() {
    if (!user) return
    await supabase.from('obsession_strava_tokens').delete().eq('user_id', user.id)
    await reload()
  }

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

  // Conflict detection — flag days where Strava activity exists
  // alongside an MND log with >1500 cal total.
  const conflictDays = useMemo(() => {
    const stravaDays = new Set(activities.map(a => localISODateOf(a.started_at)))
    const mndByDay = new Map<string, number>()
    for (const m of mnd) {
      mndByDay.set(m.entry_date, (mndByDay.get(m.entry_date) ?? 0) + (m.calories ?? 0))
    }
    const out = new Set<string>()
    stravaDays.forEach(d => {
      if ((mndByDay.get(d) ?? 0) > 1500) out.add(d)
    })
    return out
  }, [activities, mnd])

  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession')}>← OBSESSION</button>

      <div className="obs-title-sub">[ CHANNEL-02 ]</div>
      <h1 className="obs-title" style={{ fontSize: 48 }}>TRAINING</h1>
      <div className="obs-title-sub" style={{ marginTop: 14 }}>
        GOALS // RUN TRACE // FUEL TRACE
      </div>

      {stravaError && (
        <div style={{ marginTop: 16 }}>
          <span className="obs-pill obs-pill--red">STRAVA ERROR // {stravaError}</span>
        </div>
      )}

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
        STRAVA <span className="obs-section-rule" />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {stravaConnected
          ? <span className="obs-pill obs-pill--ok">LINKED // ATHLETE {stravaToken!.athlete_id ?? '—'}</span>
          : <span className="obs-pill obs-pill--amber">NOT LINKED</span>}
        {!stravaConnected && (
          <button className="ac-wire-button ac-wire-button--amber" onClick={startStravaOAuth}>
            [ CONNECT STRAVA ]
          </button>
        )}
        {stravaConnected && (
          <>
            <button className="ac-wire-button ac-wire-button--amber" onClick={syncStrava} disabled={syncing}>
              {syncing ? '[ SYNCING… ]' : '[ SYNC NOW ]'}
            </button>
            <button className="ac-wire-button ac-wire-button--danger" onClick={disconnectStrava}>
              [ DISCONNECT ]
            </button>
          </>
        )}
        {syncMsg && <span className="obs-pill">{syncMsg}</span>}
      </div>

      <div className="obs-section-head">
        MYNETDIARY UPLOAD <span className="obs-section-rule" />
      </div>

      <div className="obs-row">
        <span className="obs-row-label">CSV EXPORT</span>
        <input type="file" accept=".csv,text/csv" onChange={onCsvFile} disabled={csvBusy} />
      </div>
      {csvMsg && <div style={{ marginTop: 8 }}><span className="obs-pill">{csvMsg}</span></div>}

      <div className="obs-section-head">
        ACTIVITY FEED <span className="obs-section-rule" />
      </div>

      {loading && <span className="obs-pill">LOADING…</span>}
      {!loading && activities.length === 0 && (
        <span className="obs-pill">NO ACTIVITIES // SYNC STRAVA OR UPLOAD CSV</span>
      )}
      {activities.slice(0, 30).map(a => {
        const day = localISODateOf(a.started_at)
        const conflict = conflictDays.has(day)
        return (
          <div key={a.id} className="obs-entry-row">
            <div className="obs-entry-row-date">{formatHudDate(day)}</div>
            <div className="obs-entry-row-body">
              <strong style={{ color: 'var(--ac-phosphor-bright)' }}>{a.type.toUpperCase()}</strong>
              &nbsp;//&nbsp;{metersToMiles(a.distance)}&nbsp;//&nbsp;{secondsToHms(a.moving_time)}
            </div>
            {conflict && <span className="obs-pill obs-pill--red">CONFLICT // FUEL OVERLAP</span>}
            <span className="obs-entry-row-tag">STRAVA</span>
          </div>
        )
      })}

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
