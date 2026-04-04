import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('studioApi', {
  saveSession: (data: string): Promise<string | null> =>
    ipcRenderer.invoke('studio:save-session', data),
  discardSession: (): void => ipcRenderer.send('studio:discard-session'),
  markDirty: (): void => ipcRenderer.send('studio:mark-dirty'),
})

// Type declaration for renderer
export type StudioAPI = {
  saveSession: (data: string) => Promise<string | null>
  discardSession: () => void
  markDirty: () => void
}
