import { useMemo, useState, type ReactNode } from 'react'
import { palette, mono } from './theme'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortValue?: (row: T) => string | number | null | undefined
  width?: string
  align?: 'left' | 'right' | 'center'
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  defaultSortKey?: string
  defaultSortDir?: 'asc' | 'desc'
}

export default function AdminTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  emptyMessage = 'no rows',
  defaultSortKey,
  defaultSortDir = 'asc',
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    const col = columns.find(c => c.key === sortKey)
    if (!col) return rows
    const valOf = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[sortKey] as string | number | null | undefined)
    const sorted = [...rows].sort((a, b) => {
      const av = valOf(a)
      const bv = valOf(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return av - bv
      return String(av).localeCompare(String(bv))
    })
    return sortDir === 'asc' ? sorted : sorted.reverse()
  }, [rows, columns, sortKey, sortDir])

  const handleHeaderClick = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map(col => {
              const active = sortKey === col.key
              return (
                <th
                  key={col.key}
                  onClick={() => handleHeaderClick(col.key)}
                  style={{
                    ...styles.th,
                    width: col.width,
                    textAlign: col.align ?? 'left',
                    cursor: 'pointer',
                    color: active ? palette.accent : palette.fgDim,
                  }}
                >
                  {col.header}
                  <span style={styles.sortIndicator}>
                    {active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, i) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  ...styles.tr,
                  background: i % 2 === 1 ? palette.rowStripe : 'transparent',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
                onMouseEnter={e => {
                  if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = palette.rowHover
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 1 ? palette.rowStripe : 'transparent'
                }}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    style={{
                      ...styles.td,
                      textAlign: col.align ?? 'left',
                    }}
                  >
                    {col.render
                      ? col.render(row)
                      : ((row as Record<string, unknown>)[col.key] as ReactNode) ?? <span style={{ color: palette.fgVeryDim }}>—</span>}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    width: '100%',
    overflowX: 'auto',
    border: `1px solid ${palette.accentSubtle}`,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: mono,
    fontSize: 12,
    color: palette.fg,
  },
  th: {
    padding: '8px 12px',
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontWeight: 600,
    borderBottom: `1px solid ${palette.accentSubtle}`,
    background: palette.panel,
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  sortIndicator: {
    fontSize: 9,
    marginLeft: 2,
  },
  tr: {
    transition: 'background 60ms linear',
  },
  td: {
    padding: '6px 12px',
    fontSize: 12,
    borderBottom: `1px solid rgba(255, 255, 255, 0.04)`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 280,
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: palette.fgDim,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
}
