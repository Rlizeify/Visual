// Single-zero roulette. The layout follows a real table: zero at the head,
// three rows of twelve, "2 to 1" columns at the end, dozens and the
// even-money boxes along the edge (turned upright on phones). Tap to stack
// chips, spin, and the wheel decides — the server picked the pocket before
// the animation starts; the wheel just takes its time getting there.

import { useState, type CSSProperties } from 'react'
import { casino, fmt, useHoldBalance } from '../lib/api'
import { ROULETTE, WHEEL_ORDER, payout, pocketColor, type RouletteBet, type RouletteSpot } from '../lib/roulette'
import { BetInput } from './PlayingCard'
import { useUntil } from './motion'

const SPIN_MS = 5200
const keyOf = (b: RouletteSpot): string => ('n' in b ? `${b.kind}:${b.n}` : b.kind)

interface Cell { spot: RouletteSpot; label: string; cls: string; h: [string, string]; v: [string, string] }

/** Every betting box with its grid place: h = landscape, v = phone. */
const CELLS: Cell[] = (() => {
  const cells: Cell[] = [{
    spot: { kind: 'number', n: 0 }, label: '0', cls: 'pocket--green',
    h: ['1', '1 / span 3'], v: ['3 / span 3', '1'],
  }]
  for (let n = 1; n <= 36; n++) {
    const col = ((n - 1) % 3) + 1 // 1 = row of 1,4,7…
    cells.push({
      spot: { kind: 'number', n }, label: String(n), cls: `pocket--${pocketColor(n)}`,
      h: [String(Math.ceil(n / 3) + 1), String(4 - col)], v: [String(col + 2), String(Math.ceil(n / 3) + 1)],
    })
  }
  for (const c of [1, 2, 3] as const) {
    cells.push({ spot: { kind: 'column', n: c }, label: '2 to 1', cls: 'rbox', h: ['14', String(4 - c)], v: [String(c + 2), '14'] })
  }
  for (const d of [1, 2, 3] as const) {
    const span = `${(d - 1) * 4 + 2} / span 4`
    cells.push({ spot: { kind: 'dozen', n: d }, label: ['1st 12', '2nd 12', '3rd 12'][d - 1], cls: 'rbox rbox--long', h: [span, '4'], v: ['1', span] })
  }
  const even: [RouletteSpot, string, string][] = [
    [{ kind: 'low' }, '1–18', 'rbox'], [{ kind: 'even' }, 'Even', 'rbox'],
    [{ kind: 'red' }, 'Red', 'rbox rbox--red'], [{ kind: 'black' }, 'Black', 'rbox rbox--black'],
    [{ kind: 'odd' }, 'Odd', 'rbox'], [{ kind: 'high' }, '19–36', 'rbox'],
  ]
  even.forEach(([spot, label, cls], k) => {
    const span = `${k * 2 + 2} / span 2`
    cells.push({ spot, label, cls: `${cls} rbox--long`, h: [span, '5'], v: ['2', span] })
  })
  return cells
})()

// ── wheel ─────────────────────────────────────────────
const STEP = 360 / WHEEL_ORDER.length
const R_OUT = 100, R_IN = 70, R_HUB = 40

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180
  return `${(110 + r * Math.cos(a)).toFixed(2)} ${(110 + r * Math.sin(a)).toFixed(2)}`
}

function Wheel({ rotation, ball, spinning }: { rotation: number; ball: number; spinning: boolean }) {
  const t = { transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.55, 0.12, 1)` : 'none' }
  return (
    <svg className="wheel" viewBox="0 0 220 220" role="img" aria-label="Roulette wheel">
      <circle cx="110" cy="110" r="108" className="wheel__rim" />
      <g style={{ ...t, transform: `rotate(${rotation}deg)`, transformOrigin: '110px 110px' }}>
        {WHEEL_ORDER.map((n, i) => {
          const a0 = i * STEP - STEP / 2, a1 = a0 + STEP
          return (
            <g key={n}>
              <path className={`wheel__seg wheel__seg--${pocketColor(n)}`}
                d={`M ${polar(R_OUT, a0)} A ${R_OUT} ${R_OUT} 0 0 1 ${polar(R_OUT, a1)} L ${polar(R_IN, a1)} A ${R_IN} ${R_IN} 0 0 0 ${polar(R_IN, a0)} Z`} />
              <text className="wheel__num" transform={`rotate(${i * STEP} 110 110)`} x="110" y="26" textAnchor="middle">{n}</text>
            </g>
          )
        })}
        <circle cx="110" cy="110" r={R_IN} className="wheel__bowl" />
        {Array.from({ length: 8 }, (_, k) => (
          <line key={k} x1="110" y1="110" x2={polar(R_HUB + 18, k * 45).split(' ')[0]} y2={polar(R_HUB + 18, k * 45).split(' ')[1]} className="wheel__spoke" />
        ))}
        <circle cx="110" cy="110" r={R_HUB / 2} className="wheel__hub" />
      </g>
      <g style={{ ...t, transform: `rotate(${ball}deg)`, transformOrigin: '110px 110px' }}>
        <circle cx="110" cy={110 - R_IN - 7} r="5" className="wheel__ball" />
      </g>
      <path d="M 104 0 L 116 0 L 110 10 Z" className="wheel__pointer" />
    </svg>
  )
}

export default function Roulette() {
  const [chip, setChip] = useState(100)
  const [bets, setBets] = useState<Map<string, RouletteBet>>(new Map())
  const [last, setLast] = useState<{ n: number; staked: number; returned: number } | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const [ball, setBall] = useState(0)
  const [landAt, setLandAt] = useState(0)
  const spinning = useUntil(landAt)
  const hold = useHoldBalance()

  const place = (spot: RouletteSpot) => {
    if (spinning || !Number.isInteger(chip) || chip < ROULETTE.minBet) return
    setBets(prev => {
      const next = new Map(prev)
      const cur = next.get(keyOf(spot))
      next.set(keyOf(spot), { ...spot, amount: Math.min((cur?.amount ?? 0) + chip, ROULETTE.maxBet) } as RouletteBet)
      return next
    })
  }
  const staked = [...bets.values()].reduce((s, b) => s + b.amount, 0)

  const doSpin = async () => {
    setBusy(true)
    hold(Date.now() + SPIN_MS + 4000)
    try {
      const r = await casino<{ n: number; staked: number; returned: number }>('roulette', { bets: [...bets.values()] })
      // Land pocket r.n under the pointer after several turns; the ball
      // runs the other way and drops in at the top.
      const target = (360 - WHEEL_ORDER.indexOf(r.n as (typeof WHEEL_ORDER)[number]) * STEP) % 360
      setRotation(rot => rot + 5 * 360 + ((target - (rot % 360) + 360) % 360))
      setBall(b => b - 8 * 360 - (((b % 360) + 360) % 360))
      const at = Date.now() + SPIN_MS
      setLandAt(at)
      hold(at)
      setLast(r)
      window.setTimeout(() => setHistory(h => [r.n, ...h].slice(0, 12)), SPIN_MS)
      setError(null)
    } catch (e) {
      hold(0)
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const shown = spinning ? null : last
  const won = (spot: RouletteSpot) => shown !== null && payout({ ...spot, amount: 1 } as RouletteBet, shown.n) > 0

  return (
    <div className="felt">
      <div className="felt__top roulette-top">
        <Wheel rotation={rotation} ball={ball} spinning={spinning} />
        <div className="stack roulette-summary" aria-live="polite">
          {spinning && <p>No more bets…</p>}
          {shown && (
            <>
              <p className={`pocket-dot pocket-dot--${pocketColor(shown.n)} pocket-dot--big`}>{shown.n}</p>
              <p className="roulette-net">
                {shown.returned > shown.staked ? `+${fmt(shown.returned - shown.staked)}`
                  : shown.returned === shown.staked ? 'Even' : `−${fmt(shown.staked - shown.returned)}`}
              </p>
            </>
          )}
          {!spinning && !shown && <p className="faint">Tap the table to place chips, then spin.</p>}
          {history.length > 0 && (
            <ol className="history" aria-label="Recent numbers">
              {history.map((n, i) => <li key={i} className={`pocket-dot pocket-dot--${pocketColor(n)}`}>{n}</li>)}
            </ol>
          )}
        </div>
      </div>

      <div className="rtable" role="group" aria-label="Roulette table">
        {CELLS.map(c => {
          const amt = bets.get(keyOf(c.spot))?.amount
          const style = { '--hc': c.h[0], '--hr': c.h[1], '--vc': c.v[0], '--vr': c.v[1] } as CSSProperties
          return (
            <button key={keyOf(c.spot)} type="button" style={style} disabled={spinning}
              className={`rcell ${c.cls.startsWith('pocket') ? `pocket ${c.cls}` : c.cls}${won(c.spot) ? ' is-hit' : ''}`}
              aria-label={`${c.label}${amt ? `, ${fmt(amt)} on it` : ''}`} onClick={() => place(c.spot)}>
              <span className="rcell__label">{c.label}</span>
              {amt && <span className="stake">{fmt(amt)}</span>}
            </button>
          )
        })}
      </div>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="felt__controls">
        <BetInput id="roulette-chip" label="Chip" value={chip} onChange={setChip} min={ROULETTE.minBet} max={ROULETTE.maxBet} />
        <div className="row">
          <button type="button" className="btn btn--primary" disabled={busy || spinning || bets.size === 0} onClick={doSpin}>
            {busy || spinning ? 'Spinning…' : `Spin (${fmt(staked)})`}
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy || spinning || bets.size === 0}
            onClick={() => setBets(new Map())}>Clear</button>
        </div>
      </div>
    </div>
  )
}
