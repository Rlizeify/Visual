// Ride the Bus, solo. The deck sits server-side; each call turns one card.

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { casino, fmt, useHoldBalance } from '../lib/api'
import { RTB, initialRtb, type RtbGuess, type RtbState } from '../lib/rideTheBus'
import { BetInput } from './PlayingCard'
import { FLIP_MS, FlipCard, useUntil } from './motion'
import { sfx } from '../lib/sound'

/** Beat between the server's answer and the card turning over. */
const SUSPENSE_MS = 650

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
  const [revealAt, setRevealAt] = useState(0)
  const revealing = useUntil(revealAt)
  const hold = useHoldBalance()

  useEffect(() => {
    supabase.from('casino_tables').select('state').eq('id', `ridethebus:${me}`).maybeSingle()
      .then(({ data }) => setS(data && Object.keys(data.state ?? {}).length ? (data.state as RtbState) : initialRtb()))
  }, [me])

  const go = async (action: Record<string, unknown>) => {
    setBusy(true)
    const flips = action.type === 'guess'
    if (flips) hold(Date.now() + 10_000)
    if (action.type === 'start') sfx.chip()
    try {
      const out = await casino<{ state: RtbState }>('rtb', { action })
      const at = flips ? Date.now() + SUSPENSE_MS + FLIP_MS : 0
      setRevealAt(at)
      hold(at)
      setS(out.state)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Sound for each call once its card is face up.
  const heard = useRef('')
  useEffect(() => {
    if (!s || revealing) return
    const key = `${s.games}:${s.cards.length}:${s.phase}`
    if (heard.current === key || heard.current === '') { heard.current = key; return }
    heard.current = key
    if (s.phase === 'lost') sfx.lose()
    else if (s.phase === 'won') sfx.win(true)
    else if (s.phase === 'cashed') sfx.win()
    else if (s.phase === 'playing' && s.cards.length > 0) sfx.beep(true)
  }, [s, revealing])

  if (!s) return <p className="faint">Loading…</p>
  const playing = s.phase === 'playing'
  const step = STEPS[s.cards.length]
  const nextMult = RTB.multipliers[Math.min(s.cards.length + 1, 4)]

  return (
    <div className="felt">
      <ol className="bus-track" aria-label="Your cards">
        {STEPS.map((_, i) => (
          <li key={`${s.games}-${i}`} className={`bus-stop${playing && i === s.cards.length ? ' is-next' : ''}`}>
            <FlipCard card={s.cards[i] ?? null} dealt={false} delay={SUSPENSE_MS}
              waiting={busy && playing && i === s.cards.length} />
            <span className="faint">×{RTB.multipliers[i + 1]}</span>
          </li>
        ))}
      </ol>

      <p className="felt__status" aria-live="polite">
        {revealing && 'Turning it over…'}
        {!revealing && s.phase === 'idle' && 'Four calls. Cash out after any right one.'}
        {!revealing && playing && `${step.title} — right pays ×${nextMult} on ${fmt(s.bet)}`}
        {!revealing && s.phase === 'lost' && `Wrong call. The ${fmt(s.bet)} stake is gone.`}
        {!revealing && s.phase === 'won' && `Rode the whole bus: +${fmt(s.payout)}`}
        {!revealing && s.phase === 'cashed' && `Cashed out ${fmt(s.payout)}`}
      </p>

      {error && <p className="alert" role="alert">{error}</p>}

      <div className="felt__controls">
        {revealing ? null : playing ? (
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
