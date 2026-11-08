// Fund song unlock: the Fund tab is listed only while the signed-in
// user's Spotify is playing one of public.fund_unlock_songs.
//
// Step one of the Fund sign-in, checked in the browser. It opens the door;
// it is not the lock. The lock is the 'fund' grant (RLS has_feature) plus
// the later server-checked steps.
//
//   'off'       no grant, no Spotify link, or no unlock song playing
//   'checking'  waiting on the song list or the first Spotify poll
//   'on'        an unlock song is playing right now

import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../context/ProfileContext'
import { supabase } from '../lib/supabase'
import { getMusicData, startPolling, stopPolling } from '../services/spotify/polling'
import { isSpotifyLinked, useSpotifyLink } from './spotifySession'

export type SongUnlock = 'off' | 'checking' | 'on'

export interface UnlockSong { title: string; artist: string }

// Give up on 'checking' after this long (Spotify unreachable).
const CHECK_TIMEOUT_MS = 10_000

// `user` is whose grant the status was worked out for. The Gate treats an
// answer for anyone else (or for nobody yet) as still checking, so a
// direct load of the page isn't bounced before the first real check.
interface Snapshot { status: SongUnlock; user: string | null }

const OFF: Snapshot = { status: 'off', user: null }
let state: Snapshot = OFF
const listeners = new Set<() => void>()

function setState(status: SongUnlock, user: string | null = null) {
  if (status === state.status && user === state.user) return
  state = { status, user }
  listeners.forEach(l => l())
}

function useSnapshot(): Snapshot {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l) } },
    () => state,
    () => OFF,
  )
}

export function useSongUnlock(): SongUnlock {
  return useSnapshot().status
}

/** Status as worked out for this user ('checking' until it has been). */
export function useSongUnlockFor(userId: string | undefined): SongUnlock {
  const s = useSnapshot()
  return userId && s.user === userId ? s.status : 'checking'
}

// Lowercase, drop accents, "(feat. …)", "[…]", " - Remastered" style
// suffixes and everything that isn't a letter or digit.
function normalize(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\bfeat\.?\b.*$|\bft\.?\b.*$/, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

/** Fuzzy title + artist match against the unlock list. */
export function matchesUnlockSong(title: string, artists: readonly string[], songs: readonly UnlockSong[]): boolean {
  const t = normalize(title)
  if (!t) return false
  const as = artists.map(normalize).filter(Boolean)
  return songs.some(s => {
    const st = normalize(s.title)
    const sa = normalize(s.artist)
    return (t === st || t.startsWith(st) || st.startsWith(t) && t.length >= 4)
      && as.some(a => a.includes(sa) || sa.includes(a))
  })
}

/** Mounted once in the shell. Polls Spotify only for 'fund' accounts. */
export function useSongUnlockSync(): void {
  const { user } = useAuth()
  const { profile, features } = useProfile()
  const link = useSpotifyLink()
  const eligible = !!user && !!profile && profile.id === user.id && features.has('fund')
  const linked = isSpotifyLinked(link)
  const userId = user?.id

  useEffect(() => {
    if (!eligible || !userId) { setState('off'); return }
    const uid = userId
    if (link === 'loading') { setState('checking', uid); return }
    if (!linked) { setState('off', uid); return }

    setState('checking', uid)
    let cancelled = false
    let polling = false
    let timer: ReturnType<typeof setInterval> | undefined
    const since = performance.now()

    supabase.from('fund_unlock_songs').select('title, artist').then(({ data, error }) => {
      if (cancelled) return
      const songs = (data ?? []) as UnlockSong[]
      if (error || songs.length === 0) { setState('off', uid); return }
      startPolling()
      polling = true
      const tick = () => {
        const m = getMusicData()
        if (m.pollTimestamp < since) {
          if (performance.now() - since > CHECK_TIMEOUT_MS) setState('off', uid)
          return
        }
        setState(m.isPlaying && matchesUnlockSong(m.trackName, m.artistNames, songs) ? 'on' : 'off', uid)
      }
      tick()
      timer = setInterval(tick, 1000)
    })

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      if (polling) stopPolling()
    }
  }, [eligible, link, linked, userId])
}
