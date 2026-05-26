// Amor Cantus Avium — the manifesto page reached by clicking the
// hummingbird on the landing. Two-column layout: bird on the left,
// serif body on the right.
//
// The text is the one fixed (non-quote-pool) inscription in the
// Obsession feature. It frames the why of the whole system.

import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'

// TODO: Stone is providing final manifesto text. Current content is
// placeholder. Edit the three constants below; *word* markers render
// as <em>word</em> (italic + amber) via renderEmphasis().
const MANIFESTO_HEADER = 'AMOR\nCANTUS\nAVIUM'
const MANIFESTO_SUBTITLE = "*Love of the birds' song.*"
const MANIFESTO_PARAGRAPHS: string[] = [
  'This room is not for anyone else. There is no leaderboard here, no friend feed, no streak to defend in public. The only audience is the version of you that already knows what you wasted today and the one that will read this page tomorrow.',
  'The seven-minute lock is the only rule. You are not allowed to leave it. You are not allowed to skim. You are allowed to write the same sentence seven times if that is what is true. The discipline is the discipline.',
  'The hummingbird burns through ten times its body weight in nectar every day because it cannot afford to stop. That is the standard. Not the speed — the *continuity*. The act of living it.',
  'Train. Eat. Lift. Write. Then sleep, and do it again. The song is the routine. The routine is the song.',
]

// Render inline *emphasis* — splits on the *...* marker (non-greedy,
// no nesting) and wraps matched segments in <em>. Even-index chunks
// are plain text, odd-index chunks are emphasized.
function renderEmphasis(text: string) {
  const parts = text.split(/\*([^*]+)\*/g)
  return parts.map((chunk, i) =>
    i % 2 === 1
      ? <em key={i}>{chunk}</em>
      : <Fragment key={i}>{chunk}</Fragment>,
  )
}

export default function Amor() {
  const navigate = useNavigate()
  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession')}>← OBSESSION</button>

      <div className="obs-title-sub">[ AMOR // CANTUS AVIUM ]</div>

      <div className="obs-amor">
        <div>
          {/* TODO: re-exported PNG with alpha channel required at
              web/public/reference/bird-reference.png — current JPG has
              flattened transparency baked in. */}
          <img src="/reference/bird-reference.png" alt="Hummingbird in flight" />
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
          <h2>
            {MANIFESTO_HEADER.split('\n').map((line, i, arr) => (
              <Fragment key={i}>
                {line}
                {i < arr.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </h2>
          <p>{renderEmphasis(MANIFESTO_SUBTITLE)}</p>
          {MANIFESTO_PARAGRAPHS.map((para, i) => (
            <p key={i}>{renderEmphasis(para)}</p>
          ))}
        </div>
      </div>
    </>
  )
}
