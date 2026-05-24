import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * LoadingScreen — self-healing splash.
 *
 * Stages by elapsed time since mount:
 *   1 (0-5s)    Normal spinner. No UI changes.
 *   2 (5-15s)   Adds an aria-live "taking longer than usual" message.
 *   3 (15-30s)  Adds a help card with three explicit recovery actions:
 *               Try again / Clear cache & reload / Sign out & reload.
 *   4 (30s+)    Auto-triggers Clear cache & reload, shows a banner.
 *
 * Loop protection: stage 4 sets sessionStorage.mheu_auto_recovered_at
 * before reloading. Next boot reads that flag; if it's < 2 minutes old
 * AND the screen reaches stage 3 again, stage 4 is skipped and a
 * final error state appears instead. A successful boot (clean unmount)
 * clears the flag.
 *
 * The screen exists OUTSIDE the theme system — themes haven't mounted
 * yet. Styling uses :root tokens (always present) with hardcoded hex
 * fallbacks, so it renders even when tokens.css fails to load.
 */

interface Props {
  /** aria-label for the spinner. Defaults to "Loading MHEU". */
  label?: string
}

const AUTO_RECOVER_KEY = 'mheu_auto_recovered_at'
const AUTO_RECOVER_TTL_MS = 2 * 60 * 1000 // 2 minutes

// Brand defaults — used as hardcoded fallbacks if tokens.css failed.
const FALLBACK_BG = '#010103'
const FALLBACK_ACCENT = '#00dcc8'
const FALLBACK_ACCENT_DIM = 'rgba(0, 220, 200, 0.6)'
const FALLBACK_ACCENT_BRIGHT = '#00dcc8'
const FALLBACK_ACCENT_GLOW = 'rgba(0, 220, 200, 0.3)'

function isRecentAutoRecovery(): boolean {
  try {
    const raw = sessionStorage.getItem(AUTO_RECOVER_KEY)
    if (!raw) return false
    const ts = parseInt(raw, 10)
    if (!Number.isFinite(ts)) return false
    return Date.now() - ts < AUTO_RECOVER_TTL_MS
  } catch {
    return false
  }
}

function clearAutoRecoveryFlag() {
  try { sessionStorage.removeItem(AUTO_RECOVER_KEY) } catch { /* private mode */ }
}

/**
 * Hard recovery: localStorage + sessionStorage wipe + service-worker
 * unregister + reload. Used by both the manual "Clear cache" button
 * and the stage-4 auto-trigger. Best-effort — every step swallows.
 */
async function clearCacheAndReload(opts: { markAutoRecovered?: boolean } = {}) {
  try { localStorage.clear() } catch { /* private mode */ }
  try { sessionStorage.clear() } catch { /* private mode */ }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister().catch(() => false)))
    }
  } catch { /* not supported / blocked */ }
  // Mark AFTER clearing so sessionStorage.clear above doesn't nuke it.
  if (opts.markAutoRecovered) {
    try { sessionStorage.setItem(AUTO_RECOVER_KEY, String(Date.now())) } catch { /* noop */ }
  }
  window.location.reload()
}

function softReload() {
  window.location.reload()
}

/**
 * Hard sign-out — works even if the Supabase client is broken.
 * Clears all client state, fires a fire-and-forget supabase signOut,
 * then redirects to /login. Never blocks on supabase.
 */
function hardSignOut() {
  void (async () => {
    try {
      const mod = await import('../lib/supabase')
      await mod.supabase.auth.signOut()
    } catch { /* signOut may hang or throw — ignored intentionally */ }
  })()
  try { localStorage.clear() } catch { /* noop */ }
  try { sessionStorage.clear() } catch { /* noop */ }
  window.location.href = '/login'
}

export default function LoadingScreen({ label = 'Loading MHEU' }: Props) {
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1)
  // Snapshot taken on first render — won't change mid-mount.
  const wasRecentAutoRecover = useMemo(() => isRecentAutoRecovery(), [])
  const autoRecoverFiredRef = useRef(false)

  // Stage timers. Each setTimeout fires once; all cleared on unmount.
  // Successful boot clears the auto-recovery flag so the next boot
  // can self-heal again if it sticks.
  useEffect(() => {
    const t1 = window.setTimeout(() => setStage(2), 5000)
    const t2 = window.setTimeout(() => setStage(3), 15000)
    const t3 = window.setTimeout(() => setStage(4), 30000)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      // Boot succeeded if we unmount before location.reload() runs.
      // Stage-4 reload doesn't trigger React cleanup (the whole page
      // tears down before React's effect cleanup runs in practice).
      clearAutoRecoveryFlag()
    }
  }, [])

  // Stage 4 auto-recovery — only if we haven't already tried recently.
  useEffect(() => {
    if (stage !== 4) return
    if (wasRecentAutoRecover) return
    if (autoRecoverFiredRef.current) return
    autoRecoverFiredRef.current = true
    void clearCacheAndReload({ markAutoRecovered: true })
  }, [stage, wasRecentAutoRecover])

  // ----- styles (kept inline so the screen renders even if a CSS
  // stylesheet failed to load) -----
  const containerStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    background: `var(--color-bg, ${FALLBACK_BG})`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    color: `var(--accent-color, ${FALLBACK_ACCENT})`,
    fontFamily: `var(--font-ui, 'HitmarkerText', monospace)`,
    padding: '24px',
    boxSizing: 'border-box',
    overflow: 'auto',
  }

  const wordmarkStyle: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 300,
    letterSpacing: '0.4em',
    textShadow: `0 0 24px var(--accent-color-glow, ${FALLBACK_ACCENT_GLOW})`,
  }

  const spinnerStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    border: `2px solid var(--accent-color-dim, ${FALLBACK_ACCENT_DIM})`,
    borderTopColor: `var(--accent-color-bright, ${FALLBACK_ACCENT_BRIGHT})`,
    borderRadius: '50%',
    animation: 'mheu-spin 0.9s linear infinite',
  }

  // ----- final error state (stage 4 but auto-recovery already tried) -----
  if (stage === 4 && wasRecentAutoRecover) {
    return (
      <div style={containerStyle} role="alert" aria-live="assertive">
        <div style={wordmarkStyle}>MHEU</div>
        <div style={{ maxWidth: '440px', textAlign: 'center', lineHeight: 1.5 }}>
          <div style={{ fontSize: '14px', marginBottom: '12px', color: '#fff' }}>
            We can't load MHEU right now.
          </div>
          <div style={{ fontSize: '12px', opacity: 0.75, marginBottom: '20px' }}>
            We already tried clearing your cache and it didn't help. The
            problem is likely on our end or with your network. Try a
            different browser, or contact support.
          </div>
          <button
            type="button"
            onClick={hardSignOut}
            style={recoveryButtonStyle}
          >
            Sign out and return to login
          </button>
        </div>
        <style>{`@keyframes mheu-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ----- normal stages 1-4 (stage 4 here is the auto-trigger banner) -----
  return (
    <div style={containerStyle}>
      <div style={wordmarkStyle}>MHEU</div>

      <div
        style={spinnerStyle}
        role="status"
        aria-label={label}
        aria-live="polite"
      />

      {/* Stage 2 — subtle, non-alarming message. */}
      {stage >= 2 && stage < 4 && (
        <div
          aria-live="polite"
          style={{
            fontSize: '12px',
            letterSpacing: '0.06em',
            opacity: 0.6,
            color: `var(--accent-color, ${FALLBACK_ACCENT})`,
            transition: 'opacity 0.4s ease',
          }}
        >
          Loading is taking longer than usual...
        </div>
      )}

      {/* Stage 3 — explicit recovery actions. */}
      {stage === 3 && (
        <div
          aria-live="polite"
          style={{
            marginTop: '8px',
            maxWidth: '440px',
            width: '100%',
            padding: '20px',
            background: 'rgba(10, 20, 26, 0.7)',
            border: `1px solid var(--accent-color-border, ${FALLBACK_ACCENT_DIM})`,
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#fff' }}>
            Still loading. If this keeps happening, one of the options
            below usually clears it up.
          </div>

          <RecoveryAction
            label="Try again"
            help="Reload the page and try again."
            onClick={softReload}
          />

          <RecoveryAction
            label="Clear cache & reload"
            help="Wipe local storage and service workers, then reload. You may need to sign in again."
            onClick={() => { void clearCacheAndReload() }}
          />

          <RecoveryAction
            label="Sign out & reload"
            help="End your session and return to the sign-in page."
            onClick={hardSignOut}
          />
        </div>
      )}

      {/* Stage 4 — auto-recovery in flight. */}
      {stage === 4 && !wasRecentAutoRecover && (
        <div
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'rgba(135, 21, 10, 0.92)',
            color: '#fff',
            padding: '10px 16px',
            fontSize: '12px',
            letterSpacing: '0.04em',
            textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}
        >
          Cleared cache and reloading — you may need to sign in again.
        </div>
      )}

      <style>{`@keyframes mheu-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const recoveryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'transparent',
  color: `var(--accent-color, ${FALLBACK_ACCENT})`,
  border: `1px solid var(--accent-color-border, ${FALLBACK_ACCENT_DIM})`,
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  textAlign: 'left',
}

function RecoveryAction({ label, help, onClick }: { label: string; help: string; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <button type="button" onClick={onClick} style={recoveryButtonStyle}>
        {label}
      </button>
      <div style={{ fontSize: '11px', opacity: 0.65, lineHeight: 1.4, paddingLeft: '2px', color: '#fff' }}>
        {help}
      </div>
    </div>
  )
}
