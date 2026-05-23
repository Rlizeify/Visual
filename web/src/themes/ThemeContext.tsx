import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DEFAULT_THEME_ID, themes } from './registry'
import type { ThemeManifest } from './types'

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
  const [themeId, setThemeId] = useState<string>(() => readCached() ?? DEFAULT_THEME_ID)

  // Mirror active theme to data-theme attribute on <html> so per-theme
  // tokens.css :root[data-theme='X'] selectors take effect.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = themeId
    }
  }, [themeId])

  // On auth-load: hydrate the active theme from profiles.theme_id.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('theme_id')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      const remoteId = (data as { theme_id?: string | null } | null)?.theme_id
      if (remoteId && themes[remoteId] && remoteId !== themeId) {
        setThemeId(remoteId)
        writeCached(remoteId)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const setTheme = useCallback((id: string) => {
    if (!themes[id]) return
    setThemeId(id)
    writeCached(id)
    if (user) {
      // Fire-and-forget: UI already swapped locally.
      supabase
        .from('profiles')
        .update({ theme_id: id })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.warn('[theme] failed to persist theme_id:', error.message)
        })
    }
  }, [user])

  const value: ThemeContextValue = {
    theme: resolveTheme(themeId),
    setTheme,
    available: Object.values(themes),
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
