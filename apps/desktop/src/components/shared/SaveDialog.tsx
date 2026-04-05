/* SaveDialog.tsx — themed in-app save dialog */

import { useState, useRef, useEffect } from 'react'

interface Props {
  defaultName: string
  onSave: (name: string) => void
  onCancel: () => void
}

export default function SaveDialog({ defaultName, onSave, onCancel }: Props) {
  const [name, setName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && name.trim()) onSave(name.trim())
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [name, onSave, onCancel])

  return (
    <div className="save-dialog__overlay" onClick={onCancel}>
      <div className="save-dialog__card" onClick={e => e.stopPropagation()}>
        <h2 className="save-dialog__title">SAVE PROJECT</h2>
        <input
          ref={inputRef}
          className="save-dialog__input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Project name..."
          autoFocus
        />
        <div className="save-dialog__actions">
          <button className="save-dialog__btn save-dialog__btn--primary"
            onClick={() => name.trim() && onSave(name.trim())} disabled={!name.trim()}>SAVE</button>
          <button className="save-dialog__btn save-dialog__btn--dim" onClick={onCancel}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
