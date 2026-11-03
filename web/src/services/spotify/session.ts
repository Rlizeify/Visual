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
