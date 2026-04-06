/* useProjectPersistence.ts — shared hook for save/load project dialogs */

import { useState, useEffect, useCallback, useRef } from 'react'

interface ProjectRow {
  id: number
  name: string
  created_at: string
  updated_at: string
}

interface Options {
  api: {
    projectSave: (d: { name: string; state: Record<string, unknown> }) => Promise<unknown>
    projectLoad: (d: { id: number }) => Promise<{ project: ProjectRow; state: Record<string, unknown> } | null>
    projectList: () => Promise<ProjectRow[]>
    projectDelete: (d: { id: number }) => Promise<boolean>
  } | undefined
  getState: () => Record<string, unknown>
  setState: (s: Record<string, unknown>) => void
}

export function useProjectPersistence({ api, getState, setState }: Options) {
  const [projectName, setProjectName] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<number | null>(null)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [showSave, setShowSave] = useState(false)
  const [showLoad, setShowLoad] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const flashTimeout = useRef<number>(0)

  // Quick save (no dialog if project already loaded)
  const quickSave = useCallback(async () => {
    if (!api || !projectName) { setShowSave(true); return }
    const state = getState()
    const result = await api.projectSave({ name: projectName, state }) as ProjectRow | null
    if (result) {
      setProjectId(result.id)
      setLastSaved(Date.now())
      setIsDirty(false)
      setShowFlash(true)
      clearTimeout(flashTimeout.current)
      flashTimeout.current = window.setTimeout(() => setShowFlash(false), 1500)
    }
  }, [api, projectName, getState])

  // Save as (always show dialog)
  const saveAs = useCallback(() => setShowSave(true), [])

  // Open load dialog
  const openLoad = useCallback(async () => {
    if (!api) return
    const list = await api.projectList() as ProjectRow[]
    setProjects(list)
    setShowLoad(true)
  }, [api])

  // Handle save from dialog
  const handleSave = useCallback(async (name: string) => {
    if (!api) return
    const state = getState()
    const result = await api.projectSave({ name, state }) as ProjectRow | null
    if (result) {
      setProjectName(name)
      setProjectId(result.id)
      setLastSaved(Date.now())
      setIsDirty(false)
      setShowFlash(true)
      clearTimeout(flashTimeout.current)
      flashTimeout.current = window.setTimeout(() => setShowFlash(false), 1500)
    }
    setShowSave(false)
  }, [api, getState])

  // Handle load
  const handleLoad = useCallback(async (id: number) => {
    if (!api) return
    const data = await api.projectLoad({ id }) as { project: ProjectRow; state: Record<string, unknown> } | null
    if (data) {
      setState(data.state)
      setProjectName(data.project.name)
      setProjectId(data.project.id)
      setLastSaved(Date.now())
      setIsDirty(false)
    }
    setShowLoad(false)
  }, [api, setState])

  // Handle delete
  const handleDelete = useCallback(async (id: number) => {
    if (!api) return
    await api.projectDelete({ id })
    setProjects(prev => prev.filter(p => p.id !== id))
    if (projectId === id) {
      setProjectName(null)
      setProjectId(null)
      setLastSaved(null)
    }
  }, [api, projectId])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        quickSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && e.shiftKey) {
        e.preventDefault()
        saveAs()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        openLoad()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [quickSave, saveAs, openLoad])

  // Status text
  const statusText = (() => {
    if (!projectName) return 'Unsaved'
    if (isDirty) return `${projectName} — unsaved changes`
    if (!lastSaved) return projectName
    const ago = Math.floor((Date.now() - lastSaved) / 1000)
    if (ago < 5) return `${projectName} — saved just now`
    if (ago < 60) return `${projectName} — saved ${ago}s ago`
    return `${projectName} — saved ${Math.floor(ago / 60)}m ago`
  })()

  return {
    projectName: projectName ?? 'Untitled',
    showSave, setShowSave,
    showLoad, setShowLoad,
    showFlash,
    projects,
    isDirty, setIsDirty,
    statusText,
    quickSave, saveAs, openLoad,
    handleSave, handleLoad, handleDelete,
  }
}
