// /casino — play-money tables for every signed-in account.
//
// Chips live in casino_wallets (50,000 to start; fund members start at 0 and
// can bring their fund share over, which resets their chips to it, once per
// newer ledger row). Out of chips: ask the house (super admins approve in
// Admin → Chips). Moves go through /api/casino, which deals server-side;
// shared tables sync over Realtime. Chips are never worth anything.

import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { HoldBalance, casino, fmt, loadRequests, requestChips, useWallet, type ChipRequest } from './lib/api'
import BlackjackTable from './components/BlackjackTable'
import HoldemTable from './components/HoldemTable'
import RideTheBus from './components/RideTheBus'
import Roulette from './components/Roulette'
import Liftoff from './components/Liftoff'
import { isMuted, onMuted, setMuted } from './lib/sound'
import './casino.css'

const GAMES = [
  { id: 'blackjack', label: 'Blackjack', tables: [{ id: 'bj-1', label: 'North' }, { id: 'bj-2', label: 'South' }] },
  { id: 'bus', label: 'Ride the Bus', tables: [] },
  { id: 'roulette', label: 'Roulette', tables: [] },
  { id: 'liftoff', label: 'Liftoff', tables: [] },
  { id: 'holdem', label: 'Hold’em', tables: [{ id: 'holdem-1', label: '50/100' }, { id: 'holdem-2', label: '250/500' }] },
] as const

type GameId = (typeof GAMES)[number]['id']

function FundPull({ fund, onDone }: { fund: NonNullable<ReturnType<typeof useWallet>['wallet']>['fund']; onDone: (chips: number) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!fund) return null
  const pull = async () => {
    if (!confirm(`Set your chips to your fund share (${fmt(fund.share)})? Whatever you have now is replaced.`)) return
    setBusy(true)
    try {
      const out = await casino<{ chips: number }>('fund-pull')
      onDone(out.chips)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card casino-fund" aria-labelledby="fund-pull-h">
      <h2 id="fund-pull-h">Take the fund to the casino</h2>
      <p className="muted">
        Your share is <strong>{fmt(fund.share)}</strong>. Pulling it resets your chips to that number.
        It isn’t linked to the ledger afterwards, and you can pull again once a newer fund row is added.
      </p>
      {error && <p className="alert" role="alert">{error}</p>}
      <button type="button" className="btn btn--primary" disabled={busy || !fund.canPull} onClick={pull}>
        {fund.canPull ? `Pull ${fmt(fund.share)} chips` : 'Pulled — wait for the next fund row'}
      </button>
    </section>
  )
}

function AskForChips() {
  const [requests, setRequests] = useState<ChipRequest[]>([])
  const [amount, setAmount] = useState(50000)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const refresh = () => { loadRequests().then(setRequests, () => {}) }
  useEffect(refresh, [])
  const pending = requests.find(r => r.status === 'pending')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await requestChips(amount, note)
      setMsg({ ok: true, text: 'Sent. Stone will see it in the admin console.' })
      setNote('')
      refresh()
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="card casino-ask">
      <summary>Ask the house for more chips</summary>
      {pending ? (
        <p className="muted">Your request for {fmt(pending.amount)} chips is waiting for an answer.</p>
      ) : (
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>Chips</span>
            <input className="input" type="number" inputMode="numeric" min={1} max={10000000} value={amount}
              onChange={e => setAmount(Math.floor(Number(e.target.value)))} required />
          </label>
          <label className="field">
            <span>Note (optional)</span>
            <input className="input" maxLength={200} value={note} onChange={e => setNote(e.target.value)} />
          </label>
          <button type="submit" className="btn btn--primary" disabled={busy || !(amount > 0)}>Send request</button>
        </form>
      )}
      {msg && <p className={`alert${msg.ok ? ' alert--ok' : ''}`} role="status">{msg.text}</p>}
      {requests.filter(r => r.status !== 'pending').slice(0, 3).map(r => (
        <p key={r.id} className="faint">
          {new Date(r.created_at).toLocaleDateString()}: {fmt(r.amount)} — {r.status === 'approved' ? `approved (${fmt(r.granted ?? 0)})` : 'denied'}
        </p>
      ))}
    </details>
  )
}

function SoundToggle() {
  const [muted, set] = useState(isMuted())
  useEffect(() => onMuted(set), [])
  return (
    <button type="button" className="btn btn--ghost btn--sm" aria-pressed={!muted} onClick={() => setMuted(!muted)}>
      {muted ? 'Sound off' : 'Sound on'}
    </button>
  )
}

export default function CasinoPage() {
  const { user } = useAuth()
  const { wallet, error, setWallet, hold } = useWallet()
  const [params, setParams] = useSearchParams()
  const game = (GAMES.find(g => g.id === params.get('game'))?.id ?? 'blackjack') as GameId
  const def = GAMES.find(g => g.id === game)!
  const table = def.tables.find(t => t.id === params.get('table'))?.id ?? def.tables[0]?.id
  const me = user?.id ?? ''

  const pick = (g: GameId, t?: string) => setParams(t ? { game: g, table: t } : { game: g }, { replace: true })

  return (
    <main className="casino">
      <div className="casino-shell">
        <header className="casino-head">
          <div>
            <p className="eyebrow">Play money · no cash value</p>
            <h1>Casino</h1>
          </div>
          <SoundToggle />
          <div className="casino-balance" aria-live="polite">
            <span className="faint">Your chips</span>
            <strong>{wallet ? fmt(wallet.chips) : '—'}</strong>
          </div>
        </header>

        {error && <p className="alert" role="alert">{error}</p>}
        {wallet?.fund && <FundPull fund={wallet.fund} onDone={chips => setWallet(w => (w ? { ...w, chips, fund: w.fund && { ...w.fund, canPull: false } } : w))} />}

        <nav className="casino-tabs" role="tablist" aria-label="Games">
          {GAMES.map(g => (
            <button key={g.id} type="button" role="tab" aria-selected={g.id === game} className="casino-tab"
              onClick={() => pick(g.id)}>{g.label}</button>
          ))}
        </nav>

        {def.tables.length > 0 && (
          <div className="row table-pick" role="group" aria-label="Tables">
            {def.tables.map(t => (
              <button key={t.id} type="button" className={`chip-btn${t.id === table ? ' is-on' : ''}`}
                aria-pressed={t.id === table} onClick={() => pick(game, t.id)}>{t.label}</button>
            ))}
          </div>
        )}

        <HoldBalance.Provider value={hold}>
        <section role="tabpanel" aria-label={def.label}>
          {!me ? null
            : game === 'blackjack' ? <BlackjackTable key={table} tableId={table!} me={me} />
            : game === 'holdem' ? <HoldemTable key={table} tableId={table!} me={me} chips={wallet?.chips ?? 0} />
            : game === 'bus' ? <RideTheBus me={me} />
            : game === 'liftoff' ? <Liftoff me={me} />
            : <Roulette />}
        </section>
        </HoldBalance.Provider>

        <AskForChips />
      </div>
    </main>
  )
}
