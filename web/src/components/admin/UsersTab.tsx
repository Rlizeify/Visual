import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTable, { type Column } from './AdminTable'
import AdminModal from './AdminModal'
import AdminConfirmDialog from './AdminConfirmDialog'
import AdminToolbar, { adminButtonStyle } from './AdminToolbar'
import { palette, mono } from './theme'
import { adminGet, adminPatch, adminDelete } from '../../lib/adminApi'

interface UserRow {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
  is_admin: boolean
  created_at: string
  last_sign_in: string | null
}

export default function UsersTab() {
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editing, setEditing] = useState<UserRow | null>(null)
  const [deletingTarget, setDeletingTarget] = useState<UserRow | null>(null)

  // [admin-diag] temporary — remove after diagnosis
  console.log('[admin-diag] UsersTab render')
  useEffect(() => {
    console.log('[admin-diag] UsersTab mounted (effect)')
    return () => console.log('[admin-diag] UsersTab UNMOUNTED')
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGet<{ users: UserRow[] }>('/api/admin/users')
      setRows(data.users)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      [r.email, r.username, r.display_name, r.id]
        .filter((v): v is string => typeof v === 'string')
        .some(v => v.toLowerCase().includes(q)),
    )
  }, [rows, search])

  const columns: Column<UserRow>[] = [
    { key: 'email', header: 'email', sortValue: r => r.email ?? '' },
    { key: 'username', header: 'username', sortValue: r => r.username ?? '' },
    { key: 'display_name', header: 'display name', sortValue: r => r.display_name ?? '' },
    {
      key: 'is_admin',
      header: 'admin',
      align: 'center',
      render: r => (r.is_admin ? <span style={{ color: palette.accent }}>YES</span> : <span style={{ color: palette.fgVeryDim }}>—</span>),
      sortValue: r => (r.is_admin ? 1 : 0),
    },
    {
      key: 'created_at',
      header: 'created',
      render: r => new Date(r.created_at).toLocaleDateString(),
      sortValue: r => r.created_at,
    },
    {
      key: 'last_sign_in',
      header: 'last sign-in',
      render: r => (r.last_sign_in ? new Date(r.last_sign_in).toLocaleString() : <span style={{ color: palette.fgVeryDim }}>never</span>),
      sortValue: r => r.last_sign_in ?? '',
    },
    {
      key: 'id',
      header: 'id',
      render: r => <span style={{ color: palette.fgVeryDim, fontSize: 10 }}>{r.id.slice(0, 8)}…</span>,
    },
  ]

  return (
    <div>
      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="filter by email, username, display name, id…"
        status={
          <span>
            {loading ? 'loading…' : `${filtered.length}/${rows.length} users`}
          </span>
        }
        actions={
          <button onClick={refresh} style={adminButtonStyle}>
            &gt; REFRESH
          </button>
        }
      />

      {error && <div style={errorBanner}>ERR: {error}</div>}

      <AdminTable
        rows={filtered}
        columns={columns}
        rowKey={r => r.id}
        onRowClick={setEditing}
        emptyMessage={loading ? 'loading…' : 'no users'}
        defaultSortKey="created_at"
        defaultSortDir="desc"
      />

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setRows(prev => prev.map(r => (r.id === updated.id ? { ...r, ...updated } : r)))
            setEditing(null)
          }}
          onDelete={() => {
            setDeletingTarget(editing)
            setEditing(null)
          }}
        />
      )}

      <AdminConfirmDialog
        open={!!deletingTarget}
        title="DELETE USER"
        message={
          deletingTarget
            ? `This permanently deletes ${deletingTarget.email ?? deletingTarget.id} and cascades to profiles, oauth_connections, life_score_samples, and life_score_derivatives. This cannot be undone.`
            : ''
        }
        confirmLabel="DELETE"
        requireTypedConfirmation={deletingTarget?.email ?? deletingTarget?.id ?? 'DELETE'}
        onCancel={() => setDeletingTarget(null)}
        onConfirm={async () => {
          if (!deletingTarget) return
          try {
            await adminDelete(`/api/admin/users?id=${deletingTarget.id}`)
            setRows(prev => prev.filter(r => r.id !== deletingTarget.id))
            setDeletingTarget(null)
          } catch (e) {
            setError((e as Error).message)
            setDeletingTarget(null)
          }
        }}
      />
    </div>
  )
}

interface EditUserModalProps {
  user: UserRow
  onClose: () => void
  onSaved: (updated: Partial<UserRow> & { id: string }) => void
  onDelete: () => void
}

function EditUserModal({ user, onClose, onSaved, onDelete }: EditUserModalProps) {
  const [username, setUsername] = useState(user.username ?? '')
  const [displayName, setDisplayName] = useState(user.display_name ?? '')
  const [isAdmin, setIsAdmin] = useState(user.is_admin)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setErr(null)
    try {
      const res = await adminPatch<{ profile: { id: string; username: string | null; display_name: string | null; is_admin: boolean } }>(
        `/api/admin/users?id=${user.id}`,
        {
          username: username.trim() || null,
          display_name: displayName.trim() || null,
          is_admin: isAdmin,
        },
      )
      onSaved({
        id: res.profile.id,
        username: res.profile.username,
        display_name: res.profile.display_name,
        is_admin: res.profile.is_admin,
      })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal open title="EDIT USER" onClose={onClose} width={520}>
      <div style={modalStyles.readonlyRow}>
        <span style={modalStyles.readonlyLabel}>email</span>
        <span style={modalStyles.readonlyValue}>{user.email ?? '—'}</span>
      </div>
      <div style={modalStyles.readonlyRow}>
        <span style={modalStyles.readonlyLabel}>id</span>
        <span style={{ ...modalStyles.readonlyValue, color: palette.fgVeryDim, fontSize: 11 }}>{user.id}</span>
      </div>

      <FormField label="username">
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          style={modalStyles.input}
          placeholder="(none)"
        />
      </FormField>

      <FormField label="display name">
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          style={modalStyles.input}
          placeholder="(none)"
        />
      </FormField>

      <label style={modalStyles.checkboxRow}>
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={e => setIsAdmin(e.target.checked)}
          style={modalStyles.checkbox}
        />
        <span style={modalStyles.checkboxLabel}>is_admin</span>
        <span style={modalStyles.checkboxHint}>
          {isAdmin ? 'admin privileges granted' : 'regular user'}
        </span>
      </label>

      {err && <div style={errorBanner}>ERR: {err}</div>}

      <div style={modalStyles.actions}>
        <button onClick={onDelete} style={{ ...adminButtonStyle, color: palette.accent, borderColor: palette.accent }}>
          &gt; DELETE
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...adminButtonStyle, color: palette.fgDim, borderColor: palette.fgDim }}>
          &gt; CANCEL
        </button>
        <button onClick={handleSave} disabled={saving} style={adminButtonStyle}>
          {saving ? '…' : '> SAVE'}
        </button>
      </div>
    </AdminModal>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={modalStyles.field}>
      <span style={modalStyles.fieldLabel}>&gt; {label}</span>
      {children}
    </div>
  )
}

const errorBanner: React.CSSProperties = {
  border: `1px solid ${palette.accent}`,
  color: palette.accent,
  padding: '6px 10px',
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  margin: '12px 0',
}

const modalStyles: Record<string, React.CSSProperties> = {
  readonlyRow: {
    display: 'flex',
    gap: 12,
    fontSize: 12,
    fontFamily: mono,
    padding: '4px 0',
    borderBottom: `1px solid ${palette.accentFaint}`,
  },
  readonlyLabel: {
    color: palette.fgDim,
    width: 80,
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  readonlyValue: {
    color: palette.fg,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginTop: 12,
  },
  fieldLabel: {
    color: palette.fgDim,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontFamily: mono,
  },
  input: {
    background: palette.panelAlt,
    color: palette.fg,
    border: `1px solid ${palette.accentSubtle}`,
    borderRadius: 0,
    padding: '8px 10px',
    fontFamily: mono,
    fontSize: 13,
    outline: 'none',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    cursor: 'pointer',
    fontFamily: mono,
  },
  checkbox: {
    width: 14,
    height: 14,
    accentColor: palette.accent,
  },
  checkboxLabel: {
    color: palette.fg,
    fontSize: 12,
    letterSpacing: '0.08em',
  },
  checkboxHint: {
    color: palette.fgDim,
    fontSize: 11,
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 24,
    alignItems: 'center',
  },
}
