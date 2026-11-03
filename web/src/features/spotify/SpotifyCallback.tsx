// /callback — Spotify PKCE return. Exchanges the code, links the
// tokens to the signed-in account, then opens the visualizer.
// A Supabase "Continue with Spotify" sign-in also lands here (no
// ?code=); the Supabase client has already consumed its hash.

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { handleCallback } from '../../services/spotify/auth'
import { postSessionAuth } from '../../services/spotify/session'
import { setSpotifyLink } from '../../app/spotifySession'
import LoadingScreen from '../../components/LoadingScreen'

export default function SpotifyCallback() {
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode double-mount: the code is single-use
    ran.current = true
    const params = new URLSearchParams(window.location.search)
    if (!params.has('code') && !params.has('error')) {
      navigate('/m', { replace: true })
      return
    }
    handleCallback().then(async result => {
      if (result.kind === 'ok') {
        await postSessionAuth(result.token)
        setSpotifyLink('linked')
        navigate('/m', { replace: true })
      } else {
        navigate(`/spotify-login?error=${encodeURIComponent(result.reason)}`, { replace: true })
      }
    })
  }, [navigate])

  return <LoadingScreen label="Connecting Spotify" />
}
