import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  onDisplayUpdate: (callback: (data: unknown) => void) => {
    ipcRenderer.on('display-update', (_event, data) => callback(data))
  },
  removeDisplayListeners: () => {
    ipcRenderer.removeAllListeners('display-update')
  },
  onBeatData: (callback: (data: unknown) => void) => {
    ipcRenderer.on('visualizer:beat-data', (_event, data) => callback(data))
  },
  removeBeatDataListeners: () => {
    ipcRenderer.removeAllListeners('visualizer:beat-data')
  },
  onDialData: (callback: (data: unknown) => void) => {
    ipcRenderer.on('visualizer:dial-data', (_event, data) => callback(data))
  },
  removeDialDataListeners: () => {
    ipcRenderer.removeAllListeners('visualizer:dial-data')
  },
})

export type DisplayAPI = {
  onDisplayUpdate: (callback: (data: unknown) => void) => void
  removeDisplayListeners: () => void
  onBeatData: (callback: (data: unknown) => void) => void
  removeBeatDataListeners: () => void
  onDialData: (callback: (data: unknown) => void) => void
  removeDialDataListeners: () => void
}
