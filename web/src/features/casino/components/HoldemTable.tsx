// Shared no-limit Hold'em table. Your hole cards come from casino_hands
// (only you can read them); everyone else's stay face down until showdown.

import { useEffect, useState } from 'react'
import { HOLDEM, type HeState } from '../lib/holdem'
import { fmt, useCountdown, useTable } from '../lib/api'
import { BetInput, CardRow } from './PlayingCard'

const STREET: Record<string, string> = {
  waiting: 'Waiting for players', preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown',
}

export default function HoldemTable({ tableId, me, chips }: { tableId: string; me: string; chips: number }) {
  const { state: s, hole, error, busy, send } = useTable<HeState>(tableId, st => st.players.some(p => p.user === me))
  const [buyIn, setBuyIn] = useState(0)
  const [raiseTo, setRaiseTo] = useState(0)
  const left = useCountdown(s?.deadline ?? null)

  const meP = s?.players.find(p => p.user === me)
  const myTurn = !!s && !!meP && s.turn === meP.seat && s.phase !== 'waiting' && s.phase !== 'showdown'
  const minRaiseTo = s ? Math.min(s.currentBet + s.minRaise, (meP?.bet ?? 0) + (meP?.stack ?? 0)) : 0
  useEffect(() => { if (myTurn) setRaiseTo(minRaiseTo) }, [myTurn, minRaiseTo])
  useEffect(() => { if (s && buyIn === 0) setBuyIn(Math.min(s.bb * 100, s.maxBuy)) }, [s, buyIn])

  if (!s) return <p className="faint">Opening the table…</p>

  const toCall = meP ? s.currentBet - meP.bet : 0
  const maxTo = meP ? meP.bet + meP.stack : 0
  const turnName = s.players.find(p => p.seat === s.turn)?.name

  return (
    <div className="felt">
      <div className="felt__top">
        <div>
          <p className="eyebrow">{STREET[s.phase]}{s.handNo ? ` · hand ${s.handNo}` : ''}</p>
          <CardRow cards={s.board} hidden={s.phase === 'waiting' ? 0 : 5 - s.board.length} />
        </div>
        <div className="pot"><span className="faint">Pot</span><strong>{fmt(s.pot)}</strong></div>
      </div>

      <p className="felt__status" aria-live="polite">
        {s.phase === 'waiting' && (s.deadline ? `Dealing in ${left}s` : `Blinds ${fmt(s.sb)}/${fmt(s.bb)} · needs 2 players`)}
        {myTurn && `Your move · ${left}s`}
        {!myTurn && s.turn !== null && `${turnName}'s move · ${left}s`}
        {s.phase === 'showdown' && `Next hand in ${left}s`}
      </p>

      <ul className="seats seats--poker">
        {Array.from({ length: HOLDEM.seats }, (_, i) => {
          const p = s.players.find(q => q.seat === i)
          const cards = p?.user === me && hole ? hole : p?.shown ?? null
          return (
            <li key={i} className={`seat${p?.user === me ? ' is-me' : ''}${p && s.turn === i ? ' is-turn' : ''}${p?.folded && p.inHand ? ' is-folded' : ''}`}>
              {p ? (
                <>
                  <p className="seat__name">
                    {p.name}{s.button === i && s.phase !== 'waiting' && <span className="dealer-btn" title="Dealer button">D</span>}
                  </p>
                  <p className="seat__stack">{fmt(p.stack)}{p.allIn && <span className="tag">all in</span>}</p>
                  {p.inHand && (cards ? <CardRow cards={cards} size="sm" /> : !p.folded && <CardRow cards={[]} hidden={2} size="sm" />)}
                  {p.bet > 0 && <p className="seat__bet">bet {fmt(p.bet)}</p>}
                  {p.handName && <p className="faint">{p.handName}</p>}
                  {p.won > 0 && <p className="seat__won">+{fmt(p.won)}</p>}
                  {!p.inHand && s.phase !== 'waiting' && <p className="faint">Next hand</p>}
                </>
              ) : <p className="faint seat__empty">Open seat</p>}
            </li>
          )
        })}
      </ul>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="felt__controls">
        {!meP && (
          <form className="row" onSubmit={e => { e.preventDefault(); send({ type: 'join', buyIn }) }}>
            <BetInput id={`he-buy-${tableId}`} label={`Buy in (${fmt(s.minBuy)}–${fmt(s.maxBuy)})`}
              value={buyIn} onChange={setBuyIn} min={s.minBuy} max={Math.max(s.minBuy, Math.min(s.maxBuy, chips))} />
            <button type="submit" className="btn btn--primary" disabled={busy || s.players.length >= HOLDEM.seats}>
              {s.players.length >= HOLDEM.seats ? 'Table full' : 'Sit down'}
            </button>
          </form>
        )}
        {myTurn && meP && (
          <div className="stack">
            <div className="row" role="group" aria-label="Your move">
              <button type="button" className="btn btn--danger" disabled={busy} onClick={() => send({ type: 'fold' })}>Fold</button>
              {toCall <= 0
                ? <button type="button" className="btn" disabled={busy} onClick={() => send({ type: 'check' })}>Check</button>
                : <button type="button" className="btn" disabled={busy} onClick={() => send({ type: 'call' })}>Call {fmt(Math.min(toCall, meP.stack))}</button>}
            </div>
            {maxTo > s.currentBet && (
              <form className="row" onSubmit={e => { e.preventDefault(); send({ type: 'raise', to: raiseTo }) }}>
                <label className="field raise-field">
                  <span>{s.currentBet ? 'Raise to' : 'Bet'} {fmt(raiseTo)}</span>
                  <input type="range" min={minRaiseTo} max={maxTo} step={s.sb} value={raiseTo}
                    onChange={e => setRaiseTo(Number(e.target.value))} />
                </label>
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {s.currentBet ? 'Raise' : 'Bet'}
                </button>
                <button type="button" className="btn btn--outline" disabled={busy}
                  onClick={() => send({ type: 'raise', to: maxTo })}>All in</button>
              </form>
            )}
          </div>
        )}
        {meP && (
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => send({ type: 'leave' })}>
            Leave (cash out {fmt(meP.stack)})
          </button>
        )}
      </div>

      {s.log.length > 0 && (
        <ol className="feed" aria-label="Table feed">
          {s.log.slice().reverse().map((l, i) => <li key={i}>{l}</li>)}
        </ol>
      )}
    </div>
  )
}
