// Shared blackjack table. Everyone seated sees the same felt; the shoe
// count is shared, so every card dealt to one seat is gone for the others.

import { useEffect, useRef, useState } from 'react'
import { BJ, cardValue, handValue, initialBj, isBlackjack, type BjHand, type BjState } from '../lib/blackjack'
import type { Card } from '../lib/cards'
import { fmt, useCountdown, useHoldBalance, useTable } from '../lib/api'
import PlayingCard, { BetInput, CardRow } from './PlayingCard'
import { useStagger, useUntil } from './motion'
import { sfx } from '../lib/sound'

/** Gap between cards in the deal. */
const DEAL_STEP = 480

/**
 * Dealer cards as laid out on the felt: the hole card is dealt first (face
 * down), the up card second. The engine keeps [up, hole, ...draws].
 */
function dealerSlots(s: BjState): (Card | null)[] {
  if (s.holeHidden) return [null, s.dealer[0]]
  if (s.dealer.length < 2) return [...s.dealer]
  return [s.dealer[1], s.dealer[0], ...s.dealer.slice(2)]
}

/** Every card slot in deal order: round by round, seats then dealer. */
function dealOrder(s: BjState, dealer: (Card | null)[]) {
  const items: { key: string; card: Card | null }[] = []
  const longest = Math.max(dealer.length, ...s.seats.flatMap(p => p.hands.map(h => h.cards.length)), 0)
  for (let i = 0; i < longest; i++) {
    for (const p of s.seats) {
      p.hands.forEach((h, k) => { if (i < h.cards.length) items.push({ key: `s${p.seat}h${k}c${i}`, card: h.cards[i] }) })
    }
    if (i < dealer.length) items.push({ key: `d${i}`, card: dealer[i] })
  }
  return items
}

const RESULT: Record<string, string> = {
  blackjack: 'Blackjack', win: 'Win', push: 'Push', lose: 'Lose', bust: 'Bust',
}

function total(cards: readonly string[]) {
  const v = handValue(cards)
  return cards.length === 0 ? '' : `${v.soft && v.total < 21 ? 'soft ' : ''}${v.total}`
}

function HandView({ hand, active, delays, landed }: {
  hand: BjHand; active: boolean; delays: number[]; landed: boolean
}) {
  return (
    <div className={`bj-hand${active ? ' is-active' : ''}`}>
      <CardRow cards={hand.cards} size="sm" delays={delays} />
      <p className="bj-hand__meta">
        <span>{landed ? (isBlackjack(hand) ? 'BJ' : total(hand.cards)) : '…'}</span>
        <span className="faint">{fmt(hand.bet)}{hand.doubled ? ' ×2' : ''}</span>
        {hand.result && landed && <span className={`bj-result bj-result--${hand.result}`}>{RESULT[hand.result]}</span>}
      </p>
    </div>
  )
}

export default function BlackjackTable({ tableId, me }: { tableId: string; me: string }) {
  const { state: s, error, busy, send } = useTable<BjState>(tableId, st => st.seats.some(p => p.user === me), initialBj)
  const [bet, setBet] = useState(100)
  const left = useCountdown(s?.deadline ?? null)
  const hold = useHoldBalance()
  const dealer = s ? dealerSlots(s) : []
  const { delays, end } = useStagger(s ? dealOrder(s, dealer) : [], DEAL_STEP)
  const dealing = useUntil(end)
  // Keep the chip count still until the cards that decide it have landed.
  useEffect(() => { hold(s?.phase === 'settled' ? end : 0) }, [s?.phase, end, hold])
  // Win/lose sting once per round, when the deciding cards have landed.
  const sounded = useRef(-1)
  const mine = s?.seats.find(p => p.user === me)
  useEffect(() => {
    if (!s || s.phase !== 'settled' || dealing || !mine?.hands.length || sounded.current === s.round) return
    sounded.current = s.round
    const net = mine.hands.reduce((t, h) => t + h.payout - h.bet, 0)
    if (net > 0) sfx.win(mine.hands.some(h => h.result === 'blackjack'))
    else if (net < 0) sfx.lose()
  }, [s, dealing, mine])
  if (!s) return <p className="faint">Opening the table…</p>

  // Any move can end the round; hold the balance until the cards land.
  const act = (action: Record<string, unknown>) => {
    if (action.type === 'bet' || action.type === 'double' || action.type === 'split') sfx.chip()
    hold(Date.now() + 8000)
    send(action)
  }

  const seat = s.seats.find(p => p.user === me)
  const myTurn = s.phase === 'playing' && seat && s.turn === seat.seat
  const hand = myTurn ? seat!.hands[seat!.active] : null
  const canDouble = !!hand && hand.cards.length === 2 && !hand.doubled
  const canSplit = !!hand && seat!.hands.length < BJ.maxHands && hand.cards.length === 2
    && cardValue(hand.cards[0]) === cardValue(hand.cards[1])
  const canBet = !!seat && (s.phase === 'settled' || (s.phase === 'betting' && seat.hands.length === 0))
  const turnName = s.seats.find(p => p.seat === s.turn)?.name

  return (
    <div className="felt">
      <div className="felt__top">
        <div>
          <p className="eyebrow">Dealer</p>
          <CardRow cards={dealer} delays={dealer.map((_, i) => delays.get(`d${i}`) ?? 0)} />
          {s.dealer.length > 0 && !s.holeHidden && !dealing && <p className="faint">{total(s.dealer)}</p>}
        </div>
        <div className="shoe" aria-label={`${s.shoeLeft} cards left in the shoe`}>
          <PlayingCard card={null} size="sm" />
          <span><strong>{s.shoeLeft || s.shoeSize}</strong> in shoe</span>
        </div>
      </div>

      <p className="felt__status" aria-live="polite">
        {s.phase === 'betting' && (s.deadline ? `Bets close in ${left}s` : 'Place a bet to start the round')}
        {s.phase !== 'betting' && dealing && 'Dealing…'}
        {s.phase === 'playing' && !dealing && `${myTurn ? 'Your move' : `${turnName}'s move`} · ${left}s`}
        {s.phase === 'settled' && !dealing && `Round ${s.round} settled · next round in ${left}s`}
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
                    : p.hands.map((h, k) => (
                      <HandView key={k} hand={h} active={s.turn === i && p.active === k} landed={!dealing}
                        delays={h.cards.map((_, c) => delays.get(`s${i}h${k}c${c}`) ?? 0)} />
                    ))}
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
        {canBet && !dealing && (
          <form className="row" onSubmit={e => { e.preventDefault(); act({ type: 'bet', amount: bet }) }}>
            <BetInput id={`bj-bet-${tableId}`} value={bet} onChange={setBet} min={BJ.minBet} max={BJ.maxBet} />
            <button type="submit" className="btn btn--primary" disabled={busy}>Bet {fmt(bet || 0)}</button>
          </form>
        )}
        {myTurn && !dealing && (
          <div className="row" role="group" aria-label="Your move">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => act({ type: 'hit' })}>Hit</button>
            <button type="button" className="btn" disabled={busy} onClick={() => act({ type: 'stand' })}>Stand</button>
            {canDouble && <button type="button" className="btn" disabled={busy} onClick={() => act({ type: 'double' })}>Double</button>}
            {canSplit && <button type="button" className="btn" disabled={busy} onClick={() => act({ type: 'split' })}>Split</button>}
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
