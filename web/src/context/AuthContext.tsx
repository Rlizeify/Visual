import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
// Accent application moved to ProfileContext (single source of truth
// for the cached profiles row — U13 boot dedup).

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, username?: string) => Promise<{ error: AuthError | null }>
  signIn: (identifier: string, password: string, isUsername?: boolean) => Promise<{ error: AuthError | null }>
  signInWithSpotify: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Get initial session. Accent paint is now driven by ProfileContext
    // when it fetches the user's row — keeps boot to a single profiles
    // query rather than one-per-consumer (U13).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, username?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: username ? {
        data: { username }
      } : undefined
    })

    // If signup succeeded and we have a username, update the profile
    if (!error && data.user && username) {
      await supabase
        .from('profiles')
        .update({ username })
        .eq('id', data.user.id)
    }

    return { error }
  }

  const signIn = async (identifier: string, password: string, isUsername = false) => {
    // Username sign-in goes through a single server endpoint that does
    // both the username→email resolution and the password check, so the
    // client never sees the email and a probing attacker can't enumerate
    // usernames (every failure returns the same "Invalid credentials").
    if (isUsername) {
      try {
        const res = await fetch('/api/auth?action=signin-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: identifier.toLowerCase(), password }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.access_token || !data.refresh_token) {
          return { error: { message: data.error || 'Invalid credentials', name: 'AuthError', status: res.status || 401 } as AuthError }
        }
        const { error } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })
        return { error }
      } catch {
        return { error: { message: 'Could not reach sign-in service', name: 'AuthError', status: 500 } as AuthError }
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email: identifier, password })
    return { error }
  }

  const signInWithSpotify = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        redirectTo: window.location.origin + '/callback',
        scopes: [
          'user-read-email',
          'user-read-private',
          'playlist-read-private',
          'playlist-read-collaborative',
          'user-read-playback-state',
          'user-modify-playback-state',
          'user-read-currently-playing',
        ].join(' '),
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithSpotify, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
