import { useCallback, useEffect, useState } from 'react'
import AdminModal from './AdminModal'
import AdminToolbar, { adminButtonStyle } from './AdminToolbar'
import { palette, mono } from './theme'
import { adminGet, adminPatch } from '../../lib/adminApi'

const SCORE_TYPES = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
type ScoreType = typeof SCORE_TYPES[number]

interface TooltipDefault {
  score_type: ScoreType
  text: string
}

interface TooltipOverride {
  user_id: string
  score_type: ScoreType
  text: string
}

interface UserRow {
  id: string
  username: string | null
  display_name: string | null
}

export default function TooltipsTab() {
  const [defaults, setDefaults] = useState<TooltipDefault[]>([])
  const [overrides, setOverrides] = useState<TooltipOverride[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [editingDefault, setEditingDefault] = useState<ScoreType | null>(null)
  const [editingOverride, setEditingOverride] = useState<{ user: UserRow; scoreType: ScoreType } | null>(null)
  const [editText, setEditText] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [defaultsData, overridesData, usersData] = await Promise.all([
        adminGet<{ defaults: TooltipDefault[] }>('/api/admin/tooltips/defaults'),
        adminGet<{ overrides: TooltipOverride[] }>('/api/admin/tooltips/overrides'),
        adminGet<{ users: UserRow[] }>('/api/admin/users'),
      ])
      setDefaults(defaultsData.defaults || [])
      setOverrides(overridesData.overrides || [])
      setUsers(usersData.users || [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleSaveDefault = async () => {
    if (!editingDefault) return
    try {
      await adminPatch('/api/admin/tooltips/defaults', {
        score_type: editingDefault,
        text: editText,
      })
      setDefaults(prev => prev.map(d =>
        d.score_type === editingDefault ? { ...d, text: editText } : d
      ))
      setInfo(`Updated ${editingDefault} default tooltip`)
      setEditingDefault(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleSaveOverride = async () => {
    if (!editingOverride) return
    try {
      await adminPatch('/api/admin/tooltips/overrides', {
        user_id: editingOverride.user.id,
        score_type: editingOverride.scoreType,
        text: editText,
      })
      const existing = overrides.find(
        o => o.user_id === editingOverride.user.id && o.score_type === editingOverride.scoreType
      )
      if (existing) {
        setOverrides(prev => prev.map(o =>
          o.user_id === editingOverride.user.id && o.score_type === editingOverride.scoreType
            ? { ...o, text: editText }
            : o
        ))
      } else {
        setOverrides(prev => [...prev, {
          user_id: editingOverride.user.id,
          score_type: editingOverride.scoreType,
          text: editText,
        }])
      }
      setInfo(`Updated ${editingOverride.scoreType} tooltip for ${editingOverride.user.username || editingOverride.user.id}`)
      setEditingOverride(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const getDefaultText = (scoreType: ScoreType) => {
    return defaults.find(d => d.score_type === scoreType)?.text || ''
  }

  const getOverrideText = (userId: string, scoreType: ScoreType) => {
    return overrides.find(o => o.user_id === userId && o.score_type === scoreType)?.text
  }

  return (
    <div>
      <div style={styles.note}>
        Edit tooltip text shown when users hover over their score boxes.
        Site-wide defaults apply to all users unless a per-user override exists.
      </div>

      <AdminToolbar
        search=""
        onSearchChange={() => {}}
        placeholder=""
        status={<span>{loading ? 'loading…' : 'tooltips'}</span>}
        actions={
          <button onClick={refresh} style={adminButtonStyle}>
            &gt; REFRESH
          </button>
        }
      />

      {info && <div style={styles.infoBanner}>OK: {info}</div>}
      {error && <div style={styles.errorBanner}>ERR: {error}</div>}

      {/* Site-wide Defaults */}
      <h3 style={styles.sectionHeader}>Site-wide Defaults</h3>
      <div style={styles.grid}>
        {SCORE_TYPES.map(st => (
          <div key={st} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={{ color: palette.accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {st}
              </span>
              <button
                onClick={() => {
                  setEditText(getDefaultText(st))
                  setEditingDefault(st)
                }}
                style={{ ...adminButtonStyle, padding: '4px 8px', fontSize: 10 }}
              >
                EDIT
              </button>
            </div>
            <div style={styles.cardText}>
              {getDefaultText(st) || <em style={{ color: palette.fgDim }}>not set</em>}
            </div>
          </div>
        ))}
      </div>

      {/* Per-user Overrides */}
      <h3 style={{ ...styles.sectionHeader, marginTop: 24 }}>Per-user Overrides</h3>
      {users.length === 0 ? (
        <div style={{ color: palette.fgDim, fontSize: 12 }}>No users</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>User</th>
                {SCORE_TYPES.map(st => (
                  <th key={st} style={styles.th}>{st.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 20).map(user => (
                <tr key={user.id}>
                  <td style={styles.td}>
                    {user.username ?? user.display_name ?? user.id.slice(0, 8)}
                  </td>
                  {SCORE_TYPES.map(st => {
                    const override = getOverrideText(user.id, st)
                    return (
                      <td key={st} style={styles.td}>
                        <button
                          onClick={() => {
                            setEditText(override || '')
                            setEditingOverride({ user, scoreType: st })
                          }}
                          style={{
                            ...adminButtonStyle,
                            padding: '2px 6px',
                            fontSize: 9,
                            color: override ? palette.ok : palette.fgDim,
                            borderColor: override ? palette.ok : palette.fgDim,
                          }}
                        >
                          {override ? '✓' : '—'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Default Modal */}
      {editingDefault && (
        <AdminModal open title={`EDIT ${editingDefault.toUpperCase()} TOOLTIP`} onClose={() => setEditingDefault(null)}>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={3}
            style={styles.textarea}
            placeholder="Enter tooltip text (1-2 sentences)"
          />
          <div style={styles.actions}>
            <button onClick={() => setEditingDefault(null)} style={{ ...adminButtonStyle, color: palette.fgDim }}>
              CANCEL
            </button>
            <button onClick={handleSaveDefault} style={adminButtonStyle}>
              SAVE
            </button>
          </div>
        </AdminModal>
      )}

      {/* Edit Override Modal */}
      {editingOverride && (
        <AdminModal
          open
          title={`EDIT ${editingOverride.scoreType.toUpperCase()} FOR ${(editingOverride.user.username || editingOverride.user.id).toUpperCase()}`}
          onClose={() => setEditingOverride(null)}
        >
          <div style={{ marginBottom: 12, fontSize: 11, color: palette.fgDim }}>
            Default: {getDefaultText(editingOverride.scoreType) || '(none)'}
          </div>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={3}
            style={styles.textarea}
            placeholder="Enter override text (leave empty to use default)"
          />
          <div style={styles.actions}>
            <button onClick={() => setEditingOverride(null)} style={{ ...adminButtonStyle, color: palette.fgDim }}>
              CANCEL
            </button>
            <button onClick={handleSaveOverride} style={adminButtonStyle}>
              SAVE
            </button>
          </div>
        </AdminModal>
      )}
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
  sectionHeader: {
    color: palette.accent,
    fontSize: 12,
    fontFamily: mono,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: `1px solid ${palette.accentSubtle}`,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
  },
  card: {
    border: `1px solid ${palette.accentSubtle}`,
    padding: 12,
    background: palette.panel,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    fontSize: 11,
  },
  cardText: {
    color: palette.fg,
    fontSize: 12,
    fontFamily: mono,
    lineHeight: 1.4,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: mono,
    fontSize: 11,
  },
  th: {
    padding: '8px 4px',
    textAlign: 'left',
    color: palette.fgDim,
    borderBottom: `1px solid ${palette.accentSubtle}`,
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  td: {
    padding: '6px 4px',
    borderBottom: `1px solid ${palette.accentFaint}`,
    color: palette.fg,
  },
  textarea: {
    width: '100%',
    padding: '10px',
    background: palette.panelAlt,
    border: `1px solid ${palette.accentSubtle}`,
    borderRadius: 0,
    color: palette.fg,
    fontFamily: mono,
    fontSize: 12,
    resize: 'vertical',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
}
