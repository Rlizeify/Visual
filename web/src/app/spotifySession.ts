// Spotify link state for the signed-in user.
//
// The shell hydrates the token store once per Supabase user. Only the
// visualizer route waits on it; every other page renders immediately.
// See .claude/memory/decisions/boot-sequence-contract.md for history.
//
//   'idle'       no signed-in user
//   'loading'    setUserAndHydrate in flight
//   'linked'     token row loaded
//   'not-linked' no row
//   'error'      Supabase down or timeout; treated as not-linked

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAuth } from '../context/AuthContext'
import { setUserAndHydrate, subscribe as subscribeTokens, hasTokens } from '../services/spotify/tokenStore'

type SpotifyLink = 'idle' | 'loading' | 'linked' | 'not-linked' | 'error'

let state: SpotifyLink = 'idle'
const listeners = new Set<() => void>()

export function setSpotifyLink(next: SpotifyLink) {
  state = next
  listeners.forEach(l => l())
}

export function useSpotifyLink(): SpotifyLink {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l) } },
    () => state,
    () => 'idle' as SpotifyLink,
  )
}

export const isSpotifyLinked = (s: SpotifyLink) => s === 'linked' && hasTokens()

/** Mounted once in the shell. Returns a banner message, if any. */
export function useSpotifySessionSync(): [string | null, () => void] {
  const { user } = useAuth()
  const [banner, setBanner] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) { setSpotifyLink('idle'); return }
    let cancelled = false
    setSpotifyLink('loading')
    setUserAndHydrate(user.id)
      .then(outcome => { if (!cancelled) setSpotifyLink(outcome) })
      .catch(() => { if (!cancelled) setSpotifyLink('error') })
    return () => { cancelled = true }
  }, [user?.id])

  // Non-blocking persistence errors. On refresh_invalid the visualizer
  // shows its own reconnect pill; this banner covers other pages.
  useEffect(() => subscribeTokens(e => {
    if (e.kind === 'save_failed') {
      setBanner("Spotify tokens couldn't be saved to your account. They'll work for this session, but you may need to reconnect on other devices.")
    } else if (e.kind === 'refresh_invalid') {
      setSpotifyLink('not-linked')
      setBanner('Your Spotify connection expired. Open the Visualizer to reconnect.')
    } else if (e.kind === 'load_failed') {
      setBanner("We couldn't reach Spotify token storage. You may need to reconnect to play music.")
    }
  }), [])

  return [banner, () => setBanner(null)]
}
