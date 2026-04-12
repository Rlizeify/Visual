import { initiateSpotifyLogin } from '../audio/SpotifyWebPlayer'

export default function LoginPage() {
  const handleLogin = () => {
    initiateSpotifyLogin()
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#010103',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <button
        onClick={handleLogin}
        style={{
          background: '#1DB954',
          color: '#fff',
          border: 'none',
          padding: '16px 48px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          borderRadius: '500px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Login with Spotify
      </button>
    </div>
  )
}
