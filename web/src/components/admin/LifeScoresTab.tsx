import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminTable, { type Column } from './AdminTable'
import AdminToolbar, { adminButtonStyle } from './AdminToolbar'
import { palette, mono } from './theme'
import { adminGet } from '../../lib/adminApi'

interface ScoreRow {
  user_id: string
  username: string | null
  display_name: string | null
  position_score: number | null
  velocity_score: number | null
  acceleration_score: number | null
  jerk_score: number | null
  snap_score: number | null
  prestige_tier: number
  is_prestige: boolean
  updated_at: string
}

export default function LifeScoresTab() {
  // [theme-diag] INV2 S6 — temporary; removed after diagnosis.
  // When the URL carries ?debug=throw-theme, deliberately throw during
  // render so we can observe whether ThemeErrorBoundary fires and what
  // the cascade does to AdminDashboard's tab useState. Gated tightly so
  // a prod user with no flag never sees this.
  console.log('[theme-diag] LifeScoresTab render START', { at: new Date().toISOString() })
  if (typeof window !== 'undefined' && window.location.search.includes('debug=throw-theme')) {
    console.log('[theme-diag] LifeScoresTab THROWING (debug=throw-theme flag set)')
    throw new Error('[theme-diag] deliberate throw from LifeScoresTab for boundary cascade test')
  }
  const [rows, setRows] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminGet<{ scores: ScoreRow[] }>('/api/admin/scoring?type=scores')
      setRows(data.scores)
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
      [r.username, r.display_name, r.user_id]
        .filter((v): v is string => typeof v === 'string')
        .some(v => v.toLowerCase().includes(q)),
    )
  }, [rows, search])

  const columns: Column<ScoreRow>[] = [
    {
      key: 'user',
      header: 'user',
      render: r => (
        <span style={{ color: palette.fg }}>
          {r.username ?? r.display_name ?? (
            <span style={{ color: palette.fgVeryDim }}>
              {r.user_id ? `${r.user_id.slice(0, 8)}…` : '(unknown)'}
            </span>
          )}
        </span>
      ),
      sortValue: r => r.username ?? r.display_name ?? r.user_id ?? '',
    },
    {
      key: 'position',
      header: 'position',
      align: 'right',
      render: r => formatNum(r.position_score),
      sortValue: r => r.position_score ?? 0,
    },
    {
      key: 'velocity',
      header: 'velocity',
      align: 'right',
      render: r => formatNum(r.velocity_score),
      sortValue: r => r.velocity_score ?? 0,
    },
    {
      key: 'acceleration',
      header: 'accel',
      align: 'right',
      render: r => formatNum(r.acceleration_score),
      sortValue: r => r.acceleration_score ?? 0,
    },
    {
      key: 'jerk',
      header: 'jerk',
      align: 'right',
      render: r => formatNum(r.jerk_score),
      sortValue: r => r.jerk_score ?? 0,
    },
    {
      key: 'snap',
      header: 'snap',
      align: 'right',
      render: r => formatNum(r.snap_score),
      sortValue: r => r.snap_score ?? 0,
    },
    {
      key: 'prestige',
      header: 'prestige',
      align: 'center',
      render: r => (
        <span style={{ color: r.is_prestige ? palette.accent : palette.fgVeryDim }}>
          {r.is_prestige ? `T${r.prestige_tier}` : '—'}
        </span>
      ),
      sortValue: r => r.prestige_tier,
    },
    {
      key: 'updated_at',
      header: 'updated',
      render: r => new Date(r.updated_at).toLocaleString(),
      sortValue: r => r.updated_at,
    },
  ]

  return (
    <div>
      <div style={styles.note}>
        View user scores computed by the scoring engine. Scores are recomputed every 5 minutes via cron job.
        Edit field weights in the <strong>Scoring</strong> tab to adjust how scores are calculated.
      </div>

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="filter by username, display name…"
        status={<span>{loading ? 'loading…' : `${filtered.length}/${rows.length} users`}</span>}
        actions={
          <button onClick={refresh} style={adminButtonStyle}>
            &gt; REFRESH
          </button>
        }
      />

      {error && <div style={styles.errorBanner}>ERR: {error}</div>}

      <AdminTable
        rows={filtered}
        columns={columns}
        rowKey={r => r.user_id}
        emptyMessage={loading ? 'loading…' : 'no scores yet — users need to connect Spotify and wait for cron'}
        defaultSortKey="position"
        defaultSortDir="desc"
      />
    </div>
  )
}

function formatNum(n: number | null): string {
  if (n === null) return '—'
  if (Math.abs(n) >= 1000) return n.toFixed(0)
  if (Math.abs(n) >= 1) return n.toFixed(2)
  return n.toFixed(4)
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
}
