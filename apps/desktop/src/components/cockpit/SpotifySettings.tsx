/** Spotify Settings Panel — Configure Client ID and manage connection. */
import { useState, useEffect } from 'react'

interface Props {
  onClose: () => void
  onConnected: (accessToken: string) => void
}

export default function SpotifySettings({ onClose, onConnected }: Props) {
  const [clientId, setClientId] = useState('')
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const api = (window as any).api

  useEffect(() => {
    api?.spotifyGetClientId().then((id: string | null) => {
      if (id) setClientId(id)
    })
    api?.spotifyIsConnected().then((c: boolean) => setConnected(c))
  }, [])

  const handleConnect = async () => {
    if (!clientId.trim()) {
      setError('Enter a Spotify Client ID')
      return
    }
    setError('')
    setConnecting(true)

    await api?.spotifySetClientId({ clientId: clientId.trim() })
    const result = await api?.spotifyConnect()

    setConnecting(false)
    if (result?.success) {
      setConnected(true)
      onConnected(result.accessToken)
    } else {
      setError(result?.error ?? 'Connection failed')
    }
  }

  const handleDisconnect = async () => {
    await api?.spotifyDisconnect()
    setConnected(false)
  }

  return (
    <div className="sp-settings-overlay" onClick={onClose}>
      <div className="sp-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sp-settings-header">
          <span className="sp-settings-title">SPOTIFY SETTINGS</span>
          <button className="sp-settings-close" onClick={onClose}>×</button>
        </div>

        <div className="sp-settings-body">
          <label className="sp-settings-label">CLIENT ID</label>
          <input
            className="sp-settings-input"
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter Spotify Client ID"
            spellCheck={false}
          />
          <span className="sp-settings-hint">
            Get one from the Spotify Developer Dashboard
          </span>

          <div className="sp-settings-status">
            <span className={`sp-status-dot ${connected ? 'sp-status-dot--on' : ''}`} />
            <span className="sp-status-text">
              {connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          {error && <span className="sp-settings-error">{error}</span>}

          <div className="sp-settings-actions">
            {!connected ? (
              <button
                className="cockpit-btn"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? 'CONNECTING...' : 'CONNECT'}
              </button>
            ) : (
              <button className="cockpit-btn" onClick={handleDisconnect}>
                DISCONNECT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
