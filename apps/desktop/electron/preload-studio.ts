import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('studioApi', {
  saveSession: (data: string): Promise<string | null> =>
    ipcRenderer.invoke('studio:save-session', data),
  discardSession: (): void => ipcRenderer.send('studio:discard-session'),
  markDirty: (): void => ipcRenderer.send('studio:mark-dirty'),
  openSampleDialog: (): Promise<string | null> =>
    ipcRenderer.invoke('studio:open-sample-dialog'),
  readAudioFile: (path: string): Promise<ArrayBuffer | null> =>
    ipcRenderer.invoke('studio:read-audio-file', path),
  projectSave: (data: { name: string; state: Record<string, unknown> }): Promise<unknown> =>
    ipcRenderer.invoke('project:save', data),
  projectLoad: (data: { id: number }): Promise<unknown> =>
    ipcRenderer.invoke('project:load', data),
  projectList: (): Promise<unknown[]> =>
    ipcRenderer.invoke('project:list'),
  projectDelete: (data: { id: number }): Promise<boolean> =>
    ipcRenderer.invoke('project:delete', data),
})

// Type declaration for renderer
export type StudioAPI = {
  saveSession: (data: string) => Promise<string | null>
  discardSession: () => void
  markDirty: () => void
  openSampleDialog: () => Promise<string | null>
  readAudioFile: (path: string) => Promise<ArrayBuffer | null>
  projectSave: (data: { name: string; state: Record<string, unknown> }) => Promise<unknown>
  projectLoad: (data: { id: number }) => Promise<unknown>
  projectList: () => Promise<unknown[]>
  projectDelete: (data: { id: number }) => Promise<boolean>
}
