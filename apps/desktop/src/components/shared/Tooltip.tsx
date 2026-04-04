import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import ReactDOM from 'react-dom'

interface TooltipProps {
  text: string
  detail: string
  children: ReactNode
}

export function Tooltip({ text, detail, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [fading, setFading] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean }>({ top: 0, left: 0, above: false })
  const wrapRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const viewW = window.innerWidth
    const viewH = window.innerHeight
    let top = rect.bottom + 8
    let left = rect.left
    let above = false

    // If would overflow bottom, flip above
    if (top + 80 > viewH) {
      top = rect.top - 88
      above = true
    }

    // If would overflow right, shift left
    if (left + 260 > viewW) {
      left = rect.right - 260
    }

    setPos({ top, left, above })
    setFading(false)
    setVisible(true)
  }, [])

  const hide = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
    if (visible) {
      setFading(true)
      fadeTimer.current = setTimeout(() => {
        setVisible(false)
        setFading(false)
      }, 150)
    }
  }, [visible])

  const onMouseEnter = useCallback(() => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current)
      fadeTimer.current = null
    }
    hoverTimer.current = setTimeout(show, 1500)
  }, [show])

  const onMouseLeave = useCallback(() => {
    hide()
  }, [hide])

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
      if (fadeTimer.current) clearTimeout(fadeTimer.current)
    }
  }, [])

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    top: pos.above ? undefined : pos.top,
    bottom: pos.above ? `${window.innerHeight - pos.top}px` : undefined,
    left: pos.left,
    background: 'rgba(5, 0, 15, 0.95)',
    border: '1px solid rgba(255, 179, 71, 0.4)',
    boxShadow: '0 0 12px rgba(255, 179, 71, 0.2)',
    borderRadius: 4,
    padding: '8px 12px',
    maxWidth: 260,
    zIndex: 99999,
    pointerEvents: 'none',
    opacity: fading ? 0 : 1,
    transition: fading ? 'opacity 150ms ease' : 'opacity 200ms ease',
  }

  return (
    <div
      ref={wrapRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ display: 'contents' }}
    >
      {children}
      {visible &&
        ReactDOM.createPortal(
          <div style={tooltipStyle}>
            <div style={{
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 11,
              color: '#ffb347',
              marginBottom: 2,
            }}>
              {text}
            </div>
            <div style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 12,
              color: '#a0a0b0',
            }}>
              {detail}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
