// Accent toggle: red (default) / teal / purple. A fixed list — there is
// no custom hex and no admin palette.
//
// Storage:
//   - Everyone: localStorage `mheu_accent` (also read by the pre-paint
//     script in index.html, so a reload never flashes the wrong color).
//   - Signed in: profiles.accent_color. On sign-in the profile value
//     wins; if the profile has none, the device value is pushed up.
//
// The DOM side is just <html data-accent="…">; tokens.css does the rest.

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../context/ProfileContext'

export const ACCENTS = ['red', 'teal', 'purple'] as const
type Accent = typeof ACCENTS[number]
const DEFAULT_ACCENT: Accent = 'red'
export const ACCENT_LABELS: Record<Accent, string> = { red: 'Red', teal: 'Teal', purple: 'Purple' }

const STORAGE_KEY = 'mheu_accent'

function isAccent(v: unknown): v is Accent {
  return typeof v === 'string' && (ACCENTS as readonly string[]).includes(v)
}

/** Profile values written before the accent migration were hex. Same
 *  mapping as 20261103000003_accent_enum.sql: purple stays purple,
 *  everything else (incl. the old teal default) becomes red. */
export function normalizeAccent(v: string | null | undefined): Accent | null {
  if (!v) return null
  if (isAccent(v)) return v
  return v.trim().toLowerCase() === '#a855f7' ? 'purple' : 'red'
}

function readStored(): Accent {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isAccent(v) ? v : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

let current: Accent = typeof window === 'undefined' ? DEFAULT_ACCENT : readStored()
const listeners = new Set<() => void>()

function apply(a: Accent) {
  current = a
  document.documentElement.dataset.accent = a
  try { localStorage.setItem(STORAGE_KEY, a) } catch { /* private mode */ }
  listeners.forEach(l => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useAccent(): { accent: Accent; setAccent: (a: Accent) => void } {
  const accent = useSyncExternalStore(subscribe, () => current, () => DEFAULT_ACCENT)
  const { user } = useAuth()
  const { patchProfile } = useProfile()

  const setAccent = useCallback((a: Accent) => {
    apply(a)
    if (!user) return
    patchProfile({ accent_color: a })
    supabase.from('profiles').update({ accent_color: a }).eq('id', user.id)
      .then(({ error }) => { if (error) console.warn('[accent] save failed:', error.message) })
  }, [user, patchProfile])

  return { accent, setAccent }
}

/** Mounted once in the shell: reconciles device and account on sign-in. */
export function useAccentSync(): void {
  const { user } = useAuth()
  const { profile, patchProfile } = useProfile()

  useEffect(() => {
    if (!user || !profile || profile.id !== user.id) return
    const fromProfile = normalizeAccent(profile.accent_color)
    if (fromProfile) {
      if (fromProfile !== current) apply(fromProfile)
      return
    }
    const local = current
    patchProfile({ accent_color: local })
    supabase.from('profiles').update({ accent_color: local }).eq('id', user.id)
      .then(({ error }) => { if (error) console.warn('[accent] push failed:', error.message) })
  }, [user, profile, patchProfile])
}
