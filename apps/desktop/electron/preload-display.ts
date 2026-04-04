import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  onDisplayUpdate: (callback: (data: unknown) => void) => {
    ipcRenderer.on('display-update', (_event, data) => callback(data))
  },
  removeDisplayListeners: () => {
    ipcRenderer.removeAllListeners('display-update')
  },
})

export type DisplayAPI = {
  onDisplayUpdate: (callback: (data: unknown) => void) => void
  removeDisplayListeners: () => void
}
