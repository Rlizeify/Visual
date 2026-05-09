import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTable, { type Column } from './AdminTable'
import AdminConfirmDialog from './AdminConfirmDialog'
import AdminToolbar, { adminButtonStyle } from './AdminToolbar'
import { palette, mono } from './theme'
import { adminGet, adminDelete } from '../../lib/adminApi'

interface ConnectionRow {
  id: string
  user_id: string
  email: string | null
  username: string | null
  display_name: string | null
  provider: string
  expires_at: string | null
  scope: string | null
  created_at: string
  updated_at: string
}

export default function OAuthTab() {
  const [rows, setRows] = useState<ConnectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [disconnecting, setDisconnecting] = useState<ConnectionRow | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGet<{ connections: ConnectionRow[] }>('/api/admin/oauth')
      setRows(data.connections)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const providers = useMemo(() => {
    const set = new Set(rows.map(r => r.provider))
    return ['all', ...Array.from(set).sort()]
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (providerFilter !== 'all' && r.provider !== providerFilter) return false
      if (!q) return true
      return [r.email, r.username, r.display_name, r.provider]
        .filter((v): v is string => typeof v === 'string')
        .some(v => v.toLowerCase().includes(q))
    })
  }, [rows, search, providerFilter])

  const columns: Column<ConnectionRow>[] = [
    {
      key: 'user',
      header: 'user',
      render: r => (
        <span>
          <span style={{ color: palette.fg }}>{r.email ?? <em style={{ color: palette.fgVeryDim }}>no email</em>}</span>
          {r.username && <span style={{ color: palette.fgDim, marginLeft: 6 }}>@{r.username}</span>}
        </span>
      ),
      sortValue: r => r.email ?? '',
    },
    {
      key: 'provider',
      header: 'provider',
      render: r => <span style={{ color: providerColor(r.provider) }}>{r.provider}</span>,
      sortValue: r => r.provider,
    },
    {
      key: 'expires_at',
      header: 'expires',
      render: r => formatExpiry(r.expires_at),
      sortValue: r => r.expires_at ?? '',
    },
    {
      key: 'scope',
      header: 'scope',
      render: r => (
        <span style={{ color: palette.fgDim, fontSize: 11 }} title={r.scope ?? ''}>
          {r.scope ? truncate(r.scope, 60) : <span style={{ color: palette.fgVeryDim }}>—</span>}
        </span>
      ),
    },
    {
      key: 'updated_at',
      header: 'updated',
      render: r => new Date(r.updated_at).toLocaleString(),
      sortValue: r => r.updated_at,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: r => (
        <button
          onClick={e => {
            e.stopPropagation()
            setDisconnecting(r)
          }}
          style={{ ...adminButtonStyle, padding: '4px 10px', fontSize: 10 }}
        >
          &gt; DISCONNECT
        </button>
      ),
    },
  ]

  return (
    <div>
      <div style={styles.note}>
        Disconnect removes our row in <code>oauth_connections</code> only — it does <strong>not</strong> revoke
        the upstream grant on the provider (Spotify, Discord, etc.). The user must visit the
        provider directly to fully revoke.
      </div>

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="filter by email, username, provider…"
        status={<span>{loading ? 'loading…' : `${filtered.length}/${rows.length} connections`}</span>}
        actions={
          <>
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
              style={styles.select}
            >
              {providers.map(p => (
                <option key={p} value={p}>
                  {p === 'all' ? 'all providers' : p}
                </option>
              ))}
            </select>
            <button onClick={refresh} style={adminButtonStyle}>
              &gt; REFRESH
            </button>
          </>
        }
      />

      {info && <div style={styles.infoBanner}>OK: {info}</div>}
      {error && <div style={styles.errorBanner}>ERR: {error}</div>}

      <AdminTable
        rows={filtered}
        columns={columns}
        rowKey={r => r.id}
        emptyMessage={loading ? 'loading…' : 'no connections'}
        defaultSortKey="updated_at"
        defaultSortDir="desc"
      />

      <AdminConfirmDialog
        open={!!disconnecting}
        title="DISCONNECT OAUTH"
        message={
          disconnecting
            ? `Remove the ${disconnecting.provider} connection for ${disconnecting.email ?? disconnecting.user_id}? This deletes our stored tokens but does NOT revoke the upstream grant.`
            : ''
        }
        confirmLabel="DISCONNECT"
        onCancel={() => setDisconnecting(null)}
        onConfirm={async () => {
          if (!disconnecting) return
          try {
            await adminDelete(`/api/admin/oauth?id=${disconnecting.id}`)
            setRows(prev => prev.filter(r => r.id !== disconnecting.id))
            setInfo(`disconnected ${disconnecting.provider} for ${disconnecting.email ?? disconnecting.user_id}`)
            setDisconnecting(null)
          } catch (e) {
            setError((e as Error).message)
            setDisconnecting(null)
          }
        }}
      />
    </div>
  )
}

function providerColor(p: string): string {
  switch (p) {
    case 'spotify':
      return '#1DB954'
    case 'discord':
      return '#5865F2'
    case 'youtube':
      return '#FF0000'
    case 'apple':
      return '#FFFFFF'
    case 'mynetdiary':
      return '#4CAF50'
    default:
      return palette.fg
  }
}

function formatExpiry(iso: string | null): React.ReactNode {
  if (!iso) return <span style={{ color: palette.fgVeryDim }}>never</span>
  const d = new Date(iso)
  const now = Date.now()
  const diff = d.getTime() - now
  const expired = diff < 0
  const color = expired ? palette.accent : diff < 24 * 3600 * 1000 ? palette.warn : palette.fg
  return (
    <span style={{ color }} title={d.toISOString()}>
      {expired ? 'expired ' : ''}
      {d.toLocaleString()}
    </span>
  )
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
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
    letterSpacing: '0.04em',
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
  select: {
    background: palette.panelAlt,
    color: palette.fg,
    border: `1px solid ${palette.accentSubtle}`,
    borderRadius: 0,
    padding: '6px 10px',
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.08em',
    cursor: 'pointer',
  },
}
