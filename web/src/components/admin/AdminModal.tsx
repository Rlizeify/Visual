import { useEffect, type ReactNode } from 'react'
import { palette, mono } from './theme'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
}

export default function AdminModal({ open, title, onClose, children, width = 480 }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{ ...styles.frame, maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        <div style={styles.header}>
          <span style={styles.bracket}>[</span>
          <span style={styles.title}>{title}</span>
          <span style={styles.bracket}>]</span>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">
            ×
          </button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    fontFamily: mono,
    padding: 24,
  },
  frame: {
    width: '100%',
    background: palette.panel,
    border: `1px solid ${palette.accent}`,
    borderRadius: 0,
    color: palette.fg,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '90vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    borderBottom: `1px solid ${palette.accentSubtle}`,
    background: palette.bg,
  },
  bracket: { color: palette.accentDim },
  title: {
    color: palette.accent,
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    flex: 1,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: palette.accent,
    fontSize: 22,
    cursor: 'pointer',
    padding: 0,
    width: 28,
    height: 28,
    fontFamily: mono,
  },
  body: {
    padding: 20,
    overflowY: 'auto',
  },
}
