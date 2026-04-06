/* AudioLibrary.tsx — collapsible panel showing previously imported audio files */

import { useState, useEffect, useRef } from 'react'
import { DeckEngine } from './DeckEngine'

interface AudioLibraryEntry {
  id: number
  file_path: string
  file_name: string
  bpm: number | null
  key: string | null
  missing: boolean
}

interface Props {
  engines: DeckEngine[]
  deckLabels: readonly string[]
  selectedDeck: number
}

export default function AudioLibrary({ engines, deckLabels, selectedDeck }: Props) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<AudioLibraryEntry[]>([])
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    const api = (window as any).api
    if (!api?.mediaList) return

    ;(async () => {
      const rows: any[] = await api.mediaList({ mediaType: 'audio' })
      if (!rows || rows.length === 0) return

      const items: AudioLibraryEntry[] = []
      for (const row of rows) {
        const exists: boolean = await api.mediaCheckFile({ filePath: row.file_path })
        const meta = row.metadata_json ? JSON.parse(row.metadata_json) : {}
        items.push({
          id: row.id,
          file_path: row.file_path,
          file_name: row.file_name,
          bpm: meta.bpm ?? null,
          key: meta.key ?? null,
          missing: !exists,
        })
      }
      setEntries(items)
    })()
  }, [])

  const handleLoad = async (entry: AudioLibraryEntry) => {
    if (entry.missing) return
    const engine = engines[selectedDeck]
    if (!engine) return

    await engine.loadFromPath(entry.file_path, entry.file_name, entry.bpm, entry.key)

    // Update last_used
    const api = (window as any).api
    if (api?.mediaUpdateLastUsed) api.mediaUpdateLastUsed({ id: entry.id })
  }

  const handleRemove = async (entry: AudioLibraryEntry) => {
    const api = (window as any).api
    if (api?.mediaRemove) await api.mediaRemove({ id: entry.id })
    setEntries(prev => prev.filter(e => e.id !== entry.id))
  }

  /** Called externally to add a freshly loaded file to the library list */
  const addEntry = (entry: AudioLibraryEntry) => {
    setEntries(prev => {
      if (prev.some(e => e.file_path === entry.file_path)) return prev
      return [entry, ...prev]
    })
  }

  // Expose addEntry via window for DeckChannel to call after load-mp3
  useEffect(() => {
    (window as any).__audioLibraryAdd = addEntry
    return () => { delete (window as any).__audioLibraryAdd }
  }, [])

  if (entries.length === 0 && !open) return null

  return (
    <div className="audio-library">
      <button className="audio-library__toggle" onClick={() => setOpen(v => !v)}>
        AUDIO LIBRARY ({entries.length}) {open ? '\u25B2' : '\u25BC'}
      </button>
      {open && (
        <div className="audio-library__list">
          {entries.length === 0 && (
            <div className="audio-library__empty">No audio files in library</div>
          )}
          {entries.map(e => (
            <div
              key={e.id}
              className={`audio-library__item${e.missing ? ' audio-library__item--missing' : ''}`}
              onClick={() => handleLoad(e)}
              title={e.missing ? `File not found: ${e.file_path}` : `Load into Deck ${deckLabels[selectedDeck]} — ${e.file_path}`}
            >
              <span className="audio-library__name">
                {e.missing && <span className="audio-library__warn">&#9888; </span>}
                {e.file_name}
              </span>
              <span className="audio-library__meta">
                {e.missing
                  ? 'File not found'
                  : `${e.bpm != null ? e.bpm.toFixed(1) + ' BPM' : '---'} | ${e.key ?? '---'}`}
              </span>
              <button
                className="audio-library__remove"
                onClick={(ev) => { ev.stopPropagation(); handleRemove(e) }}
                title="Remove from library"
              >
                x
              </button>
            </div>
          ))}
          <div className="audio-library__hint">
            Click to load into Deck {deckLabels[selectedDeck]}
          </div>
        </div>
      )}
    </div>
  )
}
