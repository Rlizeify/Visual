import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../context/ProfileContext'

export default function Avatar({ size = 36 }: { size?: number }) {
  const { user } = useAuth()
  const { profile } = useProfile()
  const initial = (profile?.username || user?.email || '?')[0].toUpperCase()
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span aria-hidden>{initial}</span>}
    </span>
  )
}
