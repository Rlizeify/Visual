import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import ReactDOM from 'react-dom'

interface TooltipProps {
  text: string
  detail: string
  children: ReactNode
}

export function Tooltip({ text, detail, children }: TooltipProps) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [visible, setVisible] = useState(false)
  const [opacity, setOpacity] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const moveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const showTooltip = useCallback(() => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()

    // Initial position: centered below element
    let top = rect.bottom + 8
    let left = rect.left + rect.width / 2

    setPos({ top, left })
    setVisible(true)
    // Trigger fade-in on next frame
    requestAnimationFrame(() => setOpacity(1))
  }, [])

  const hideTooltip = useCallback(() => {
    clearTimeout(timerRef.current)
    clearTimeout(moveTimerRef.current)
    setVisible(false)
    setOpacity(0)
  }, [])

  const startHoverTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(showTooltip, 1500)
  }, [showTooltip])

  const handleMouseEnter = useCallback(() => {
    startHoverTimer()
  }, [startHoverTimer])

  const handleMouseMove = useCallback(() => {
    // Reset the 1500ms timer on every mouse movement
    if (!visible) {
      clearTimeout(timerRef.current)
      startHoverTimer()
    }
  }, [visible, startHoverTimer])

  const handleMouseLeave = useCallback(() => {
    hideTooltip()
  }, [hideTooltip])

  // Reposition after render to handle viewport overflow
  useEffect(() => {
    if (!visible || !tooltipRef.current || !wrapperRef.current) return
    const tt = tooltipRef.current.getBoundingClientRect()
    const rect = wrapperRef.current.getBoundingClientRect()
    let { top, left } = pos

    // If overflows bottom, place above
    if (top + tt.height > window.innerHeight) {
      top = rect.top - tt.height - 8
    }

    // Center horizontally: left is currently the center point
    let adjustedLeft = left - tt.width / 2

    // Clamp to viewport
    if (adjustedLeft + tt.width > window.innerWidth - 8) {
      adjustedLeft = window.innerWidth - tt.width - 8
    }
    if (adjustedLeft < 8) {
      adjustedLeft = 8
    }

    // Only update if changed to avoid loop
    if (adjustedLeft !== pos.left || top !== pos.top) {
      setPos({ top, left: adjustedLeft })
    }
  }, [visible, pos])

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(moveTimerRef.current)
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {visible && ReactDOM.createPortal(
        <div ref={tooltipRef} style={{
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
          maxWidth: 250,
          opacity,
          transition: 'opacity 150ms ease',
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
            fontFamily: "'Hitmarker Text', system-ui, sans-serif",
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
