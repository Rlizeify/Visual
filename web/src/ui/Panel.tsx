import type { CSSProperties, ReactNode } from 'react'
import { panel } from '../styles/tokens'

interface PanelProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
}

export default function Panel({ children, style, className }: PanelProps) {
  return (
    <div
      className={className}
      style={{
        background: panel.background,
        backdropFilter: panel.backdropFilter,
        WebkitBackdropFilter: panel.backdropFilter,
        border: panel.border,
        borderRadius: panel.borderRadius,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
