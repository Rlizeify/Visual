import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../context/ProfileContext'
import { supabase } from '../lib/supabase'
import { DEFAULT_THEME_ID, themes } from './registry'
import type { ThemeManifest } from './types'
import ThemeErrorBoundary from './ThemeErrorBoundary'

/**
 * ThemeContext — exposes the active theme manifest and a setter.
 *
 * Initial value is read from `profiles.theme_id` on auth load; if unset
 * or unknown, falls back to DEFAULT_THEME_ID. The setter writes back to
 * Supabase (best-effort, fire-and-forget) and updates local state
 * immediately so the UI swaps without waiting on the network round-trip.
 *
 * Theme persists across sign-out and sign-in because it lives on the
 * profile row, not on local storage. Local storage holds a cached copy
 * to avoid a flash of the wrong theme on first paint.
 */

const STORAGE_KEY = 'mheu_theme_id'

interface ThemeContextValue {
  theme: ThemeManifest
  setTheme: (id: string) => void
  available: ThemeManifest[]
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function resolveTheme(id: string | null | undefined): ThemeManifest {
  if (id && themes[id]) return themes[id]
  return themes[DEFAULT_THEME_ID]
}

function readCached(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

function writeCached(id: string) {
  try { localStorage.setItem(STORAGE_KEY, id) } catch { /* private mode */ }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { profile, patchProfile } = useProfile()
  const [themeId, setThemeId] = useState<string>(() => readCached() ?? DEFAULT_THEME_ID)
  // Themes that have thrown this session. Skipped on theme hydration so a
  // bad profiles.theme_id can't immediately re-lock the user after recovery.
  const blockedThemesRef = useRef<Set<string>>(new Set())
  // Bumped after an error fallback so ThemeErrorBoundary remounts clean.
  const [resetCounter, setResetCounter] = useState(0)

  // Mirror active theme to data-theme attribute on <html> so per-theme
  // tokens.css :root[data-theme='X'] selectors take effect.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = themeId
    }
  }, [themeId])

  // Hydrate the active theme from the cached profile row (no new
  // Supabase query — ProfileContext already fetched theme_id on
  // auth change, U13 dedup).
  useEffect(() => {
    if (!profile) return
    const remoteId = profile.theme_id
    if (remoteId && themes[remoteId] && remoteId !== themeId && !blockedThemesRef.current.has(remoteId)) {
      setThemeId(remoteId)
      writeCached(remoteId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.theme_id])

  const setTheme = useCallback((id: string) => {
    if (!themes[id]) return
    setThemeId(id)
    writeCached(id)
    if (user) {
      // Optimistically patch the cached profile so any other consumer
      // (e.g. dropdown re-open) sees the new theme_id without a
      // round-trip. Then fire the write — UI already swapped locally.
      patchProfile({ theme_id: id })
      supabase
        .from('profiles')
        .update({ theme_id: id })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.warn('[theme] failed to persist theme_id:', error.message)
        })
    }
  }, [user, patchProfile])

  // Session-only fallback when a theme throws during render. Does NOT
  // write to profiles.theme_id — the user keeps their preference and can
  // try again after a fix ships. Bumps resetCounter so the boundary
  // remounts clean once the default theme replaces the broken one.
  const handleThemeError = useCallback((failedId: string) => {
    blockedThemesRef.current.add(failedId)
    writeCached(DEFAULT_THEME_ID)
    setThemeId(DEFAULT_THEME_ID)
    setResetCounter(c => c + 1)
  }, [])

  const value: ThemeContextValue = {
    theme: resolveTheme(themeId),
    setTheme,
    available: Object.values(themes),
  }

  return (
    <ThemeContext.Provider value={value}>
      <ThemeErrorBoundary
        themeId={themeId}
        resetKey={`${themeId}:${resetCounter}`}
        onThemeError={handleThemeError}
      >
        {children}
      </ThemeErrorBoundary>
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
