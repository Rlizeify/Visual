/** VIDEO FILES panel — import + list video files with metadata.
 *  Backed by persistent media library. */
import { useCallback, useEffect, useRef } from 'react'
import { useVideoStore, VideoFileMeta, setVideoFiles } from './useVideoStore'
import type { VideoAnalysis } from './videoAnalyzer'
import { Tooltip } from '../shared'

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

let nextId = 1

export default function VideoFiles() {
  const { files, selectedFile, addFile, selectFile, removeFile } = useVideoStore()
  const loadedRef = useRef(false)

  // Load video library on mount
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    const api = (window as any).api
    if (!api?.mediaList) return

    ;(async () => {
      const rows: any[] = await api.mediaList({ mediaType: 'video' })
      if (!rows || rows.length === 0) return

      const loaded: VideoFileMeta[] = []
      for (const row of rows) {
        const exists: boolean = await api.mediaCheckFile({ filePath: row.file_path })
        const meta = row.metadata_json ? JSON.parse(row.metadata_json) : {}
        loaded.push({
          id: `vid-${nextId++}`,
          path: row.file_path,
          name: row.file_name,
          size: row.file_size ?? 0,
          duration: meta.duration ?? row.duration ?? 0,
          width: meta.width ?? 0,
          height: meta.height ?? 0,
          fps: meta.fps ?? 30,
          codec: meta.codec ?? row.file_path.split('.').pop()?.toUpperCase() ?? 'UNKNOWN',
          dbId: row.id,
          missing: !exists,
          metadata: meta,
          analysis: meta.analysis as VideoAnalysis | undefined,
        })
      }
      setVideoFiles(loaded)
    })()
  }, [])

  const handleImport = useCallback(async () => {
    const api = (window as any).api
    if (!api?.importVideo) return
    const result: VideoFileMeta | null = await api.importVideo()
    if (!result) return

    const fileId = `vid-${nextId++}`
    const fileMeta: VideoFileMeta = { ...result, id: fileId }

    // Persist to media library
    if (api.mediaImport) {
      const row: any = await api.mediaImport({
        filePath: result.path,
        fileName: result.name,
        mediaType: 'video',
        fileSize: result.size,
      })
      if (row) fileMeta.dbId = row.id
    }

    addFile(fileMeta)
  }, [addFile])

  const handleRemove = useCallback(async (id: string, dbId?: number) => {
    removeFile(id)
    // Also remove from DB
    if (dbId) {
      const api = (window as any).api
      if (api?.mediaRemove) await api.mediaRemove({ id: dbId })
    }
  }, [removeFile])

  const handleSelect = useCallback((file: VideoFileMeta) => {
    if (file.missing) return
    selectFile(file.id)
    // Update last_used
    if (file.dbId) {
      const api = (window as any).api
      if (api?.mediaUpdateLastUsed) api.mediaUpdateLastUsed({ id: file.dbId })
    }
  }, [selectFile])

  return (
    <div className="vf-root">
      <div className="vf-toolbar">
        <span className="vf-title">VIDEO FILES</span>
        <Tooltip text="IMPORT" detail="Import video files to use with the visualizer">
        <button
          className="vf-import-btn"
          onClick={handleImport}
        >
          + IMPORT
        </button>
        </Tooltip>
      </div>

      {files.length === 0 && (
        <div className="vf-empty">
          <span className="vf-empty__text">No video files imported</span>
          <span className="vf-empty__hint">
            Click IMPORT to add mp4, webm, mov, avi, or dvr files
          </span>
        </div>
      )}

      <div className="vf-list">
        {files.map((f) => (
          <div
            key={f.id}
            className={`vf-item${selectedFile?.id === f.id ? ' vf-item--active' : ''}${f.missing ? ' vf-item--missing' : ''}`}
            onClick={() => handleSelect(f)}
            title={f.missing ? `File not found: ${f.path}` : f.path}
          >
            <div className="vf-item__info">
              <span className="vf-item__name">
                {f.missing && <span className="vf-item__warn" title="File not found">&#9888; </span>}
                {f.name}
              </span>
              <span className="vf-item__meta">
                {f.missing
                  ? 'File not found'
                  : `${f.width}x${f.height} | ${fmtDuration(f.duration)} | ${fmtSize(f.size)}`}
              </span>
            </div>
            <button
              className="vf-item__remove"
              onClick={(e) => { e.stopPropagation(); handleRemove(f.id, f.dbId) }}
              title="Remove from list"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
