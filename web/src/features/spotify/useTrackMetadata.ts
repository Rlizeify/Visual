import { useEffect, useState } from 'react'
import { getMusicData } from '../../services/spotify/polling'

export interface TrackMetadata {
  trackName: string
  artistName: string
  albumArt: string
  isPlaying: boolean
  shuffleState: boolean
}

// Polls the Spotify polling singleton at `intervalMs` and mirrors a subset
// of the music data into React state. The page consumes this for the
// idle-screen logic, track-info card, and playback button states.
export function useTrackMetadata(intervalMs: number = 300): TrackMetadata {
  const [trackName, setTrackName]       = useState('')
  const [artistName, setArtistName]     = useState('')
  const [albumArt, setAlbumArt]         = useState('')
  const [isPlaying, setIsPlaying]       = useState(false)
  const [shuffleState, setShuffleState] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const data = getMusicData()
      setTrackName(data.trackName)
      setArtistName(data.artistName)
      setAlbumArt(data.albumArt)
      setIsPlaying(data.isPlaying)
      setShuffleState(data.shuffleState)
    }, intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])

  return { trackName, artistName, albumArt, isPlaying, shuffleState }
}
