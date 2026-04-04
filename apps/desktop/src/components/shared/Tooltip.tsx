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
  const posRef = useRef({ top: 0, left: 0 })
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current)
      fadeTimer.current = null
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let top = rect.bottom + 8
    let left = rect.left
    if (top + 80 > window.innerHeight) top = rect.top - 88
    if (left + 260 > window.innerWidth) left = Math.max(0, rect.right - 260)
    posRef.current = { top, left }
    hoverTimer.current = setTimeout(() => {
      setFading(false)
      setVisible(true)
    }, 1500)
  }, [])

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
    top: posRef.current.top,
    left: posRef.current.left,
    zIndex: 99999,
    pointerEvents: 'none',
    background: 'rgba(5, 0, 15, 0.95)',
    border: '1px solid rgba(255, 179, 71, 0.4)',
    boxShadow: '0 0 12px rgba(255, 179, 71, 0.2)',
    borderRadius: 4,
    padding: '8px 12px',
    maxWidth: 260,
    opacity: fading ? 0 : 1,
    transition: fading ? 'opacity 150ms ease' : 'opacity 200ms ease',
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
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
