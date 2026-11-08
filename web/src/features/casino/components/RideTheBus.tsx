// Ride the Bus, solo. The deck sits server-side; each call turns one card.

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { casino, fmt } from '../lib/api'
import { RTB, initialRtb, type RtbGuess, type RtbState } from '../lib/rideTheBus'
import PlayingCard, { BetInput } from './PlayingCard'

const STEPS: { title: string; options: { g: RtbGuess; label: string }[] }[] = [
  { title: 'Red or black?', options: [{ g: 'red', label: 'Red' }, { g: 'black', label: 'Black' }] },
  { title: 'Higher or lower?', options: [{ g: 'higher', label: 'Higher' }, { g: 'lower', label: 'Lower' }] },
  { title: 'Inside or outside?', options: [{ g: 'inside', label: 'Inside' }, { g: 'outside', label: 'Outside' }] },
  { title: 'Which suit?', options: [{ g: 's', label: '♠ Spades' }, { g: 'h', label: '♥ Hearts' }, { g: 'd', label: '♦ Diamonds' }, { g: 'c', label: '♣ Clubs' }] },
]

export default function RideTheBus({ me }: { me: string }) {
  const [s, setS] = useState<RtbState | null>(null)
  const [bet, setBet] = useState(100)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('casino_tables').select('state').eq('id', `ridethebus:${me}`).maybeSingle()
      .then(({ data }) => setS(data && Object.keys(data.state ?? {}).length ? (data.state as RtbState) : initialRtb()))
  }, [me])

  const go = async (action: Record<string, unknown>) => {
    setBusy(true)
    try {
      const out = await casino<{ state: RtbState }>('rtb', { action })
      setS(out.state)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!s) return <p className="faint">Loading…</p>
  const playing = s.phase === 'playing'
  const step = STEPS[s.cards.length]
  const nextMult = RTB.multipliers[Math.min(s.cards.length + 1, 4)]

  return (
    <div className="felt">
      <ol className="bus-track" aria-label="Your cards">
        {STEPS.map((_, i) => (
          <li key={i} className={`bus-stop${playing && i === s.cards.length ? ' is-next' : ''}`}>
            <PlayingCard card={s.cards[i] ?? null} />
            <span className="faint">×{RTB.multipliers[i + 1]}</span>
          </li>
        ))}
      </ol>

      <p className="felt__status" aria-live="polite">
        {s.phase === 'idle' && 'Four calls. Cash out after any right one.'}
        {playing && `${step.title} — right pays ×${nextMult} on ${fmt(s.bet)}`}
        {s.phase === 'lost' && `Wrong call. The ${fmt(s.bet)} stake is gone.`}
        {s.phase === 'won' && `Rode the whole bus: +${fmt(s.payout)}`}
        {s.phase === 'cashed' && `Cashed out ${fmt(s.payout)}`}
      </p>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="felt__controls">
        {playing ? (
          <>
            <div className="row" role="group" aria-label={step.title}>
              {step.options.map(o => (
                <button key={o.g} type="button" className="btn btn--primary" disabled={busy}
                  onClick={() => go({ type: 'guess', guess: o.g })}>{o.label}</button>
              ))}
            </div>
            {s.cards.length > 0 && (
              <button type="button" className="btn btn--outline" disabled={busy} onClick={() => go({ type: 'cashout' })}>
                Cash out {fmt(s.bet * RTB.multipliers[s.cards.length])}
              </button>
            )}
          </>
        ) : (
          <form className="row" onSubmit={e => { e.preventDefault(); go({ type: 'start', bet }) }}>
            <BetInput id="rtb-bet" value={bet} onChange={setBet} min={RTB.minBet} max={RTB.maxBet} />
            <button type="submit" className="btn btn--primary" disabled={busy}>Ride for {fmt(bet || 0)}</button>
          </form>
        )}
      </div>
    </div>
  )
}
