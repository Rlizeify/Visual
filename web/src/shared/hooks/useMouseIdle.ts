import { useCallback, useEffect, useRef, useState } from 'react'

export function useMouseIdle(timeoutMs: number = 3000): boolean {
  const [visible, setVisible] = useState(true)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseMove = useCallback(() => {
    setVisible(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setVisible(false), timeoutMs)
  }, [timeoutMs])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    handleMouseMove()
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [handleMouseMove])

  return visible
}
