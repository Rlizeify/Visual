import { useState } from 'react'
import AdminModal from './AdminModal'
import { palette, mono } from './theme'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  /** When set, the user must type this string before confirm is enabled. */
  requireTypedConfirmation?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  destructive = true,
  requireTypedConfirmation,
  onConfirm,
  onCancel,
}: Props) {
  const [typed, setTyped] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const ready = requireTypedConfirmation ? typed === requireTypedConfirmation : true

  const handleConfirm = async () => {
    if (!ready || submitting) return
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
      setTyped('')
    }
  }

  const handleCancel = () => {
    setTyped('')
    onCancel()
  }

  return (
    <AdminModal open={open} title={title} onClose={handleCancel} width={480}>
      <p style={styles.message}>{message}</p>

      {requireTypedConfirmation && (
        <label style={styles.typedLabel}>
          <span style={styles.typedHint}>
            type <strong style={{ color: palette.accent }}>{requireTypedConfirmation}</strong> to confirm
          </span>
          <input
            type="text"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            autoFocus
            style={styles.input}
          />
        </label>
      )}

      <div style={styles.actions}>
        <button onClick={handleCancel} style={styles.cancelBtn} disabled={submitting}>
          &gt; {cancelLabel}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!ready || submitting}
          style={{
            ...styles.confirmBtn,
            opacity: !ready || submitting ? 0.4 : 1,
            cursor: !ready || submitting ? 'not-allowed' : 'pointer',
            color: destructive ? palette.accent : palette.ok,
            borderColor: destructive ? palette.accent : palette.ok,
          }}
        >
          {submitting ? '…' : `> ${confirmLabel}`}
        </button>
      </div>
    </AdminModal>
  )
}

const styles: Record<string, React.CSSProperties> = {
  message: {
    fontSize: 13,
    color: palette.fg,
    marginBottom: 16,
    lineHeight: 1.5,
  },
  typedLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 16,
  },
  typedHint: {
    fontSize: 11,
    color: palette.fgDim,
    letterSpacing: '0.08em',
  },
  input: {
    background: palette.panelAlt,
    color: palette.fg,
    border: `1px solid ${palette.accentSubtle}`,
    borderRadius: 0,
    padding: '8px 10px',
    fontFamily: mono,
    fontSize: 13,
    outline: 'none',
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'transparent',
    color: palette.fgDim,
    border: `1px solid ${palette.fgDim}`,
    borderRadius: 0,
    padding: '8px 14px',
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  confirmBtn: {
    background: 'transparent',
    border: `1px solid ${palette.accent}`,
    borderRadius: 0,
    padding: '8px 14px',
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
}
