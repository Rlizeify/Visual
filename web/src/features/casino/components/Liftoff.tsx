// Liftoff: a multiplier that climbs until it busts. Cash out before it does.
// The server holds the bust point; this screen runs the climb on the
// server's clock and asks the server to settle (tick) as it goes, so the
// bust shows within a moment of happening.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { casino, fmt } from '../lib/api'
import { CRASH, initialCrash, msFor, multAt, type CrashState } from '../lib/crash'
import { BetInput } from './PlayingCard'
import { rocketPitch, sfx, startRocket, stopRocket } from '../lib/sound'

const TICK_MS = 600
const W = 320, H = 180, PAD = 14

interface Reply { state: CrashState; serverNow: number }

/** Unrounded climb for drawing (multAt floors to cents, which steps). */
const smooth = (ms: number) => Math.exp(CRASH.growth * Math.max(0, ms))

/** Curve points from liftoff to `ms`, scaled to the plot. */
function curve(ms: number, top: number, span: number) {
  const pts: [number, number][] = []
  const n = 48
  for (let i = 0; i <= n; i++) {
    const t = (ms * i) / n
    pts.push([PAD + ((W - 2 * PAD) * t) / span, H - PAD - ((H - 2 * PAD) * (smooth(t) - 1)) / (top - 1)])
  }
  return pts
}

export default function Liftoff({ me }: { me: string }) {
  const [s, setS] = useState<CrashState | null>(null)
  const [bet, setBet] = useState(100)
  const [auto, setAuto] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, frame] = useState(0)
  const offset = useRef(0) // server clock − ours
  const stateRef = useRef<CrashState | null>(null)
  const lastCount = useRef(0)
  stateRef.current = s

  useEffect(() => {
    supabase.from('casino_tables').select('state').eq('id', `crash:${me}`).maybeSingle()
      .then(({ data }) => setS(data && Object.keys(data.state ?? {}).length ? (data.state as CrashState) : initialCrash()))
  }, [me])

  const send = useCallback(async (action: Record<string, unknown>) => {
    const sentAt = Date.now()
    const out = await casino<Reply>('crash', { action })
    // Assume the reply took half the round trip to come back.
    offset.current = out.serverNow - (sentAt + Date.now()) / 2
    setS(out.state)
    return out.state
  }, [])

  const flying = s?.phase === 'flying'

  // Animate and keep asking the server whether it busted.
  useEffect(() => {
    if (!flying) return
    let raf = 0
    const draw = () => { frame(n => n + 1); raf = requestAnimationFrame(draw) }
    raf = requestAnimationFrame(draw)
    const iv = window.setInterval(() => {
      if (stateRef.current?.phase === 'flying') send({ type: 'tick' }).catch(() => {})
    }, TICK_MS)
    return () => { cancelAnimationFrame(raf); window.clearInterval(iv) }
  }, [flying, send])

  // Engine noise off when leaving the tab.
  useEffect(() => stopRocket, [])

  // Bust / cash-out stings on the change of phase.
  const lastPhase = useRef<string | null>(null)
  useEffect(() => {
    if (!s) return
    const prev = lastPhase.current
    lastPhase.current = s.phase
    if (prev !== 'flying' || s.phase === 'flying') return
    if (s.phase === 'busted') sfx.crash()
    else if (s.phase === 'cashed') { stopRocket(); sfx.win((s.cashedAt ?? 1) >= 5) }
  }, [s])

  const run = async (action: Record<string, unknown>) => {
    if (action.type === 'start') sfx.chip()
    setBusy(true)
    try { await send(action); setError(null) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  if (!s) return <p className="faint">Loading…</p>

  const serverNow = Date.now() + offset.current
  const sinceLift = flying ? serverNow - s.startedAt : 0
  const countdown = flying && sinceLift < 0 ? Math.ceil(-sinceLift / 1000) : 0
  const endMult = s.phase === 'busted' ? s.bustAt ?? 1 : s.phase === 'cashed' ? s.cashedAt ?? 1 : 1
  // While flying, never draw past the auto target the server will honour.
  const live = flying ? multAt(sinceLift) : endMult
  const shownMult = flying && s.auto !== null ? Math.min(live, s.auto) : live
  const ms = flying ? Math.max(0, sinceLift) : s.phase === 'idle' ? 0 : msFor(Math.max(1, s.phase === 'busted' ? (s.bustAt ?? 1) : (s.cashedAt ?? 1)))
  const span = Math.max(8000, ms * 1.15)
  const top = Math.max(2, smooth(ms) * 1.2)
  const pts = curve(ms, top, span)
  const line = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const tip = pts[pts.length - 1]
  // Heading from the curve's slope at the tip (d/dt of e^(g·t)), in plot units.
  const dx = (W - 2 * PAD) / span
  const dy = ((H - 2 * PAD) * CRASH.growth * smooth(ms)) / (top - 1)
  const angle = ms > 0 ? (Math.atan2(-dy, dx) * 180) / Math.PI : -45
  const autoNum = auto.trim() === '' ? null : Number(auto)

  // Countdown pips, then the engine (pitch follows the multiplier).
  if (countdown !== lastCount.current) {
    if (countdown > 0) sfx.beep()
    else if (flying && lastCount.current > 0) { sfx.beep(true); startRocket() }
    lastCount.current = countdown
  }
  if (flying && !countdown) { startRocket(); rocketPitch(shownMult) }

  return (
    <div className={`felt liftoff liftoff--${s.phase}`}>
      <div className="liftoff__stage">
        <svg className="liftoff__plot" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={flying ? `Climbing, ${shownMult.toFixed(2)} times` : `Last round ${endMult.toFixed(2)} times`}>
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={PAD} x2={W - PAD} y1={PAD + (H - 2 * PAD) * f} y2={PAD + (H - 2 * PAD) * f} className="liftoff__grid" />
          ))}
          {s.phase !== 'idle' && (
            <>
              <polygon points={`${PAD},${H - PAD} ${line} ${tip[0].toFixed(1)},${H - PAD}`} className="liftoff__area" />
              <polyline points={line} className="liftoff__line" />
            </>
          )}
          {/* The craft: a dart with an exhaust plume fixed to its tail. */}
          <g transform={`translate(${tip[0].toFixed(1)} ${tip[1].toFixed(1)}) rotate(${(countdown || s.phase === 'idle' ? -45 : angle).toFixed(1)})`}
            className={`liftoff__craft${s.phase === 'busted' ? ' is-gone' : ''}`}>
            {flying && !countdown && (
              <g className="liftoff__plume">
                <path d="M -6 -3 Q -16 0 -6 3 Z" className="liftoff__flame" />
                <path d="M -6 -1.5 Q -11 0 -6 1.5 Z" className="liftoff__flame-core" />
              </g>
            )}
            <path d="M 9 0 L -7 -5.5 L -4.5 0 L -7 5.5 Z" className="liftoff__hull" />
            <circle cx="1.5" cy="0" r="1.7" className="liftoff__window" />
          </g>
          {s.phase === 'busted' && (
            <g transform={`translate(${tip[0]} ${tip[1]})`} className="liftoff__burst">
              {Array.from({ length: 8 }, (_, k) => (
                <line key={k} x1="0" y1="0" x2={14 * Math.cos((k * Math.PI) / 4)} y2={14 * Math.sin((k * Math.PI) / 4)} />
              ))}
            </g>
          )}
        </svg>
        <div className="liftoff__readout" aria-live="polite">
          {countdown > 0 ? <strong>Launch in {countdown}</strong>
            : <strong className="liftoff__mult">{shownMult.toFixed(2)}×</strong>}
          {s.phase === 'busted' && <span className="liftoff__verdict is-bust">Busted at {endMult.toFixed(2)}×</span>}
          {s.phase === 'cashed' && (
            <span className="liftoff__verdict is-win">
              Cashed {fmt(s.payout)} · it went to {(s.bustAt ?? endMult).toFixed(2)}×
            </span>
          )}
          {flying && !countdown && <span className="faint">{fmt(Math.floor(s.bet * shownMult))} if you bail now</span>}
        </div>
      </div>

      {s.history.length > 0 && (
        <ol className="history" aria-label="Recent busts">
          {s.history.map((m, i) => <li key={i} className={`bust-chip${m >= 2 ? ' is-high' : ''}`}>{m.toFixed(2)}×</li>)}
        </ol>
      )}

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="felt__controls">
        {flying ? (
          <button type="button" className="btn btn--primary liftoff__cash" disabled={busy}
            onClick={() => run({ type: 'cashout' })}>
            {countdown ? `Back out (${fmt(s.bet)})` : `Cash out ${fmt(Math.floor(s.bet * shownMult))}`}
          </button>
        ) : (
          <form className="row" onSubmit={e => { e.preventDefault(); run({ type: 'start', bet, auto: autoNum }) }}>
            <BetInput id="liftoff-bet" value={bet} onChange={setBet} min={CRASH.minBet} max={CRASH.maxBet} />
            <label className="field liftoff__auto">
              <span>Auto cash-out (×, optional)</span>
              <input className="input" type="number" inputMode="decimal" min={1.01} step={0.01} placeholder="e.g. 2.00"
                value={auto} onChange={e => setAuto(e.target.value)} />
            </label>
            <button type="submit" className="btn btn--primary" disabled={busy || (autoNum !== null && !(autoNum >= 1.01))}>
              Launch {fmt(bet || 0)}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
