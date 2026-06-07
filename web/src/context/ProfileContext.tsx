// Centralized profile row cache.
//
// Boot path previously fired one `profiles?select=...` query per
// consumer (AuthContext for accent, ThemeContext for theme_id, NavBar
// for avatar/username/accent). U13 audit caught 5+ duplicate queries
// on a single /m load. This context fetches the columns we actually
// need ONCE per auth-id change and exposes them to every consumer.
//
// Writers (theme switcher, avatar upload, accent picker) call
// `patchProfile()` to merge their successful write into the cached
// row so downstream consumers see the new value without refetching.
//
// Deliberately narrow column set: only the columns the BOOT PATH
// reads. On-demand surfaces like ProfileDropdown still fetch their
// own extra columns (display_name, etc.) — that fetch is gated on
// dropdown open and not in the boot critical path.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { applyAccentColor } from '../lib/accentColor'

export interface BootProfile {
  id: string
  username: string | null
  avatar_url: string | null
  accent_color: string | null
  theme_id: string | null
}

interface ProfileContextValue {
  profile: BootProfile | null
  loading: boolean
  /** Merge a successful local write into the cached row. No network. */
  patchProfile: (patch: Partial<BootProfile>) => void
  /** Force re-fetch (used after a write that couldn't optimistically patch). */
  refresh: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

const SELECT_COLS = 'id, username, avatar_url, accent_color, theme_id'

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<BootProfile | null>(null)
  const [loading, setLoading] = useState(false)
  // Track the user id whose profile is in `profile`. Guards against
  // stale writes if the auth user changes while a fetch is in flight.
  const lastFetchedFor = useRef<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select(SELECT_COLS)
      .eq('id', userId)
      .maybeSingle()
    if (lastFetchedFor.current !== userId) return // user changed mid-flight
    if (error) {
      console.warn('[profile] fetch failed:', error.message)
      setProfile(null)
    } else if (data) {
      setProfile(data as BootProfile)
      // Apply accent here so AuthContext doesn't need its own profile
      // query just to paint the accent (removed from AuthContext).
      const hex = (data as BootProfile).accent_color
      if (hex) applyAccentColor(hex)
    } else {
      setProfile(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user) {
      lastFetchedFor.current = null
      setProfile(null)
      return
    }
    lastFetchedFor.current = user.id
    void fetchProfile(user.id)
  }, [user?.id, fetchProfile])

  const patchProfile = useCallback((patch: Partial<BootProfile>) => {
    setProfile(p => (p ? { ...p, ...patch } : p))
  }, [])

  const refresh = useCallback(async () => {
    if (!user) return
    await fetchProfile(user.id)
  }, [user, fetchProfile])

  return (
    <ProfileContext.Provider value={{ profile, loading, patchProfile, refresh }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>')
  return ctx
}
