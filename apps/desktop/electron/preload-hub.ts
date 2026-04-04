import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('hubApi', {
  openCockpit: (): void => ipcRenderer.send('hub:open-cockpit'),
  openStudio: (): void => ipcRenderer.send('hub:open-studio'),
  openVisualizer: (): void => ipcRenderer.send('hub:open-visualizer'),
})

export type HubAPI = {
  openCockpit: () => void
  openStudio: () => void
  openVisualizer: () => void
}
