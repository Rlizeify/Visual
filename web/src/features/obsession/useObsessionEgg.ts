// Easter-egg keystroke listener for Obsession.
//
// Mounted from App.tsx after auth resolves. Watches for the literal
// "obsession" being typed anywhere on the page that ISN'T an input,
// textarea, or contentEditable element. On match, navigates to
// /obsession.
//
// Buffer is reset after 3 seconds of no input so partial matches
// don't accumulate forever. Buffer is also reset on every
// successful match.
//
// See `.claude/memory/decisions/obsession-architecture.md` for the
// rationale — it's a real feature, hidden by design.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const TRIGGER = 'obsession'
const BUFFER_SIZE = TRIGGER.length
const RESET_AFTER_MS = 3000

export function useObsessionEgg(): void {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    let buffer = ''
    let lastKeyAt = 0

    const handler = (e: KeyboardEvent) => {
      // Skip modifier-only or system-shortcut events.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // Skip non-printable keys.
      if (e.key.length !== 1) return
      // Skip when typing into a form field.
      const ae = document.activeElement as HTMLElement | null
      if (ae) {
        const tag = ae.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (ae.isContentEditable) return
      }

      const now = Date.now()
      if (now - lastKeyAt > RESET_AFTER_MS) buffer = ''
      lastKeyAt = now

      buffer += e.key.toLowerCase()
      if (buffer.length > BUFFER_SIZE) {
        buffer = buffer.slice(-BUFFER_SIZE)
      }
      if (buffer === TRIGGER) {
        buffer = ''
        navigate('/obsession')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user, navigate])
}
