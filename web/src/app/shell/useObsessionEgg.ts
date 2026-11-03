// Global keystroke listener: typing the trigger word anywhere (outside
// form fields) opens the hidden page. No prompt, no hint. Only the
// trigger lives in the main bundle — the page itself is a lazy chunk.
// See .claude/memory/decisions/obsession-architecture.md.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const TRIGGER = 'obsession'
const RESET_AFTER_MS = 3000

export function useObsessionEgg(): void {
  const navigate = useNavigate()

  useEffect(() => {
    let buffer = ''
    let lastKeyAt = 0

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return

      const now = Date.now()
      if (now - lastKeyAt > RESET_AFTER_MS) buffer = ''
      lastKeyAt = now
      buffer = (buffer + e.key.toLowerCase()).slice(-TRIGGER.length)
      if (buffer === TRIGGER) {
        buffer = ''
        navigate('/' + TRIGGER)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
