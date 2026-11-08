// Shared blackjack table. Everyone seated sees the same felt; the shoe
// count is shared, so every card dealt to one seat is gone for the others.

import { useState } from 'react'
import { BJ, cardValue, handValue, isBlackjack, type BjHand, type BjState } from '../lib/blackjack'
import { fmt, useCountdown, useTable } from '../lib/api'
import PlayingCard, { BetInput, CardRow } from './PlayingCard'

const RESULT: Record<string, string> = {
  blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust',
}

function total(cards: readonly string[]) {
  const v = handValue(cards)
  return cards.length === 0 ? '' : `${v.soft && v.total < 21 ? 'soft ' : ''}${v.total}`
}

function HandView({ hand, active }: { hand: BjHand; active: boolean }) {
  return (
    <div className={`bj-hand${active ? ' is-active' : ''}`}>
      <CardRow cards={hand.cards} size="sm" />
      <p className="bj-hand__meta">
        <span>{isBlackjack(hand) ? 'BJ' : total(hand.cards)}</span>
        <span className="faint">{fmt(hand.bet)}{hand.doubled ? ' ×2' : ''}</span>
        {hand.result && <span className={`bj-result bj-result--${hand.result}`}>{RESULT[hand.result]}</span>}
      </p>
    </div>
  )
}

export default function BlackjackTable({ tableId, me }: { tableId: string; me: string }) {
  const { state: s, error, busy, send } = useTable<BjState>(tableId, st => st.seats.some(p => p.user === me))
  const [bet, setBet] = useState(100)
  const left = useCountdown(s?.deadline ?? null)
  if (!s) return <p className="faint">Opening the table…</p>

  const seat = s.seats.find(p => p.user === me)
  const myTurn = s.phase === 'playing' && seat && s.turn === seat.seat
  const hand = myTurn ? seat!.hands[seat!.active] : null
  const canDouble = !!hand && hand.cards.length === 2 && !hand.doubled
  const canSplit = !!hand && seat!.hands.length === 1 && hand.cards.length === 2
    && cardValue(hand.cards[0]) === cardValue(hand.cards[1])
  const canBet = !!seat && (s.phase === 'settled' || (s.phase === 'betting' && seat.hands.length === 0))
  const turnName = s.seats.find(p => p.seat === s.turn)?.name

  return (
    <div className="felt">
      <div className="felt__top">
        <div>
          <p className="eyebrow">Dealer</p>
          <CardRow cards={s.dealer} hidden={s.holeHidden ? 1 : 0} />
          {s.dealer.length > 0 && !s.holeHidden && <p className="faint">{total(s.dealer)}</p>}
        </div>
        <div className="shoe" aria-label={`${s.shoeLeft} cards left in the shoe`}>
          <PlayingCard card={null} size="sm" />
          <span><strong>{s.shoeLeft || s.shoeSize}</strong> in shoe</span>
        </div>
      </div>

      <p className="felt__status" aria-live="polite">
        {s.phase === 'betting' && (s.deadline ? `Bets close in ${left}s` : 'Place a bet to start the round')}
        {s.phase === 'playing' && `${myTurn ? 'Your move' : `${turnName}'s move`} · ${left}s`}
        {s.phase === 'settled' && `Round ${s.round} settled · next round in ${left}s`}
      </p>

      <ul className="seats">
        {Array.from({ length: BJ.seats }, (_, i) => {
          const p = s.seats.find(q => q.seat === i)
          return (
            <li key={i} className={`seat${p?.user === me ? ' is-me' : ''}${p && s.turn === i ? ' is-turn' : ''}`}>
              {p ? (
                <>
                  <p className="seat__name">{p.name}{p.user === me ? ' (you)' : ''}</p>
                  {p.hands.length === 0
                    ? <p className="faint">{s.phase === 'playing' ? 'Sitting out' : 'No bet yet'}</p>
                    : p.hands.map((h, k) => <HandView key={k} hand={h} active={s.turn === i && p.active === k} />)}
                </>
              ) : <p className="faint seat__empty">Open seat</p>}
            </li>
          )
        })}
      </ul>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="felt__controls">
        {!seat && (
          <button type="button" className="btn btn--primary" disabled={busy || s.seats.length >= BJ.seats}
            onClick={() => send({ type: 'join' })}>
            {s.seats.length >= BJ.seats ? 'Table full' : 'Sit down'}
          </button>
        )}
        {canBet && (
          <form className="row" onSubmit={e => { e.preventDefault(); send({ type: 'bet', amount: bet }) }}>
            <BetInput id={`bj-bet-${tableId}`} value={bet} onChange={setBet} min={BJ.minBet} max={BJ.maxBet} />
            <button type="submit" className="btn btn--primary" disabled={busy}>Bet {fmt(bet || 0)}</button>
          </form>
        )}
        {myTurn && (
          <div className="row" role="group" aria-label="Your move">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => send({ type: 'hit' })}>Hit</button>
            <button type="button" className="btn" disabled={busy} onClick={() => send({ type: 'stand' })}>Stand</button>
            {canDouble && <button type="button" className="btn" disabled={busy} onClick={() => send({ type: 'double' })}>Double</button>}
            {canSplit && <button type="button" className="btn" disabled={busy} onClick={() => send({ type: 'split' })}>Split</button>}
          </div>
        )}
        {seat && (
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => send({ type: 'leave' })}>Leave table</button>
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
