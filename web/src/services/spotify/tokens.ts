import { CLIENT_ID } from './auth'

export function getAccessToken(): string | null {
  return localStorage.getItem('mheu_access_token')
}

export function isAuthenticated(): boolean {
  const token = getAccessToken()
  const expiry = localStorage.getItem('mheu_token_expiry')
  if (!token || !expiry) return false
  return Date.now() < parseInt(expiry)
}

export function hasRefreshToken(): boolean {
  return !!localStorage.getItem('mheu_refresh_token')
}

export async function refreshToken(): Promise<string | null> {
  const storedRefresh = localStorage.getItem('mheu_refresh_token')
  if (!storedRefresh) return null

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: storedRefresh,
    }),
  })

  const data = await response.json()
  if (data.access_token) {
    localStorage.setItem('mheu_access_token', data.access_token)
    localStorage.setItem('mheu_token_expiry', String(Date.now() + data.expires_in * 1000))
    if (data.refresh_token) {
      localStorage.setItem('mheu_refresh_token', data.refresh_token)
    }
    return data.access_token
  }
  return null
}

export function clearAuth(): void {
  Object.keys(localStorage)
    .filter(k => k.startsWith('mheu_'))
    .forEach(k => localStorage.removeItem(k))
}
