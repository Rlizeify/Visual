/** Spotify Connect — One-click OAuth login button and connected state display. */
import { useState, useEffect } from 'react'

interface Props {
  onConnected: (accessToken: string) => void
}

export default function SpotifyConnect({ onConnected }: Props) {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState('')

  const api = (window as any).api

  useEffect(() => {
    api?.spotifyIsConnected().then(async (c: boolean) => {
      if (c) {
        setConnected(true)
        const profile = await api.spotifyGetUserProfile()
        if (profile) setDisplayName(profile.display_name)
      }
    })
  }, [])

  const handleConnect = async () => {
    setError('')
    setConnecting(true)

    const result = await api?.spotifyConnect()

    setConnecting(false)
    if (result?.success) {
      setConnected(true)
      // Fetch user profile for display name
      const profile = await api?.spotifyGetUserProfile()
      if (profile) setDisplayName(profile.display_name)
      onConnected(result.accessToken)
    } else {
      setError(result?.error ?? 'Connection failed')
    }
  }

  const handleDisconnect = async () => {
    await api?.spotifyDisconnect()
    setConnected(false)
    setDisplayName('')
  }

  if (connected) {
    return (
      <div className="sp-connected">
        <div className="sp-connected__status">
          <span className="sp-connected__dot" />
          <span className="sp-connected__name">
            Connected{displayName ? ` as ${displayName}` : ''}
          </span>
        </div>
        <button className="sp-disconnect-btn" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="sp-connect-wrapper">
      <button
        className="sp-connect-btn"
        onClick={handleConnect}
        disabled={connecting}
      >
        {connecting ? 'Connecting...' : 'Connect to Spotify'}
      </button>
      {error && <span className="sp-connect-error">{error}</span>}
    </div>
  )
}
