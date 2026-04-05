/** Shared state for the video module — selected file + imported file list. */
import { useState, useCallback, useEffect } from 'react'

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
}

let globalFiles: VideoFileMeta[] = []
let globalSelected: string | null = null
const listeners = new Set<() => void>()

function notify() { listeners.forEach((l) => l()) }

export function useVideoStore() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const cb = () => rerender((n) => n + 1)
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  }, [])

  const addFile = useCallback((meta: VideoFileMeta) => {
    if (globalFiles.some((f) => f.path === meta.path)) return
    globalFiles = [...globalFiles, meta]
    if (!globalSelected) globalSelected = meta.id
    notify()
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
