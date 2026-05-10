import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTable, { type Column } from './AdminTable'
import AdminModal from './AdminModal'
import AdminToolbar, { adminButtonStyle } from './AdminToolbar'
import { palette, mono } from './theme'
import { adminGet, adminPatch } from '../../lib/adminApi'

const FIELDS = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
type Field = typeof FIELDS[number]

interface DerivativeRow {
  id: string
  user_id: string
  username: string | null
  display_name: string | null
  metric: string
  position: number
  velocity: number
  acceleration: number
  jerk: number
  snap: number
  computed_at: string
}

export default function LifeScoresTab() {
  const [rows, setRows] = useState<DerivativeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<DerivativeRow | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGet<{ derivatives: DerivativeRow[] }>('/api/admin/scoring?type=derivatives')
      setRows(data.derivatives)
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
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      [r.username, r.display_name, r.metric, r.user_id]
        .filter((v): v is string => typeof v === 'string')
        .some(v => v.toLowerCase().includes(q)),
    )
  }, [rows, search])

  const columns: Column<DerivativeRow>[] = [
    {
      key: 'user',
      header: 'user',
      render: r => (
        <span>
          <span style={{ color: palette.fg }}>
            {r.username ?? r.display_name ?? <span style={{ color: palette.fgVeryDim }}>{r.user_id.slice(0, 8)}…</span>}
          </span>
        </span>
      ),
      sortValue: r => r.username ?? r.display_name ?? r.user_id,
    },
    { key: 'metric', header: 'metric', sortValue: r => r.metric },
    {
      key: 'position',
      header: 'pos (x)',
      align: 'right',
      render: r => formatNum(r.position),
      sortValue: r => r.position,
    },
    {
      key: 'velocity',
      header: 'vel (v)',
      align: 'right',
      render: r => formatNum(r.velocity),
      sortValue: r => r.velocity,
    },
    {
      key: 'acceleration',
      header: 'acc (a)',
      align: 'right',
      render: r => formatNum(r.acceleration),
      sortValue: r => r.acceleration,
    },
    {
      key: 'jerk',
      header: 'jerk (j)',
      align: 'right',
      render: r => formatNum(r.jerk),
      sortValue: r => r.jerk,
    },
    {
      key: 'snap',
      header: 'snap (s)',
      align: 'right',
      render: r => formatNum(r.snap),
      sortValue: r => r.snap,
    },
    {
      key: 'computed_at',
      header: 'computed',
      render: r => new Date(r.computed_at).toLocaleString(),
      sortValue: r => r.computed_at,
    },
  ]

  return (
    <div>
      <div style={styles.note}>
        Edit derivative values directly. Recompute will re-derive position/velocity/acceleration/jerk/snap from
        <code> life_score_samples</code> — wires to a future edge function (placeholder for now).
      </div>

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="filter by username, display name, metric…"
        status={<span>{loading ? 'loading…' : `${filtered.length}/${rows.length} derivatives`}</span>}
        actions={
          <>
            <button
              disabled
              style={{
                ...adminButtonStyle,
                color: palette.fgDim,
                borderColor: palette.fgDim,
                cursor: 'not-allowed',
                opacity: 0.6,
              }}
              title="Edge function not yet implemented"
            >
              &gt; RECOMPUTE
            </button>
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
        rowKey={r => `${r.user_id}:${r.metric}`}
        onRowClick={setEditing}
        emptyMessage={loading ? 'loading…' : 'no derivatives'}
        defaultSortKey="computed_at"
        defaultSortDir="desc"
      />

      {editing && (
        <EditDerivativeModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setRows(prev =>
              prev.map(r =>
                r.user_id === updated.user_id && r.metric === updated.metric ? { ...r, ...updated } : r,
              ),
            )
            setInfo(`updated ${updated.metric} for ${updated.user_id.slice(0, 8)}…`)
            setEditing(null)
          }}
          onError={msg => setError(msg)}
        />
      )}
    </div>
  )
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000) return n.toFixed(0)
  if (Math.abs(n) >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

interface EditProps {
  row: DerivativeRow
  onClose: () => void
  onSaved: (row: { user_id: string; metric: string; position: number; velocity: number; acceleration: number; jerk: number; snap: number; computed_at: string }) => void
  onError: (msg: string) => void
}

function EditDerivativeModal({ row, onClose, onSaved, onError }: EditProps) {
  const [values, setValues] = useState<Record<Field, string>>({
    position: String(row.position),
    velocity: String(row.velocity),
    acceleration: String(row.acceleration),
    jerk: String(row.jerk),
    snap: String(row.snap),
  })
  const [saving, setSaving] = useState(false)

  const setField = (f: Field, v: string) => setValues(prev => ({ ...prev, [f]: v }))

  const parsed = useMemo(() => {
    const out: Partial<Record<Field, number>> = {}
    let invalid = false
    for (const f of FIELDS) {
      const n = Number(values[f])
      if (!Number.isFinite(n)) {
        invalid = true
        break
      }
      out[f] = n
    }
    return invalid ? null : (out as Record<Field, number>)
  }, [values])

  const handleSave = async () => {
    if (!parsed || saving) return
    setSaving(true)
    try {
      const res = await adminPatch<{ derivative: { user_id: string; metric: string; position: number; velocity: number; acceleration: number; jerk: number; snap: number; computed_at: string } }>(
        `/api/admin/scoring?type=derivatives&user_id=${encodeURIComponent(row.user_id)}&metric=${encodeURIComponent(row.metric)}`,
        parsed,
      )
      onSaved(res.derivative)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminModal open title="EDIT DERIVATIVE" onClose={onClose} width={520}>
      <div style={styles.targetRow}>
        <span style={styles.targetLabel}>user</span>
        <span style={styles.targetValue}>
          {row.username ?? row.display_name ?? row.user_id}
        </span>
      </div>
      <div style={styles.targetRow}>
        <span style={styles.targetLabel}>metric</span>
        <span style={styles.targetValue}>{row.metric}</span>
      </div>

      {FIELDS.map(f => (
        <label key={f} style={styles.field}>
          <span style={styles.fieldLabel}>&gt; {f}</span>
          <input
            type="number"
            step="any"
            value={values[f]}
            onChange={e => setField(f, e.target.value)}
            style={styles.input}
          />
        </label>
      ))}

      {!parsed && <div style={styles.errorBanner}>all fields must be valid numbers</div>}

      <div style={styles.actions}>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ ...adminButtonStyle, color: palette.fgDim, borderColor: palette.fgDim }}>
          &gt; CANCEL
        </button>
        <button
          onClick={handleSave}
          disabled={!parsed || saving}
          style={{
            ...adminButtonStyle,
            opacity: !parsed || saving ? 0.4 : 1,
            cursor: !parsed || saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '…' : '> SAVE'}
        </button>
      </div>
    </AdminModal>
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
  targetRow: {
    display: 'flex',
    gap: 12,
    fontSize: 12,
    fontFamily: mono,
    padding: '4px 0',
    borderBottom: `1px solid ${palette.accentFaint}`,
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
