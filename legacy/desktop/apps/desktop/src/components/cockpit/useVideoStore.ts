/** Shared state for the video module — selected file + imported file list.
 *  Now backed by the persistent media library. */
import { useState, useCallback, useEffect } from 'react'
import { analyzeVideo, type VideoAnalysis } from './videoAnalyzer'

export interface VideoFileMeta {
  id: string
  path: string
  name: string
  size: number
  duration: number
  width: number
  height: number
  fps: number
  codec: string
  /** DB row id from media_library (null if not yet persisted) */
  dbId?: number
  /** true when the original file no longer exists on disk */
  missing?: boolean
  /** Stored metadata from the analyzer */
  metadata?: Record<string, unknown>
  /** Video analysis results */
  analysis?: VideoAnalysis
  /** true while analysis is running */
  analyzing?: boolean
}

let globalFiles: VideoFileMeta[] = []
let globalSelected: string | null = null
const listeners = new Set<() => void>()

function notify() { listeners.forEach((l) => l()) }

function updateFile(id: string, patch: Partial<VideoFileMeta>) {
  globalFiles = globalFiles.map((f) => f.id === id ? { ...f, ...patch } : f)
  notify()
}

/** Replace the entire file list (used when loading from library) */
export function setVideoFiles(files: VideoFileMeta[]) {
  globalFiles = files
  if (files.length > 0 && !globalSelected) {
    globalSelected = files[0].id
  }
  // If selected file was removed, reset
  if (globalSelected && !files.find(f => f.id === globalSelected)) {
    globalSelected = files[0]?.id ?? null
  }
  notify()
}

/** Get the current file list without subscribing */
export function getVideoFiles(): VideoFileMeta[] {
  return globalFiles
}

export function useVideoStore() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const cb = () => rerender((n) => n + 1)
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  }, [])

  const addFile = useCallback((meta: VideoFileMeta) => {
    if (globalFiles.some((f) => f.path === meta.path)) return

    // If this file already has stored analysis from the library, skip re-analysis
    if (meta.metadata?.analysis) {
      globalFiles = [...globalFiles, { ...meta, analysis: meta.metadata.analysis as VideoAnalysis, analyzing: false }]
      if (!globalSelected) globalSelected = meta.id
      notify()
      return
    }

    globalFiles = [...globalFiles, { ...meta, analyzing: true }]
    if (!globalSelected) globalSelected = meta.id
    notify()

    // Run analysis asynchronously
    analyzeVideo(meta.path)
      .then((analysis) => {
        updateFile(meta.id, { analysis, analyzing: false })
        // Persist analysis to media library if we have a dbId
        if (meta.dbId) {
          const api = (window as any).api
          if (api?.mediaUpdateMetadata) {
            api.mediaUpdateMetadata({ id: meta.dbId, metadata: { ...meta.metadata, analysis } })
          }
        }
      })
      .catch(() => updateFile(meta.id, { analyzing: false }))
  }, [])

  const selectFile = useCallback((id: string) => {
    globalSelected = id
    notify()
  }, [])

  const removeFile = useCallback((id: string) => {
    globalFiles = globalFiles.filter((f) => f.id !== id)
    if (globalSelected === id) {
      globalSelected = globalFiles[0]?.id ?? null
    }
    notify()
  }, [])

  const selectedFile = globalFiles.find((f) => f.id === globalSelected) ?? null

  return {
    files: globalFiles,
    selectedFile,
    addFile,
    selectFile,
    removeFile,
  }
}
