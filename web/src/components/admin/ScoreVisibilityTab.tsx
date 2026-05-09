import { useCallback, useEffect, useState } from 'react'
import AdminTable, { type Column } from './AdminTable'
import AdminToolbar, { adminButtonStyle } from './AdminToolbar'
import { palette, mono } from './theme'
import { adminGet, adminPatch } from '../../lib/adminApi'

const SCORE_TYPES = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
type ScoreType = typeof SCORE_TYPES[number]

interface UserRow {
  id: string
  username: string | null
  display_name: string | null
  email: string | null
}

interface VisibilityRow {
  user_id: string
  score_type: ScoreType
  reveal_action: boolean
}

interface UserWithVisibility extends UserRow {
  visibility: Record<ScoreType, boolean>
}

export default function ScoreVisibilityTab() {
  const [users, setUsers] = useState<UserWithVisibility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersData, visData] = await Promise.all([
        adminGet<{ users: UserRow[] }>('/api/admin/users'),
        adminGet<{ visibility: VisibilityRow[] }>('/api/admin/score-visibility'),
      ])

      // Build visibility lookup
      const visMap: Record<string, Record<ScoreType, boolean>> = {}
      for (const v of visData.visibility || []) {
        if (!visMap[v.user_id]) {
          visMap[v.user_id] = { position: false, velocity: false, acceleration: false, jerk: false, snap: false }
        }
        visMap[v.user_id][v.score_type] = v.reveal_action
      }

      // Merge with users
      const merged: UserWithVisibility[] = (usersData.users || []).map(u => ({
        ...u,
        visibility: visMap[u.id] || { position: false, velocity: false, acceleration: false, jerk: false, snap: false },
      }))

      setUsers(merged)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleToggle = async (userId: string, scoreType: ScoreType, newValue: boolean) => {
    try {
      await adminPatch('/api/admin/score-visibility', {
        user_id: userId,
        score_type: scoreType,
        reveal_action: newValue,
      })

      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, visibility: { ...u.visibility, [scoreType]: newValue } }
          : u
      ))
      setInfo(`Updated ${scoreType} visibility for user`)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return [u.username, u.display_name, u.email, u.id]
      .filter((v): v is string => typeof v === 'string')
      .some(v => v.toLowerCase().includes(q))
  })

  const columns: Column<UserWithVisibility>[] = [
    {
      key: 'user',
      header: 'user',
      render: r => (
        <span style={{ color: palette.fg }}>
          {r.username ?? r.display_name ?? r.email ?? r.id.slice(0, 8)}
        </span>
      ),
      sortValue: r => r.username ?? r.display_name ?? r.email ?? r.id,
    },
    ...SCORE_TYPES.map(st => ({
      key: st,
      header: st.slice(0, 3),
      align: 'center' as const,
      render: (r: UserWithVisibility) => (
        <input
          type="checkbox"
          checked={r.visibility[st]}
          onChange={e => handleToggle(r.id, st, e.target.checked)}
          style={{ cursor: 'pointer', accentColor: palette.accent }}
        />
      ),
    })),
  ]

  return (
    <div>
      <div style={styles.note}>
        Control which users can see the source action for their own score changes.
        When enabled, users see what caused their score to change (e.g., "2 hours on Spotify").
        Other users never see source actions regardless of these settings.
      </div>

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="filter by username, email…"
        status={<span>{loading ? 'loading…' : `${filtered.length}/${users.length} users`}</span>}
        actions={
          <button onClick={refresh} style={adminButtonStyle}>
            &gt; REFRESH
          </button>
        }
      />

      {info && <div style={styles.infoBanner}>OK: {info}</div>}
      {error && <div style={styles.errorBanner}>ERR: {error}</div>}

      <AdminTable
        rows={filtered}
        columns={columns}
        rowKey={r => r.id}
        emptyMessage={loading ? 'loading…' : 'no users'}
        defaultSortKey="user"
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  note: {
    border: `1px solid ${palette.fgDim}`,
    color: palette.fgDim,
    padding: '8px 12px',
    fontSize: 11,
    fontFamily: mono,
    marginBottom: 12,
    lineHeight: 1.5,
  },
  errorBanner: {
    border: `1px solid ${palette.accent}`,
    color: palette.accent,
    padding: '6px 10px',
    fontFamily: mono,
    fontSize: 11,
    margin: '8px 0',
  },
  infoBanner: {
    border: `1px solid ${palette.ok}`,
    color: palette.ok,
    padding: '6px 10px',
    fontFamily: mono,
    fontSize: 11,
    margin: '8px 0',
  },
}
