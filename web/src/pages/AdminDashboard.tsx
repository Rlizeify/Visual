import { useState, useEffect, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import butterchurnPresets from 'butterchurn-presets'

interface PresetOverride {
  original_name: string
  display_name: string
  updated_at: string
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [presetOverrides, setPresetOverrides] = useState<PresetOverride[]>([])
  const [editingPreset, setEditingPreset] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get all Butterchurn preset keys
  const allPresetKeys = Object.keys(butterchurnPresets.getPresets()).sort()

  // Fetch preset overrides on mount
  useEffect(() => {
    fetchPresetOverrides()
  }, [])

  const fetchPresetOverrides = async () => {
    try {
      const res = await fetch('/api/admin/presets')
      if (res.ok) {
        const data = await res.json()
        setPresetOverrides(data.presets || [])
      }
    } catch {
      // Ignore fetch errors - will show original names
    }
  }

  const getDisplayName = (originalName: string): string => {
    const override = presetOverrides.find(p => p.original_name === originalName)
    return override?.display_name || originalName
  }

  const handleEditStart = (originalName: string) => {
    setEditingPreset(originalName)
    setEditValue(getDisplayName(originalName))
    setError(null)
  }

  const handleEditCancel = () => {
    setEditingPreset(null)
    setEditValue('')
    setError(null)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingPreset || !editValue.trim()) return

    setSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated')
        setSaving(false)
        return
      }

      const res = await fetch('/api/admin/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          original_name: editingPreset,
          display_name: editValue.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      await fetchPresetOverrides()
      setEditingPreset(null)
      setEditValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/admin/login', { replace: true })
  }

  const containerStyle: CSSProperties = {
    width: '100vw',
    minHeight: '100vh',
    background: '#000',
    fontFamily: "'Courier New', Courier, monospace",
    display: 'flex',
    flexDirection: 'column',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #222',
    background: '#0a0a0a',
  }

  const titleStyle: CSSProperties = {
    color: '#ff3333',
    fontSize: '14px',
    fontWeight: 'normal',
    letterSpacing: '0.25em',
    textTransform: 'uppercase',
    margin: 0,
  }

  const signOutStyle: CSSProperties = {
    background: 'transparent',
    border: '1px solid #333',
    color: '#666',
    fontSize: '11px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: "'Courier New', Courier, monospace",
    transition: 'all 0.2s',
  }

  const contentStyle: CSSProperties = {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  }

  const sectionStyle: CSSProperties = {
    marginBottom: '32px',
  }

  const sectionTitleStyle: CSSProperties = {
    color: '#ff3333',
    fontSize: '12px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid #222',
  }

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  }

  const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    color: '#666',
    fontWeight: 'normal',
    borderBottom: '1px solid #222',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  }

  const tdStyle: CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid #111',
    color: '#888',
  }

  const inputStyle: CSSProperties = {
    background: '#111',
    border: '1px solid #333',
    color: '#ccc',
    padding: '6px 8px',
    fontSize: '12px',
    fontFamily: "'Courier New', Courier, monospace",
    width: '100%',
    maxWidth: '300px',
  }

  const btnSmallStyle: CSSProperties = {
    background: 'transparent',
    border: '1px solid #333',
    color: '#666',
    fontSize: '10px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontFamily: "'Courier New', Courier, monospace",
    marginLeft: '8px',
  }

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>// ADMIN CONSOLE</h1>
        <button
          onClick={handleSignOut}
          style={signOutStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#ff3333'
            e.currentTarget.style.color = '#ff3333'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#333'
            e.currentTarget.style.color = '#666'
          }}
        >
          SIGN OUT
        </button>
      </header>

      <div style={contentStyle}>
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Visualizer Presets</h2>
          {error && (
            <div style={{
              color: '#ff3333',
              fontSize: '11px',
              padding: '8px 12px',
              background: 'rgba(255, 51, 51, 0.1)',
              border: '1px solid rgba(255, 51, 51, 0.3)',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Display Name</th>
                  <th style={{ ...thStyle, width: '40%' }}>Original Filename</th>
                  <th style={{ ...thStyle, width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPresetKeys.map(originalName => {
                  const isEditing = editingPreset === originalName
                  const displayName = getDisplayName(originalName)
                  const hasOverride = presetOverrides.some(p => p.original_name === originalName)

                  return (
                    <tr key={originalName}>
                      <td style={tdStyle}>
                        {isEditing ? (
                          <form onSubmit={handleSave} style={{ display: 'flex', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              style={inputStyle}
                              autoFocus
                              disabled={saving}
                            />
                            <button
                              type="submit"
                              style={{ ...btnSmallStyle, color: '#00cc66', borderColor: '#00cc66' }}
                              disabled={saving}
                            >
                              {saving ? '...' : 'SAVE'}
                            </button>
                            <button
                              type="button"
                              onClick={handleEditCancel}
                              style={btnSmallStyle}
                              disabled={saving}
                            >
                              CANCEL
                            </button>
                          </form>
                        ) : (
                          <span style={{ color: hasOverride ? '#00cc66' : '#888' }}>
                            {displayName}
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: '#555', fontSize: '10px' }}>
                        {originalName}
                      </td>
                      <td style={tdStyle}>
                        {!isEditing && (
                          <button
                            onClick={() => handleEditStart(originalName)}
                            style={btnSmallStyle}
                          >
                            RENAME
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
