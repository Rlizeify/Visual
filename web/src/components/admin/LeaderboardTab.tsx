import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { palette, mono } from './theme'
import { adminGet, adminPut } from '../../lib/adminApi'
import { adminButtonStyle } from './AdminToolbar'

interface UserRow {
  id: string
  email: string | null
  username: string | null
  display_name: string | null
}

interface SlotRow {
  user_id: string
  position: number
  visible: boolean
  username: string | null
  display_name: string | null
}

export default function LeaderboardTab() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [savedSlots, setSavedSlots] = useState<SlotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersData, lbData] = await Promise.all([
        adminGet<{ users: UserRow[] }>('/api/admin/users'),
        adminGet<{ slots: SlotRow[] }>('/api/admin/leaderboard'),
      ])
      setUsers(usersData.users)
      const sorted = [...lbData.slots].sort((a, b) => a.position - b.position)
      setSlots(sorted)
      setSavedSlots(sorted)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const dirty = useMemo(() => {
    if (slots.length !== savedSlots.length) return true
    for (let i = 0; i < slots.length; i++) {
      const a = slots[i]
      const b = savedSlots[i]
      if (a.user_id !== b.user_id || a.position !== b.position || a.visible !== b.visible) return true
    }
    return false
  }, [slots, savedSlots])

  const usedIds = useMemo(() => new Set(slots.map(s => s.user_id)), [slots])
  const availableUsers = useMemo(
    () => users.filter(u => !usedIds.has(u.id)).sort((a, b) => (a.email ?? '').localeCompare(b.email ?? '')),
    [users, usedIds],
  )

  const visibleCount = slots.filter(s => s.visible).length

  const handleAddUser = (userId: string) => {
    if (!userId) return
    const u = users.find(x => x.id === userId)
    if (!u) return
    setSlots(prev => [
      ...prev,
      {
        user_id: u.id,
        position: prev.length,
        visible: true,
        username: u.username,
        display_name: u.display_name,
      },
    ])
  }

  const handleRemove = (userId: string) => {
    setSlots(prev =>
      prev.filter(s => s.user_id !== userId).map((s, i) => ({ ...s, position: i })),
    )
  }

  const handleToggleVisible = (userId: string) => {
    setSlots(prev => prev.map(s => (s.user_id === userId ? { ...s, visible: !s.visible } : s)))
  }

  const handleReorder = (from: number, to: number) => {
    if (from === to) return
    setSlots(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((s, i) => ({ ...s, position: i }))
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setInfo(null)
    try {
      await adminPut('/api/admin/leaderboard', {
        slots: slots.map((s, i) => ({ user_id: s.user_id, position: i, visible: s.visible })),
      })
      setSavedSlots(slots.map((s, i) => ({ ...s, position: i })))
      setInfo(`saved ${slots.length} slot${slots.length === 1 ? '' : 's'}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setSlots(savedSlots)
    setError(null)
    setInfo(null)
  }

  return (
    <div>
      <div style={styles.note}>
        Drag rows to reorder. Toggle <strong>visible</strong> to show/hide a user on the public <code>/u</code> leaderboard.
        Removing a user only deletes their <code>leaderboard_config</code> row — their profile and scores are untouched.
      </div>

      <div style={styles.headerRow}>
        <div style={styles.statusGroup}>
          {loading ? (
            <span style={styles.statusItem}>loading…</span>
          ) : (
            <>
              <span style={styles.statusItem}>{slots.length} slot{slots.length === 1 ? '' : 's'}</span>
              <span style={styles.statusItem}>
                <span style={{ color: visibleCount > 0 ? palette.ok : palette.fgDim }}>{visibleCount}</span> visible
              </span>
              {dirty && <span style={{ ...styles.statusItem, color: palette.warn }}>● unsaved changes</span>}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {dirty && (
            <button onClick={handleDiscard} style={{ ...adminButtonStyle, color: palette.fgDim, borderColor: palette.fgDim }}>
              &gt; DISCARD
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              ...adminButtonStyle,
              opacity: !dirty || saving ? 0.4 : 1,
              cursor: !dirty || saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '…' : '> SAVE'}
          </button>
        </div>
      </div>

      {info && <div style={styles.infoBanner}>OK: {info}</div>}
      {error && <div style={styles.errorBanner}>ERR: {error}</div>}

      <SlotList slots={slots} onReorder={handleReorder} onToggleVisible={handleToggleVisible} onRemove={handleRemove} />

      <div style={styles.addRow}>
        <span style={styles.addLabel}>&gt; ADD USER</span>
        <select
          value=""
          onChange={e => {
            handleAddUser(e.target.value)
            e.target.value = ''
          }}
          style={styles.select}
          disabled={availableUsers.length === 0}
        >
          <option value="">{availableUsers.length === 0 ? 'all users on leaderboard' : 'pick a user…'}</option>
          {availableUsers.map(u => (
            <option key={u.id} value={u.id}>
              {(u.email ?? u.id.slice(0, 8)) + (u.username ? ` · @${u.username}` : '')}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

interface SlotListProps {
  slots: SlotRow[]
  onReorder: (from: number, to: number) => void
  onToggleVisible: (userId: string) => void
  onRemove: (userId: string) => void
}

function SlotList({ slots, onReorder, onToggleVisible, onRemove }: SlotListProps) {
  const dragSource = useRef<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (slots.length === 0) {
    return (
      <div style={styles.empty}>
        no leaderboard slots — add users below
      </div>
    )
  }

  return (
    <ul style={styles.list}>
      {slots.map((slot, i) => {
        const isHovered = hoverIndex === i
        const isDragging = dragSource.current === i
        return (
          <li
            key={slot.user_id}
            draggable
            onDragStart={() => {
              dragSource.current = i
            }}
            onDragOver={e => {
              e.preventDefault()
              setHoverIndex(i)
            }}
            onDragLeave={() => setHoverIndex(null)}
            onDrop={e => {
              e.preventDefault()
              const from = dragSource.current
              dragSource.current = null
              setHoverIndex(null)
              if (from !== null) onReorder(from, i)
            }}
            onDragEnd={() => {
              dragSource.current = null
              setHoverIndex(null)
            }}
            style={{
              ...styles.slot,
              opacity: isDragging ? 0.4 : slot.visible ? 1 : 0.55,
              borderColor: isHovered ? palette.accent : palette.accentSubtle,
              background: isHovered ? palette.rowHover : palette.panel,
            }}
          >
            <span style={styles.dragHandle} aria-hidden>
              ⋮⋮
            </span>
            <span style={styles.position}>#{i + 1}</span>
            <span style={styles.user}>
              <span style={{ color: slot.visible ? palette.fg : palette.fgDim }}>
                {slot.username ?? slot.display_name ?? slot.user_id.slice(0, 8)}
              </span>
              {slot.username && slot.display_name && (
                <span style={{ color: palette.fgDim, marginLeft: 6 }}>· {slot.display_name}</span>
              )}
            </span>
            <label style={styles.visibleToggle}>
              <input
                type="checkbox"
                checked={slot.visible}
                onChange={() => onToggleVisible(slot.user_id)}
                style={styles.checkbox}
              />
              <span style={styles.visibleLabel}>visible</span>
            </label>
            <button
              onClick={() => onRemove(slot.user_id)}
              style={styles.removeBtn}
              aria-label="Remove from leaderboard"
              title="Remove from leaderboard"
            >
              ×
            </button>
          </li>
        )
      })}
    </ul>
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
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottom: `1px solid ${palette.accentSubtle}`,
    marginBottom: 12,
  },
  statusGroup: {
    display: 'flex',
    gap: 18,
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.08em',
  },
  statusItem: {
    color: palette.fgDim,
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
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  slot: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    border: `1px solid ${palette.accentSubtle}`,
    background: palette.panel,
    fontFamily: mono,
    fontSize: 12,
    cursor: 'grab',
    transition: 'border-color 80ms linear, background 80ms linear, opacity 80ms linear',
  },
  dragHandle: {
    color: palette.fgDim,
    fontSize: 14,
    letterSpacing: -2,
    cursor: 'grab',
    userSelect: 'none',
  },
  position: {
    color: palette.accent,
    width: 32,
    fontSize: 11,
    letterSpacing: '0.08em',
  },
  user: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  visibleToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  checkbox: {
    width: 14,
    height: 14,
    accentColor: palette.accent,
    cursor: 'pointer',
  },
  visibleLabel: {
    color: palette.fgDim,
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  removeBtn: {
    background: 'transparent',
    color: palette.accent,
    border: `1px solid ${palette.accentSubtle}`,
    borderRadius: 0,
    width: 26,
    height: 26,
    fontFamily: mono,
    fontSize: 16,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  empty: {
    border: `1px dashed ${palette.accentSubtle}`,
    padding: '24px 16px',
    textAlign: 'center',
    color: palette.fgDim,
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  addRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTop: `1px solid ${palette.accentSubtle}`,
  },
  addLabel: {
    color: palette.fgDim,
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.16em',
  },
  select: {
    background: palette.panelAlt,
    color: palette.fg,
    border: `1px solid ${palette.accentSubtle}`,
    borderRadius: 0,
    padding: '6px 10px',
    fontFamily: mono,
    fontSize: 12,
    minWidth: 280,
    cursor: 'pointer',
  },
}
