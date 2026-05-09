import type { ReactNode } from 'react'
import { palette, mono } from './theme'

interface Props {
  search: string
  onSearchChange: (v: string) => void
  placeholder?: string
  /** Right-side action buttons */
  actions?: ReactNode
  /** Left-side status badges (record count, last refresh, etc.) */
  status?: ReactNode
}

export default function AdminToolbar({ search, onSearchChange, placeholder = 'filter…', actions, status }: Props) {
  return (
    <div style={styles.row}>
      <div style={styles.searchWrap}>
        <span style={styles.prompt}>&gt;</span>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={placeholder}
          style={styles.input}
        />
      </div>
      {status && <div style={styles.status}>{status}</div>}
      {actions && <div style={styles.actions}>{actions}</div>}
    </div>
  )
}

export const adminButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: palette.accent,
  border: `1px solid ${palette.accent}`,
  borderRadius: 0,
  padding: '6px 12px',
  fontFamily: mono,
  fontSize: 11,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottom: `1px solid ${palette.accentSubtle}`,
    marginBottom: 12,
  },
  searchWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${palette.accentSubtle}`,
    background: palette.panelAlt,
    padding: '4px 10px',
    minWidth: 220,
  },
  prompt: {
    color: palette.accent,
    fontFamily: mono,
    fontSize: 12,
  },
  input: {
    flex: 1,
    background: 'transparent',
    color: palette.fg,
    border: 'none',
    outline: 'none',
    fontFamily: mono,
    fontSize: 12,
    padding: '4px 0',
  },
  status: {
    color: palette.fgDim,
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.08em',
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
}
