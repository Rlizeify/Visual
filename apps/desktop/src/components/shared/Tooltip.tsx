import { useState, useRef, useEffect, type ReactNode } from 'react'
import ReactDOM from 'react-dom'

interface TooltipProps {
  text: string
  detail: string
  children: ReactNode
}

export function Tooltip({ text, detail, children }: TooltipProps) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const wrapperRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      if (!wrapperRef.current) return
      const rect = wrapperRef.current.getBoundingClientRect()
      let top = rect.bottom + 8
      let left = rect.left
      if (top + 80 > window.innerHeight) top = rect.top - 88
      if (left + 260 > window.innerWidth) left = Math.max(0, rect.right - 260)
      setPos({ top, left })
      setVisible(true)
    }, 1500)
  }

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div ref={wrapperRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} style={{ display: 'inline-flex' }}>
      {children}
      {visible && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          zIndex: 99999,
          pointerEvents: 'none',
          background: 'rgba(5, 0, 15, 0.95)',
          border: '1px solid rgba(255, 179, 71, 0.4)',
          boxShadow: '0 0 12px rgba(255, 179, 71, 0.2)',
          borderRadius: 4,
          padding: '8px 12px',
          maxWidth: 260,
        }}>
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
