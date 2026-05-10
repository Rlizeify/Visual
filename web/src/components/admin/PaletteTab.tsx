import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { palette, mono } from './theme'

interface Preset {
  id: string
  hex: string
  label: string
  sort_order: number
  active: boolean
}

async function fetchAuthed(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })
}

export default function PaletteTab() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [allowCustomHex, setAllowCustomHex] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newHex, setNewHex] = useState('#00dcc8')
  const [newLabel, setNewLabel] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [presetsRes, settingsRes] = await Promise.all([
        fetchAuthed('/api/admin/scoring?type=palette'),
        fetchAuthed('/api/admin/scoring?type=allow-custom-hex'),
      ])
      const presetsData = await presetsRes.json()
      const settingsData = await settingsRes.json()
      if (!presetsRes.ok) throw new Error(presetsData.error || 'load failed')
      setPresets(presetsData.palette || [])
      setAllowCustomHex(settingsData.allow_custom_hex !== false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(newHex)) {
      setError('Hex must be #RRGGBB')
      return
    }
    if (!newLabel.trim()) {
      setError('Label required')
      return
    }
    const res = await fetchAuthed('/api/admin/scoring?type=palette', {
      method: 'POST',
      body: JSON.stringify({ hex: newHex, label: newLabel.trim(), sort_order: presets.length }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'add failed'); return }
    setNewLabel('')
    load()
  }

  const handlePatch = async (id: string, patch: Partial<Preset>) => {
    const res = await fetchAuthed(`/api/admin/scoring?type=palette&id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'update failed')
      return
    }
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this preset?')) return
    const res = await fetchAuthed(`/api/admin/scoring?type=palette&id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'delete failed')
      return
    }
    load()
  }

  const handleToggleCustom = async (value: boolean) => {
    setAllowCustomHex(value)
    await fetchAuthed('/api/admin/scoring?type=allow-custom-hex', {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    })
  }

  if (loading) {
    return <div style={{ color: palette.fgDim, fontFamily: mono, padding: 16 }}>Loading...</div>
  }

  return (
    <div style={{ padding: 20, fontFamily: mono, color: palette.fg }}>
      <h2 style={{ color: palette.accent, fontSize: 14, letterSpacing: '0.1em', marginBottom: 16 }}>
        &gt; ACCENT COLOR PALETTE
      </h2>

      {error && (
        <div style={{ color: palette.accent, marginBottom: 12, padding: 8, border: `1px solid ${palette.accentSubtle}` }}>
          {error}
        </div>
      )}

      {/* Allow custom hex toggle */}
      <div style={{ marginBottom: 24, padding: 12, border: `1px solid ${palette.fgVeryDim}` }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allowCustomHex}
            onChange={(e) => handleToggleCustom(e.target.checked)}
          />
          <span>Allow users to pick custom hex colors (beyond palette)</span>
        </label>
      </div>

      {/* Add preset */}
      <div style={{ marginBottom: 24, padding: 12, border: `1px solid ${palette.fgVeryDim}` }}>
        <div style={{ marginBottom: 8, fontSize: 11, color: palette.fgDim }}>ADD PRESET</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={newHex}
            onChange={(e) => setNewHex(e.target.value)}
            style={{ width: 40, height: 32, background: 'transparent', border: 'none', cursor: 'pointer' }}
          />
          <input
            type="text"
            value={newHex}
            onChange={(e) => setNewHex(e.target.value)}
            placeholder="#RRGGBB"
            style={{
              background: palette.bg,
              color: palette.fg,
              border: `1px solid ${palette.fgVeryDim}`,
              padding: '6px 10px',
              fontFamily: mono,
              width: 100,
            }}
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Mint)"
            style={{
              background: palette.bg,
              color: palette.fg,
              border: `1px solid ${palette.fgVeryDim}`,
              padding: '6px 10px',
              fontFamily: mono,
              flex: 1,
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              background: palette.accent,
              color: '#000',
              border: 'none',
              padding: '6px 14px',
              fontFamily: mono,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ADD
          </button>
        </div>
      </div>

      {/* Preset table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${palette.accentSubtle}` }}>
            <th style={{ textAlign: 'left', padding: 8, color: palette.fgDim }}>SWATCH</th>
            <th style={{ textAlign: 'left', padding: 8, color: palette.fgDim }}>HEX</th>
            <th style={{ textAlign: 'left', padding: 8, color: palette.fgDim }}>LABEL</th>
            <th style={{ textAlign: 'left', padding: 8, color: palette.fgDim }}>ORDER</th>
            <th style={{ textAlign: 'left', padding: 8, color: palette.fgDim }}>ACTIVE</th>
            <th style={{ textAlign: 'right', padding: 8, color: palette.fgDim }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {presets.map(p => (
            <tr key={p.id} style={{ borderBottom: `1px solid ${palette.fgVeryDim}` }}>
              <td style={{ padding: 8 }}>
                <div style={{ width: 24, height: 24, background: p.hex, border: `1px solid ${palette.fgDim}` }} />
              </td>
              <td style={{ padding: 8, color: palette.fg }}>{p.hex}</td>
              <td style={{ padding: 8 }}>
                <input
                  type="text"
                  defaultValue={p.label}
                  onBlur={(e) => { if (e.target.value !== p.label) handlePatch(p.id, { label: e.target.value }) }}
                  style={{
                    background: 'transparent',
                    color: palette.fg,
                    border: `1px solid ${palette.fgVeryDim}`,
                    padding: '4px 8px',
                    fontFamily: mono,
                  }}
                />
              </td>
              <td style={{ padding: 8 }}>
                <input
                  type="number"
                  defaultValue={p.sort_order}
                  onBlur={(e) => { const v = Number(e.target.value); if (v !== p.sort_order) handlePatch(p.id, { sort_order: v }) }}
                  style={{
                    background: 'transparent',
                    color: palette.fg,
                    border: `1px solid ${palette.fgVeryDim}`,
                    padding: '4px 8px',
                    fontFamily: mono,
                    width: 60,
                  }}
                />
              </td>
              <td style={{ padding: 8 }}>
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) => handlePatch(p.id, { active: e.target.checked })}
                />
              </td>
              <td style={{ padding: 8, textAlign: 'right' }}>
                <button
                  onClick={() => handleDelete(p.id)}
                  style={{
                    background: 'transparent',
                    color: palette.accent,
                    border: `1px solid ${palette.accentSubtle}`,
                    padding: '4px 10px',
                    fontFamily: mono,
                    cursor: 'pointer',
                  }}
                >
                  DELETE
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
