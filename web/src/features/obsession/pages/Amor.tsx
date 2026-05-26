// Amor Cantus Avium — the manifesto page reached by clicking the
// hummingbird on the landing. Two-column layout: bird on the left,
// serif body on the right.
//
// The text is the one fixed (non-quote-pool) inscription in the
// Obsession feature. It frames the why of the whole system.

import { useNavigate } from 'react-router-dom'

export default function Amor() {
  const navigate = useNavigate()
  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession')}>← OBSESSION</button>

      <div className="obs-title-sub">[ AMOR // CANTUS AVIUM ]</div>

      <div className="obs-amor">
        <div>
          <img src="/reference/bird-reference.jpg" alt="Hummingbird in flight" />
          <div style={{
            textAlign: 'center',
            marginTop: 16,
            fontFamily: 'var(--ac-font-mono)',
            fontSize: 9,
            letterSpacing: '0.30em',
            color: 'var(--ac-phosphor-dim)',
            textTransform: 'uppercase',
          }}>
            // SIGN-OFF: CHANNEL-OBSESSION //
          </div>
        </div>

        <div className="obs-amor-text">
          <h2>AMOR<br />CANTUS<br />AVIUM</h2>
          <p>
            <em>Love of the birds' song.</em>
          </p>
          <p>
            This room is not for anyone else. There is no leaderboard
            here, no friend feed, no streak to defend in public. The
            only audience is the version of you that already knows
            what you wasted today and the one that will read this
            page tomorrow.
          </p>
          <p>
            The seven-minute lock is the only rule. You are not
            allowed to leave it. You are not allowed to skim. You are
            allowed to write the same sentence seven times if that is
            what is true. The discipline is the discipline.
          </p>
          <p>
            The hummingbird burns through ten times its body weight
            in nectar every day because it cannot afford to stop.
            That is the standard. Not the speed — the
            <em>&nbsp;continuity</em>. The act of living it.
          </p>
          <p>
            Train. Eat. Lift. Write. Then sleep, and do it again.
            The song is the routine. The routine is the song.
          </p>
        </div>
      </div>
    </>
  )
}
