/** VIDEO FILES panel — import + list video files with metadata. */
import { useCallback } from 'react'
import { useVideoStore, VideoFileMeta } from './useVideoStore'

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

  const handleImport = useCallback(async () => {
    const api = (window as any).api
    if (!api?.importVideo) return
    const result: VideoFileMeta | null = await api.importVideo()
    if (result) {
      addFile({ ...result, id: `vid-${nextId++}` })
    }
  }, [addFile])

  return (
    <div className="vf-root">
      <div className="vf-toolbar">
        <span className="cockpit-panel__title">VIDEO FILES</span>
        <button
          className="vf-import-btn"
          onClick={handleImport}
          title="Import video file (mp4, webm, mov, avi)"
        >
          + IMPORT
        </button>
      </div>

      {files.length === 0 && (
        <div className="vf-empty">
          <span className="vf-empty__text">No video files imported</span>
          <span className="vf-empty__hint">
            Click IMPORT to add mp4, webm, mov, or avi files
          </span>
        </div>
      )}

      <div className="vf-list">
        {files.map((f) => (
          <div
            key={f.id}
            className={`vf-item${selectedFile?.id === f.id ? ' vf-item--active' : ''}`}
            onClick={() => selectFile(f.id)}
            title={f.path}
          >
            <div className="vf-item__info">
              <span className="vf-item__name">{f.name}</span>
              <span className="vf-item__meta">
                {f.width}x{f.height} | {fmtDuration(f.duration)} | {fmtSize(f.size)}
              </span>
            </div>
            <button
              className="vf-item__remove"
              onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}
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
