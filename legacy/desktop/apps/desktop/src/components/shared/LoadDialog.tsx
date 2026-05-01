/* LoadDialog.tsx — themed in-app load dialog with project list */

import { useState, useEffect } from 'react'

interface ProjectRow {
  id: number
  name: string
  created_at: string
  updated_at: string
}

interface Props {
  projects: ProjectRow[]
  onLoad: (id: number) => void
  onDelete: (id: number) => void
  onCancel: () => void
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'Z')
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

export default function LoadDialog({ projects, onLoad, onDelete, onCancel }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="load-dialog__overlay" onClick={onCancel}>
      <div className="load-dialog__card" onClick={e => e.stopPropagation()}>
        <h2 className="load-dialog__title">LOAD PROJECT</h2>
        {projects.length === 0 ? (
          <div className="load-dialog__empty">No saved projects</div>
        ) : (
          <div className="load-dialog__list">
            {projects.map(p => (
              <div key={p.id}
                className={`load-dialog__item${selected === p.id ? ' load-dialog__item--selected' : ''}`}
                onClick={() => setSelected(p.id)}
                onDoubleClick={() => onLoad(p.id)}>
                <div className="load-dialog__item-info">
                  <span className="load-dialog__item-name">{p.name}</span>
                  <span className="load-dialog__item-date">{formatDate(p.updated_at)}</span>
                </div>
                {confirmId === p.id ? (
                  <div className="load-dialog__confirm">
                    <span className="load-dialog__confirm-text">Delete?</span>
                    <button className="load-dialog__confirm-btn load-dialog__confirm-btn--yes"
                      onClick={e => { e.stopPropagation(); onDelete(p.id); setConfirmId(null) }}>YES</button>
                    <button className="load-dialog__confirm-btn"
                      onClick={e => { e.stopPropagation(); setConfirmId(null) }}>NO</button>
                  </div>
                ) : (
                  <button className="load-dialog__delete"
                    onClick={e => { e.stopPropagation(); setConfirmId(p.id) }}
                    title="Delete project">x</button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="load-dialog__actions">
          <button className="save-dialog__btn save-dialog__btn--primary"
            onClick={() => selected != null && onLoad(selected)} disabled={selected == null}>LOAD</button>
          <button className="save-dialog__btn save-dialog__btn--dim" onClick={onCancel}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}
