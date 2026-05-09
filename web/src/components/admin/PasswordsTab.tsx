import { useEffect, useMemo, useState } from 'react'
import AdminTable, { type Column } from './AdminTable'
import AdminModal from './AdminModal'
import AdminToolbar, { adminButtonStyle } from './AdminToolbar'
import { palette, mono } from './theme'
import { adminGet, adminPost } from '../../lib/adminApi'
import { useAuth } from '../../context/AuthContext'

// Super-admin email mirrors web/api/_admin.ts. The server-side gate is what
// actually enforces — this is purely UI ("hide the button for regular admins").
const SUPER_ADMIN_EMAIL = 'stone.gaunce@gmail.com'

interface UserRow {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
}

export default function PasswordsTab() {
  const { user } = useAuth()
  const isSuperAdmin = (user?.email ?? '').toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()

  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [forceSetTarget, setForceSetTarget] = useState<UserRow | null>(null)
  const [resetting, setResetting] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await adminGet<{ users: UserRow[] }>('/api/admin/users')
        if (!cancelled) setRows(data.users)
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [r.email, r.username, r.display_name]
        .filter((v): v is string => typeof v === 'string')
        .some(v => v.toLowerCase().includes(q)),
    )
  }, [rows, search])

  const handleResetPassword = async (target: UserRow) => {
    if (!target.email) {
      setError('cannot reset — user has no email on file')
      return
    }
    setResetting(target.id)
    setError(null)
    setInfo(null)
    try {
      await adminPost('/api/admin/reset-password', { email: target.email })
      setInfo(`recovery email sent to ${target.email}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setResetting(null)
    }
  }

  const columns: Column<UserRow>[] = [
    { key: 'email', header: 'email', sortValue: r => r.email ?? '' },
    { key: 'username', header: 'username', sortValue: r => r.username ?? '' },
    { key: 'display_name', header: 'display name', sortValue: r => r.display_name ?? '' },
    {
      key: 'actions',
      header: 'actions',
      align: 'right',
      width: '320px',
      render: r => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={e => {
              e.stopPropagation()
              handleResetPassword(r)
            }}
            disabled={resetting !== null || !r.email}
            style={{
              ...adminButtonStyle,
              padding: '4px 10px',
              fontSize: 10,
              opacity: resetting === r.id ? 0.5 : !r.email ? 0.4 : 1,
              cursor: !r.email ? 'not-allowed' : 'pointer',
            }}
          >
            {resetting === r.id ? '…' : '> RESET EMAIL'}
          </button>
          {isSuperAdmin && (
            <button
              onClick={e => {
                e.stopPropagation()
                setForceSetTarget(r)
              }}
              style={{
                ...adminButtonStyle,
                padding: '4px 10px',
                fontSize: 10,
                color: palette.warn,
                borderColor: palette.warn,
              }}
            >
              &gt; FORCE-SET
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div style={styles.warningBanner}>
        <strong>AUDITABLE.</strong> Every reset and force-set writes a row to <code>audit_log</code> with the admin
        id, target user, and timestamp. Force-set never records the password value itself.
        {isSuperAdmin && <> · Force-set is enabled for this account.</>}
        {!isSuperAdmin && <> · Force-set is hidden — super-admin only.</>}
      </div>

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="filter by email, username, display name…"
        status={<span>{loading ? 'loading…' : `${filtered.length}/${rows.length} users`}</span>}
      />

      {info && <div style={styles.infoBanner}>OK: {info}</div>}
      {error && <div style={styles.errorBanner}>ERR: {error}</div>}

      <AdminTable
        rows={filtered}
        columns={columns}
        rowKey={r => r.id}
        emptyMessage={loading ? 'loading…' : 'no users'}
        defaultSortKey="email"
      />

      {forceSetTarget && isSuperAdmin && (
        <ForceSetPasswordModal
          target={forceSetTarget}
          onClose={() => setForceSetTarget(null)}
          onSuccess={msg => {
            setInfo(msg)
            setForceSetTarget(null)
          }}
          onError={msg => setError(msg)}
        />
      )}
    </div>
  )
}

interface ForceSetProps {
  target: UserRow
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}

function ForceSetPasswordModal({ target, onClose, onSuccess, onError }: ForceSetProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const valid = password.length >= 8 && password === confirm

  const handleSubmit = async () => {
    if (!valid || submitting) return
    setSubmitting(true)
    try {
      await adminPost('/api/admin/set-password', {
        user_id: target.id,
        new_password: password,
      })
      onSuccess(`password force-set for ${target.email ?? target.id}`)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AdminModal open title="FORCE-SET PASSWORD" onClose={onClose} width={520}>
      <div style={styles.warningBox}>
        <strong>WARNING.</strong> This overwrites the user's password without sending an email or
        confirming with them. Use only when the standard recovery flow is broken (lost email
        access, etc.). Recorded in <code>audit_log</code>; the password value is not.
      </div>

      <div style={styles.targetRow}>
        <span style={styles.targetLabel}>target</span>
        <span style={styles.targetValue}>
          {target.email ?? target.id}
          {target.username ? ` · @${target.username}` : ''}
        </span>
      </div>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>&gt; new password (≥ 8 chars)</span>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          autoComplete="new-password"
          style={styles.input}
        />
      </label>

      <label style={styles.field}>
        <span style={styles.fieldLabel}>&gt; confirm</span>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          style={styles.input}
        />
      </label>

      {confirm.length > 0 && password !== confirm && (
        <div style={styles.errorBanner}>passwords do not match</div>
      )}

      <div style={styles.actions}>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...adminButtonStyle, color: palette.fgDim, borderColor: palette.fgDim }}>
          &gt; CANCEL
        </button>
        <button
          onClick={handleSubmit}
          disabled={!valid || submitting}
          style={{
            ...adminButtonStyle,
            color: palette.warn,
            borderColor: palette.warn,
            opacity: !valid || submitting ? 0.4 : 1,
            cursor: !valid || submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? '…' : '> FORCE-SET'}
        </button>
      </div>
    </AdminModal>
  )
}

const styles: Record<string, React.CSSProperties> = {
  warningBanner: {
    border: `1px solid ${palette.warn}`,
    color: palette.warn,
    background: 'rgba(255, 181, 69, 0.06)',
    padding: '10px 14px',
    fontSize: 11,
    lineHeight: 1.5,
    fontFamily: mono,
    marginBottom: 14,
    letterSpacing: '0.04em',
  },
  warningBox: {
    border: `1px solid ${palette.warn}`,
    color: palette.warn,
    background: 'rgba(255, 181, 69, 0.06)',
    padding: '10px 14px',
    fontSize: 11,
    fontFamily: mono,
    marginBottom: 16,
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
  targetRow: {
    display: 'flex',
    gap: 12,
    fontSize: 12,
    fontFamily: mono,
    padding: '4px 0',
    borderBottom: `1px solid ${palette.accentFaint}`,
    marginBottom: 12,
  },
  targetLabel: {
    color: palette.fgDim,
    width: 80,
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  targetValue: {
    color: palette.fg,
    flex: 1,
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
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 24,
    alignItems: 'center',
  },
}
