import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

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
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
    let email = identifier

    // If signing in with username, look up the email first via API
    if (isUsername) {
      try {
        const res = await fetch('/api/auth/lookup-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: identifier.toLowerCase() }),
        })
        const data = await res.json()
        if (!res.ok || !data.email) {
          return { error: { message: data.error || 'Username not found', name: 'AuthError', status: 400 } as AuthError }
        }
        email = data.email
      } catch {
        return { error: { message: 'Failed to lookup username', name: 'AuthError', status: 500 } as AuthError }
      }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
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
