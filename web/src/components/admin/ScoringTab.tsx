import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminToolbar, { adminButtonStyle } from './AdminToolbar'
import { palette, mono } from './theme'
import { adminGet, adminPatch, adminPost } from '../../lib/adminApi'

interface FieldData {
  fieldId: string
  displayName: string
  description: string
  unit: string
  dataType: string
  sparsityClass: string
  expectedRange: [number, number]
  inactive: boolean
  connectorId: string
  connectorName: string
  connectorActive: boolean
  defaultWeight: number
  defaultEffortMultiplier: number
  weight: number
  effortMultiplier: number | null
  dbRowId: string | null
}

interface ConnectorData {
  id: string
  displayName: string
  isActive: boolean
  fieldCount: number
}

interface PreviewData {
  position: number
  velocity: number | null
  acceleration: number | null
  jerk: number | null
  snap: number | null
  rawScore: number
  prestigeTier: number
}

const SPARSITY_BADGES: Record<string, { label: string; color: string }> = {
  passive: { label: 'PASSIVE', color: '#4CAF50' },
  'semi-active': { label: 'SEMI', color: '#FF9800' },
  active: { label: 'ACTIVE', color: '#f44336' },
}

const equationStyles: Record<string, React.CSSProperties> = {
  container: {
    background: palette.panelAlt,
    border: `1px solid ${palette.accentSubtle}`,
    padding: 16,
    marginBottom: 24,
    fontFamily: mono,
  },
  title: {
    color: palette.accent,
    fontSize: 12,
    letterSpacing: '0.1em',
    marginBottom: 16,
    marginTop: 0,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    color: palette.fgDim,
    fontSize: 10,
    letterSpacing: '0.05em',
    marginBottom: 4,
  },
  formula: {
    color: palette.fg,
    fontSize: 13,
    lineHeight: 1.6,
  },
  var: {
    color: palette.accent,
    fontStyle: 'italic',
  },
  note: {
    color: palette.fgDim,
    fontSize: 10,
    marginTop: 4,
  },
  dim: {
    color: palette.fgVeryDim,
    fontSize: 11,
  },
  prestige: {
    color: palette.fgDim,
    fontSize: 11,
    borderTop: `1px solid ${palette.accentSubtle}`,
    paddingTop: 12,
    marginTop: 8,
  },
}

export default function ScoringTab() {
  const [fields, setFields] = useState<FieldData[]>([])
  const [connectors, setConnectors] = useState<ConnectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'connector' | 'flat'>('connector')

  // Edit state
  const [pendingChanges, setPendingChanges] = useState<Record<string, { weight?: number; effortMultiplier?: number | null }>>({})

  // Preview state
  const [previewUserId, setPreviewUserId] = useState<string>('')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGet<{ fields: FieldData[]; connectors: ConnectorData[] }>('/api/admin/scoring')
      setFields(data.fields)
      setConnectors(data.connectors)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Group fields by connector
  const groupedFields = useMemo(() => {
    if (groupBy === 'flat') {
      return [{ connectorId: 'all', connectorName: 'All Fields', fields }]
    }
    const groups: Record<string, { connectorName: string; fields: FieldData[] }> = {}
    for (const field of fields) {
      if (!groups[field.connectorId]) {
        groups[field.connectorId] = { connectorName: field.connectorName, fields: [] }
      }
      groups[field.connectorId].fields.push(field)
    }
    return Object.entries(groups).map(([connectorId, g]) => ({
      connectorId,
      connectorName: g.connectorName,
      fields: g.fields,
    }))
  }, [fields, groupBy])

  const handleWeightChange = (fieldId: string, value: number) => {
    setPendingChanges(prev => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], weight: value },
    }))
  }

  const handleEffortChange = (fieldId: string, value: string) => {
    const numVal = value === '' ? null : parseFloat(value)
    setPendingChanges(prev => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], effortMultiplier: numVal },
    }))
  }

  const saveField = async (fieldId: string) => {
    const changes = pendingChanges[fieldId]
    if (!changes) return

    try {
      await adminPatch('/api/admin/scoring', { fieldId, ...changes })
      setPendingChanges(prev => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset all weights to defaults? This cannot be undone.')) return
    try {
      await adminPost('/api/admin/scoring?action=reset', {})
      setPendingChanges({})
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handleSync = async () => {
    try {
      const result = await adminPost<{ synced: number }>('/api/admin/scoring?action=sync', {})
      alert(`Synced ${result.synced} new fields from registry`)
      refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const handlePreview = async () => {
    if (!previewUserId) return
    setPreviewLoading(true)
    try {
      const result = await adminPost<{ scores: PreviewData }>('/api/admin/scoring?action=preview', {
        userId: previewUserId,
        timeScale: 'week',
      })
      setPreviewData(result.scores)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPreviewLoading(false)
    }
  }

  const getDisplayValue = (field: FieldData) => {
    const pending = pendingChanges[field.fieldId]
    return {
      weight: pending?.weight ?? field.weight,
      effortMultiplier: pending?.effortMultiplier !== undefined
        ? pending.effortMultiplier
        : field.effortMultiplier,
    }
  }

  return (
    <div>
      {/* Equation Display */}
      <div style={equationStyles.container}>
        <h3 style={equationStyles.title}>SCORING FORMULA</h3>

        <div style={equationStyles.section}>
          <div style={equationStyles.label}>1. Raw Score</div>
          <div style={equationStyles.formula}>
            rawScore = Σ <span style={equationStyles.var}>normalized<sub>i</sub></span> × <span style={equationStyles.var}>effort<sub>i</sub></span> × <span style={equationStyles.var}>weight<sub>i</sub></span>
          </div>
          <div style={equationStyles.note}>
            where normalized = clamp(value / maxExpected, 0, 1)
          </div>
        </div>

        <div style={equationStyles.section}>
          <div style={equationStyles.label}>2. Position (Soft-Cap Curve)</div>
          <div style={equationStyles.formula}>
            position = {'{'}
            <div style={{ marginLeft: 20 }}>
              rawScore <span style={equationStyles.dim}>if rawScore &lt; 100</span>
            </div>
            <div style={{ marginLeft: 20 }}>
              100 + 100 × (1 − e<sup>−k(rawScore − 100)</sup>) <span style={equationStyles.dim}>if rawScore ≥ 100</span>
            </div>
          </div>
          <div style={equationStyles.note}>
            where k ≈ 0.000046 (soft cap at 100, hard cap at 200)
          </div>
        </div>

        <div style={equationStyles.section}>
          <div style={equationStyles.label}>3. Derivatives</div>
          <div style={equationStyles.formula}>
            velocity = z-score(Δposition / Δtime)
          </div>
          <div style={equationStyles.note}>
            acceleration, jerk, snap follow same pattern on higher-order deltas
          </div>
        </div>

        <div style={equationStyles.prestige}>
          <strong>Prestige Tiers:</strong> T0 (&lt;100) → T1 (100-149) → T2 (150-179) → T3 (180+)
        </div>
      </div>

      <AdminToolbar
        search=""
        onSearchChange={() => {}}
        placeholder=""
        status={
          <span>
            {loading ? 'loading...' : `${fields.length} fields from ${connectors.length} connectors`}
          </span>
        }
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSync} style={adminButtonStyle}>
              &gt; SYNC REGISTRY
            </button>
            <button onClick={handleReset} style={{ ...adminButtonStyle, color: palette.warn }}>
              &gt; RESET ALL
            </button>
            <button onClick={refresh} style={adminButtonStyle}>
              &gt; REFRESH
            </button>
          </div>
        }
      />

      {error && (
        <div style={{ padding: 12, background: 'rgba(255,45,45,0.1)', color: palette.accent, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Grouping toggle */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <label style={{ color: palette.fgDim, fontSize: 11 }}>
          <input
            type="radio"
            checked={groupBy === 'connector'}
            onChange={() => setGroupBy('connector')}
            style={{ marginRight: 4 }}
          />
          GROUP BY CONNECTOR
        </label>
        <label style={{ color: palette.fgDim, fontSize: 11 }}>
          <input
            type="radio"
            checked={groupBy === 'flat'}
            onChange={() => setGroupBy('flat')}
            style={{ marginRight: 4 }}
          />
          FLAT LIST
        </label>
      </div>

      {/* Field groups */}
      {groupedFields.map(group => (
        <div key={group.connectorId} style={{ marginBottom: 24 }}>
          <h3 style={{
            color: palette.accent,
            fontSize: 12,
            letterSpacing: '0.1em',
            marginBottom: 8,
            borderBottom: `1px solid ${palette.accentSubtle}`,
            paddingBottom: 4,
          }}>
            {group.connectorName.toUpperCase()}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {group.fields.map(field => {
              const values = getDisplayValue(field)
              const hasPending = !!pendingChanges[field.fieldId]
              const badge = SPARSITY_BADGES[field.sparsityClass]

              return (
                <div
                  key={field.fieldId}
                  style={{
                    background: field.inactive ? palette.panelAlt : palette.panel,
                    border: `1px solid ${hasPending ? palette.warn : palette.accentSubtle}`,
                    padding: 12,
                    opacity: field.inactive ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <span style={{ color: palette.fg, fontWeight: 600 }}>{field.displayName}</span>
                      <span style={{
                        marginLeft: 8,
                        padding: '2px 6px',
                        background: badge.color,
                        color: '#000',
                        fontSize: 9,
                        fontWeight: 700,
                      }}>
                        {badge.label}
                      </span>
                      {field.inactive && (
                        <span style={{
                          marginLeft: 8,
                          color: palette.fgVeryDim,
                          fontSize: 10,
                        }}>
                          (INACTIVE)
                        </span>
                      )}
                    </div>
                    <span style={{ color: palette.fgDim, fontSize: 10 }}>
                      {field.unit} | [{field.expectedRange[0]}-{field.expectedRange[1]}]
                    </span>
                  </div>

                  <div style={{ color: palette.fgDim, fontSize: 11, marginBottom: 12 }}>
                    {field.description}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Weight slider */}
                    <div style={{ flex: 1 }}>
                      <label style={{ color: palette.fgDim, fontSize: 10, display: 'block', marginBottom: 4 }}>
                        WEIGHT (0-3)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="range"
                          min={0}
                          max={3}
                          step={0.05}
                          value={values.weight}
                          onChange={e => {
                            // Range inputs normally never emit NaN, but defense-
                            // in-depth — the sibling number input already guards
                            // with `|| 0` and we want consistent semantics so a
                            // bad value can never land in pendingChanges.
                            const v = parseFloat(e.target.value)
                            if (Number.isFinite(v)) handleWeightChange(field.fieldId, v)
                          }}
                          style={{ flex: 1 }}
                        />
                        <input
                          type="number"
                          min={0}
                          max={3}
                          step={0.05}
                          value={values.weight}
                          onChange={e => handleWeightChange(field.fieldId, parseFloat(e.target.value) || 0)}
                          style={{
                            width: 60,
                            background: palette.bg,
                            border: `1px solid ${palette.accentSubtle}`,
                            color: palette.fg,
                            fontFamily: mono,
                            fontSize: 11,
                            padding: 4,
                          }}
                        />
                      </div>
                    </div>

                    {/* Effort multiplier */}
                    <div style={{ width: 120 }}>
                      <label style={{ color: palette.fgDim, fontSize: 10, display: 'block', marginBottom: 4 }}>
                        EFFORT MULT.
                      </label>
                      <input
                        type="number"
                        step={0.1}
                        value={values.effortMultiplier ?? ''}
                        placeholder={String(field.defaultEffortMultiplier)}
                        onChange={e => handleEffortChange(field.fieldId, e.target.value)}
                        style={{
                          width: '100%',
                          background: palette.bg,
                          border: `1px solid ${palette.accentSubtle}`,
                          color: palette.fg,
                          fontFamily: mono,
                          fontSize: 11,
                          padding: 4,
                        }}
                      />
                    </div>

                    {/* Save button */}
                    {hasPending && (
                      <button
                        onClick={() => saveField(field.fieldId)}
                        style={{
                          ...adminButtonStyle,
                          background: palette.ok,
                          color: '#000',
                          border: 'none',
                        }}
                      >
                        SAVE
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Preview panel */}
      <div style={{
        marginTop: 32,
        padding: 16,
        background: palette.panelAlt,
        border: `1px solid ${palette.accentSubtle}`,
      }}>
        <h3 style={{ color: palette.accent, fontSize: 12, letterSpacing: '0.1em', marginBottom: 12 }}>
          PREVIEW SCORES
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <input
            type="text"
            placeholder="User ID (UUID)"
            value={previewUserId}
            onChange={e => setPreviewUserId(e.target.value)}
            style={{
              flex: 1,
              background: palette.bg,
              border: `1px solid ${palette.accentSubtle}`,
              color: palette.fg,
              fontFamily: mono,
              fontSize: 11,
              padding: 8,
            }}
          />
          <button
            onClick={handlePreview}
            disabled={!previewUserId || previewLoading}
            style={adminButtonStyle}
          >
            {previewLoading ? 'LOADING...' : '> CALCULATE'}
          </button>
        </div>

        {previewData && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {[
              { key: 'position', label: 'POSITION', value: previewData.position },
              { key: 'velocity', label: 'VELOCITY', value: previewData.velocity },
              { key: 'acceleration', label: 'ACCEL', value: previewData.acceleration },
              { key: 'jerk', label: 'JERK', value: previewData.jerk },
              { key: 'snap', label: 'SNAP', value: previewData.snap },
            ].map(score => (
              <div
                key={score.key}
                style={{
                  background: palette.panel,
                  border: `1px solid ${palette.accentSubtle}`,
                  padding: 12,
                  textAlign: 'center',
                }}
              >
                <div style={{ color: palette.accent, fontSize: 20, fontWeight: 700 }}>
                  {score.value !== null ? score.value.toFixed(2) : '—'}
                </div>
                <div style={{ color: palette.fgDim, fontSize: 9, letterSpacing: '0.1em' }}>
                  {score.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {previewData && (
          <div style={{ marginTop: 12, color: palette.fgDim, fontSize: 10 }}>
            Raw score: {previewData.rawScore.toFixed(2)} | Prestige tier: {previewData.prestigeTier}
          </div>
        )}
      </div>
    </div>
  )
}
