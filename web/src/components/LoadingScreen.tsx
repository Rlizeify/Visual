import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

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
 * Styled by app/shell/shell.css (.loading*) on the global tokens.
 */

interface Props {
  /** aria-label for the spinner. Defaults to "Loading MHEU". */
  label?: string
}

const AUTO_RECOVER_KEY = 'mheu_auto_recovered_at'
const AUTO_RECOVER_TTL_MS = 2 * 60 * 1000 // 2 minutes

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
  void supabase.auth.signOut().catch(() => { /* may hang or throw — ignored intentionally */ })
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

  // ----- final error state (stage 4 but auto-recovery already tried) -----
  if (stage === 4 && wasRecentAutoRecover) {
    return (
      <div className="loading" role="alert" aria-live="assertive">
        <div className="loading__mark">MHEU</div>
        <div className="loading__help stack">
          <p>We can&apos;t load MHEU right now.</p>
          <p className="muted">
            We already tried clearing your cache and it didn&apos;t help. The problem is likely on our
            end or with your network. Try a different browser.
          </p>
          <button type="button" className="btn btn--block" onClick={hardSignOut}>
            Sign out and return to login
          </button>
        </div>
      </div>
    )
  }

  // ----- normal stages 1-4 (stage 4 here is the auto-trigger banner) -----
  return (
    <div className="loading">
      <div className="loading__mark">MHEU</div>
      <div className="loading__spinner" role="status" aria-label={label} aria-live="polite" />

      {stage >= 2 && stage < 4 && (
        <p className="muted" aria-live="polite">Loading is taking longer than usual…</p>
      )}

      {stage === 3 && (
        <div className="card loading__help stack" aria-live="polite">
          <p>Still loading. If this keeps happening, one of these usually clears it up.</p>
          <RecoveryAction label="Try again" help="Reload the page." onClick={softReload} />
          <RecoveryAction
            label="Clear cache & reload"
            help="Wipe local storage and service workers, then reload. You may need to sign in again."
            onClick={() => { void clearCacheAndReload() }}
          />
          <RecoveryAction label="Sign out & reload" help="End your session and return to sign-in." onClick={hardSignOut} />
        </div>
      )}

      {stage === 4 && !wasRecentAutoRecover && (
        <div className="banner" aria-live="assertive">Cleared cache and reloading — you may need to sign in again.</div>
      )}
    </div>
  )
}

function RecoveryAction({ label, help, onClick }: { label: string; help: string; onClick: () => void }) {
  return (
    <div className="stack recovery">
      <button type="button" className="btn btn--block" onClick={onClick}>{label}</button>
      <p className="faint">{help}</p>
    </div>
  )
}
