import { getAccessToken } from './tokens'
import { pollPlaybackState } from './polling'

export async function play(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 200)
}

export async function pause(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 200)
}

export async function nextTrack(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 500)
}

export async function previousTrack(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 500)
}

export async function toggleShuffle(state: boolean): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 200)
}
