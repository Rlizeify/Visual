// Amor Cantus Avium — the manifesto page reached by clicking the
// hummingbird on the landing. Two-column layout: bird on the left,
// serif body on the right.
//
// MANIFESTO TEXT: lives in `web/public/manifesto.md`. Stone can edit
// that file directly without touching this component — changes take
// effect after the next Vercel deploy (commit + push). Format:
//   - `# Heading` line becomes the <h2>
//   - A line wrapped entirely in `*...*` becomes the italic subtitle
//   - All other non-empty lines become paragraphs
//   - Inline `*word*` within a paragraph renders as <em>
//
// The fetch is cached in module scope for the session — switching to
// /obsession/amor and back does not refetch.

import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface ParsedManifesto {
  header: string
  subtitle: string
  paragraphs: string[]
}

let cachedManifesto: ParsedManifesto | null = null
let pendingFetch: Promise<ParsedManifesto> | null = null

function parseManifesto(md: string): ParsedManifesto {
  const lines = md.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let header = ''
  let subtitle = ''
  const paragraphs: string[] = []
  for (const line of lines) {
    if (!header && line.startsWith('# ')) {
      header = line.slice(2).trim()
      continue
    }
    if (!subtitle && /^\*[^*]+\*$/.test(line)) {
      subtitle = line
      continue
    }
    paragraphs.push(line)
  }
  return { header, subtitle, paragraphs }
}

async function loadManifesto(): Promise<ParsedManifesto> {
  if (cachedManifesto) return cachedManifesto
  if (pendingFetch) return pendingFetch
  pendingFetch = (async () => {
    const res = await fetch('/manifesto.md', { cache: 'no-cache' })
    if (!res.ok) throw new Error(`manifesto fetch failed: ${res.status}`)
    const md = await res.text()
    const parsed = parseManifesto(md)
    cachedManifesto = parsed
    return parsed
  })()
  try {
    return await pendingFetch
  } finally {
    pendingFetch = null
  }
}

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

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: ParsedManifesto }
  | { status: 'error' }

export default function Amor() {
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>(() =>
    cachedManifesto ? { status: 'ready', data: cachedManifesto } : { status: 'loading' },
  )

  useEffect(() => {
    if (state.status !== 'loading') return
    let cancelled = false
    loadManifesto()
      .then(data => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch(err => {
        console.error('[amor] manifesto load failed:', err)
        if (!cancelled) setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [state.status])

  return (
    <>
      <button className="obs-back" onClick={() => navigate('/obsession')}>← OBSESSION</button>

      <div className="obs-title-sub">[ AMOR // CANTUS AVIUM ]</div>

      <div className="obs-amor">
        <div>
          {/* Until Stone re-exports a PNG-24 with alpha channel, use the
              JPG that actually ships in public/reference/. The .png path
              404'd in production. */}
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
          {state.status === 'loading' ? (
            <p style={{
              fontFamily: 'var(--ac-font-mono)',
              fontSize: 11,
              letterSpacing: '0.25em',
              color: 'var(--ac-phosphor-dim)',
              textTransform: 'uppercase',
            }}>
              [ LOADING MANIFESTO ]
            </p>
          ) : null}

          {state.status === 'error' ? (
            <p style={{
              fontFamily: 'var(--ac-font-mono)',
              fontSize: 11,
              letterSpacing: '0.25em',
              color: 'var(--ac-phosphor-dim)',
              textTransform: 'uppercase',
            }}>
              [ MANIFESTO UNAVAILABLE — CHECK /manifesto.md ]
            </p>
          ) : null}

          {state.status === 'ready' ? (
            <>
              <h2>
                {state.data.header.split(/\s+/).map((word, i, arr) => (
                  <Fragment key={i}>
                    {word}
                    {i < arr.length - 1 ? <br /> : null}
                  </Fragment>
                ))}
              </h2>
              {state.data.subtitle ? <p>{renderEmphasis(state.data.subtitle)}</p> : null}
              {state.data.paragraphs.map((para, i) => (
                <p key={i}>{renderEmphasis(para)}</p>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </>
  )
}
