// Account menu under the nav avatar: avatar upload, accent, Spotify
// link, sign out. Reads/writes only profiles + the avatars bucket.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../context/ProfileContext'
import { supabase } from '../../lib/supabase'
import { clearAuth as clearSpotifyAuth, disconnectSpotify } from '../../services/spotify/tokens'
import { setSpotifyLink, useSpotifyLink, isSpotifyLinked } from '../spotifySession'
import AccentPicker from './AccentPicker'
import Avatar from './Avatar'

interface Props {
  onClose: () => void
  anchor: HTMLElement | null
}

export default function ProfileDropdown({ onClose, anchor }: Props) {
  const { user } = useAuth()
  const { profile, patchProfile } = useProfile()
  const navigate = useNavigate()
  const link = useSpotifyLink()
  const panelRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { onClose(); anchor?.focus() } }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, anchor])

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setAvatarError('Use a JPG, PNG or WebP image.'); return }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Images must be 2 MB or smaller.'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
      if (error) throw error
      patchProfile({ avatar_url: url })
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed.')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onDisconnect() {
    setDisconnecting(true)
    await disconnectSpotify()
    setSpotifyLink('not-linked')
    setDisconnecting(false)
  }

  async function onSignOut() {
    onClose()
    clearSpotifyAuth()
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  const name = profile?.username ? `@${profile.username}` : user?.email ?? 'Account'
  const linked = isSpotifyLinked(link)

  return (
    <div ref={panelRef} className="dropdown" role="dialog" aria-label="Account">
      <div className="dropdown__head">
        <Avatar size={48} />
        <div className="dropdown__who">
          <div className="dropdown__name">{name}</div>
          {profile?.username && user?.email && <div className="dropdown__email">{user.email}</div>}
        </div>
      </div>

      <section className="dropdown__section">
        <span className="label">Accent</span>
        <AccentPicker />
      </section>

      <section className="dropdown__section">
        <span className="label">Avatar</span>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onAvatar} className="sr-only" tabIndex={-1} />
        <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Choose image'}
        </button>
        {avatarError && <p className="alert" role="alert">{avatarError}</p>}
      </section>

      <section className="dropdown__section">
        <span className="label">Spotify</span>
        {linked ? (
          <button type="button" className="btn btn--sm" onClick={onDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect Spotify'}
          </button>
        ) : (
          <button type="button" className="btn btn--sm" onClick={() => { onClose(); navigate('/spotify-login') }}>
            Connect Spotify
          </button>
        )}
      </section>

      <hr className="rule" />
      <button type="button" className="btn btn--ghost btn--block" onClick={onSignOut}>Sign out</button>
    </div>
  )
}
