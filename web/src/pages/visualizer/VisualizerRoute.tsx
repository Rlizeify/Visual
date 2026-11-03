// /m — waits for the Spotify link, then mounts the visualizer. Lazy
// chunk: butterchurn + presets load only here.

import { Navigate } from 'react-router-dom'
import { isSpotifyLinked, useSpotifyLink } from '../../app/spotifySession'
import LoadingScreen from '../../components/LoadingScreen'
import VisualizerPage from '../../features/visualizer/VisualizerPage'

export default function VisualizerRoute() {
  const link = useSpotifyLink()
  if (link === 'idle' || link === 'loading') return <LoadingScreen label="Loading Spotify" />
  if (!isSpotifyLinked(link)) return <Navigate to="/spotify-login" replace />
  return <VisualizerPage />
}
