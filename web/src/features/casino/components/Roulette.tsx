// Single-zero roulette. Tap the layout to stack chips, then spin; the
// server draws the pocket and settles every bet at once.

import { useState } from 'react'
import { casino, fmt } from '../lib/api'
import { ROULETTE, payout, pocketColor, type RouletteBet, type RouletteSpot } from '../lib/roulette'
import { BetInput } from './PlayingCard'

type Key = string
const keyOf = (b: RouletteSpot): Key => ('n' in b ? `${b.kind}:${b.n}` : b.kind)

const OUTSIDE: { bet: RouletteSpot; label: string }[] = [
  { bet: { kind: 'low' }, label: '1–18' },
  { bet: { kind: 'even' }, label: 'Even' },
  { bet: { kind: 'red' }, label: 'Red' },
  { bet: { kind: 'black' }, label: 'Black' },
  { bet: { kind: 'odd' }, label: 'Odd' },
  { bet: { kind: 'high' }, label: '19–36' },
  { bet: { kind: 'dozen', n: 1 }, label: '1st 12' },
  { bet: { kind: 'dozen', n: 2 }, label: '2nd 12' },
  { bet: { kind: 'dozen', n: 3 }, label: '3rd 12' },
  { bet: { kind: 'column', n: 1 }, label: 'Col 1' },
  { bet: { kind: 'column', n: 2 }, label: 'Col 2' },
  { bet: { kind: 'column', n: 3 }, label: 'Col 3' },
]

export default function Roulette() {
  const [chip, setChip] = useState(100)
  const [bets, setBets] = useState<Map<Key, RouletteBet>>(new Map())
  const [last, setLast] = useState<{ n: number; staked: number; returned: number } | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const place = (b: RouletteSpot) => {
    if (!Number.isInteger(chip) || chip < ROULETTE.minBet) return
    setBets(prev => {
      const next = new Map(prev)
      const k = keyOf(b)
      const cur = next.get(k)
      next.set(k, { ...b, amount: Math.min((cur?.amount ?? 0) + chip, ROULETTE.maxBet) } as RouletteBet)
      return next
    })
  }
  const staked = [...bets.values()].reduce((s, b) => s + b.amount, 0)

  const doSpin = async () => {
    setBusy(true)
    try {
      const r = await casino<{ n: number; staked: number; returned: number }>('roulette', { bets: [...bets.values()] })
      setLast(r)
      setHistory(h => [r.n, ...h].slice(0, 12))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const amountOn = (b: RouletteSpot) => bets.get(keyOf(b))?.amount
  const won = (b: RouletteBet) => last !== null && payout(b, last.n) > 0

  return (
    <div className="felt">
      <div className="felt__top">
        <div className={`wheel-result wheel-result--${last ? pocketColor(last.n) : 'none'}`} aria-live="polite">
          {last ? last.n : '—'}
        </div>
        <div className="stack roulette-summary">
          {last
            ? <p>{last.returned > last.staked ? `+${fmt(last.returned - last.staked)}` : last.returned === last.staked ? 'Even' : `−${fmt(last.staked - last.returned)}`}</p>
            : <p className="faint">Tap the layout to place chips</p>}
          {history.length > 0 && (
            <ol className="history" aria-label="Recent numbers">
              {history.map((n, i) => <li key={i} className={`pocket-dot pocket-dot--${pocketColor(n)}`}>{n}</li>)}
            </ol>
          )}
        </div>
      </div>

      <div className="layout-scroll">
        <div className="rlayout" role="group" aria-label="Number bets">
          <button type="button" className="pocket pocket--green pocket--zero" onClick={() => place({ kind: 'number', n: 0 })}>
            0{amountOn({ kind: 'number', n: 0 }) && <span className="stake">{fmt(amountOn({ kind: 'number', n: 0 })!)}</span>}
          </button>
          {Array.from({ length: 36 }, (_, i) => {
            const n = i + 1
            const b = { kind: 'number' as const, n }
            const amt = amountOn(b)
            // Columns run along the layout: row = column (3 at top).
            const style = { gridColumn: Math.ceil(n / 3) + 1, gridRow: 4 - (((n - 1) % 3) + 1) }
            return (
              <button key={n} type="button" style={style}
                className={`pocket pocket--${pocketColor(n)}${last?.n === n ? ' is-hit' : ''}`} onClick={() => place(b)}>
                {n}{amt && <span className="stake">{fmt(amt)}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="outside" role="group" aria-label="Outside bets">
        {OUTSIDE.map(o => {
          const amt = amountOn(o.bet)
          const b = bets.get(keyOf(o.bet))
          return (
            <button key={keyOf(o.bet)} type="button" className={`outside__bet${b && won(b) ? ' is-hit' : ''}`} onClick={() => place(o.bet)}>
              {o.label}{amt && <span className="stake">{fmt(amt)}</span>}
            </button>
          )
        })}
      </div>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="felt__controls">
        <BetInput id="roulette-chip" label="Chip" value={chip} onChange={setChip} min={ROULETTE.minBet} max={ROULETTE.maxBet} />
        <div className="row">
          <button type="button" className="btn btn--primary" disabled={busy || bets.size === 0} onClick={doSpin}>
            {busy ? 'Spinning…' : `Spin (${fmt(staked)})`}
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy || bets.size === 0} onClick={() => setBets(new Map())}>Clear</button>
        </div>
      </div>
    </div>
  )
}
