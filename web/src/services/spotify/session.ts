import { getAccessToken } from './tokens'

export async function postSessionAuth(spotifyAccessToken: string): Promise<void> {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotifyAccessToken }),
    })
    if (res.ok) {
      const data = await res.json()
      if (typeof data.token === 'string') {
        localStorage.setItem('mheu_session', data.token)
      }
    }
  } catch {
    // Network error — proceed without session JWT
  }
}

// Decode JWT payload (base64url middle segment) without a library.
// Returns null if the token is absent or malformed.
export function decodeSessionPayload(): { spotify_id: string; display_name: string } | null {
  const jwt = localStorage.getItem('mheu_session')
  if (!jwt) return null
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
    const obj = JSON.parse(atob(padded))
    if (typeof obj.spotify_id !== 'string' || typeof obj.display_name !== 'string') return null
    return { spotify_id: obj.spotify_id, display_name: obj.display_name }
  } catch {
    return null
  }
}

// Fire-and-forget POST of full settings to backend. Never throws.
export function postServerSettings(settings: Record<string, unknown>): void {
  const jwt = localStorage.getItem('mheu_session')
  if (!jwt) return
  fetch('/api/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(settings),
  }).catch(() => {/* silently ignore */})
}

export async function fetchUserProfile(): Promise<{ display_name: string; email: string } | null> {
  const token = getAccessToken()
  if (!token) return null

  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.ok) return response.json()
  return null
}
