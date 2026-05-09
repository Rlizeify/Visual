import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { palette, mono } from './theme'
import AdminTable, { type Column } from './AdminTable'
import AdminModal from './AdminModal'
import AdminToolbar from './AdminToolbar'
import butterchurnPresets from 'butterchurn-presets'

interface PresetRow {
  original_name: string
  display_name: string
  updated_at: string | null
}

const columns: Column<PresetRow>[] = [
  { key: 'original_name', header: 'Original Name' },
  { key: 'display_name', header: 'Display Name' },
  { key: 'updated_at', header: 'Updated' },
]

export default function PresetsTab() {
  const [presets, setPresets] = useState<PresetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editRow, setEditRow] = useState<PresetRow | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPresets = async () => {
    setLoading(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      const res = await fetch('/api/admin/presets', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const data = await res.json()
      const overrides = data.presets || []

      // Merge butterchurn presets with overrides
      const allPresetKeys = Object.keys(butterchurnPresets.getPresets())
      const merged: PresetRow[] = allPresetKeys.map(key => {
        const override = overrides.find((o: PresetRow) => o.original_name === key)
        return {
          original_name: key,
          display_name: override?.display_name || key,
          updated_at: override?.updated_at || null,
        }
      })
      setPresets(merged)
    } catch (err) {
      console.error('[presets] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPresets()
  }, [])

  const filtered = presets.filter(p =>
    p.original_name.toLowerCase().includes(search.toLowerCase()) ||
    p.display_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleRowClick = (row: PresetRow) => {
    setEditRow(row)
    setEditName(row.display_name)
  }

  const handleSave = async () => {
    if (!editRow) return
    setSaving(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          original_name: editRow.original_name,
          display_name: editName,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save')
      }

      setEditRow(null)
      fetchPresets()
    } catch (err) {
      console.error('[presets] save error:', err)
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!editRow) return
    if (!confirm(`Reset "${editRow.original_name}" to its default name?`)) return
    setSaving(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/presets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ original_name: editRow.original_name }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to reset')
      }

      setEditRow(null)
      fetchPresets()
    } catch (err) {
      console.error('[presets] reset error:', err)
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search presets..."
        status={loading ? 'Loading...' : `${filtered.length} preset${filtered.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={fetchPresets} style={styles.refreshBtn}>
            REFRESH
          </button>
        }
      />

      <AdminTable
        rows={filtered}
        columns={columns}
        rowKey={(row) => row.original_name}
        onRowClick={handleRowClick}
        emptyMessage="No presets found"
      />

      <AdminModal open={!!editRow} title="Edit Preset" onClose={() => setEditRow(null)}>
          <div style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Original Name</label>
              <div style={styles.readOnly}>{editRow?.original_name}</div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={styles.input}
                autoFocus
              />
            </div>
            <div style={styles.actions}>
              <button onClick={handleReset} style={styles.resetBtn} disabled={saving}>
                RESET TO DEFAULT
              </button>
              <button onClick={handleSave} style={styles.saveBtn} disabled={saving || !editName.trim()}>
                {saving ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>
        </AdminModal>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  refreshBtn: {
    background: 'transparent',
    color: palette.accent,
    border: `1px solid ${palette.accent}`,
    borderRadius: 0,
    padding: '6px 12px',
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: '0.16em',
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 10,
    letterSpacing: '0.16em',
    color: palette.fgDim,
    textTransform: 'uppercase',
  },
  readOnly: {
    fontSize: 12,
    color: palette.fg,
    padding: '8px 10px',
    background: palette.bg,
    border: `1px solid ${palette.accentSubtle}`,
    fontFamily: mono,
  },
  input: {
    fontSize: 12,
    color: palette.fg,
    padding: '8px 10px',
    background: palette.bg,
    border: `1px solid ${palette.accentDim}`,
    fontFamily: mono,
    outline: 'none',
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  resetBtn: {
    background: 'transparent',
    color: palette.fgDim,
    border: `1px solid ${palette.fgDim}`,
    borderRadius: 0,
    padding: '8px 14px',
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: '0.16em',
    cursor: 'pointer',
  },
  saveBtn: {
    background: palette.accent,
    color: palette.bg,
    border: 'none',
    borderRadius: 0,
    padding: '8px 14px',
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: '0.16em',
    cursor: 'pointer',
  },
}
