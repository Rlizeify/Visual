import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  loadMp3: (): Promise<string | null> => ipcRenderer.invoke('load-mp3'),
  play: (): Promise<void> => ipcRenderer.invoke('play'),
  pause: (): Promise<void> => ipcRenderer.invoke('pause'),
  stop: (): Promise<void> => ipcRenderer.invoke('stop'),
  pushToDisplay: (data: unknown): Promise<void> => ipcRenderer.invoke('push-to-display', data),
  readAudioFile: (filePath: string): Promise<Uint8Array> => ipcRenderer.invoke('read-audio-file', filePath),
})

// Type declaration for renderer
export type CockpitAPI = {
  loadMp3: () => Promise<string | null>
  play: () => Promise<void>
  pause: () => Promise<void>
  stop: () => Promise<void>
  pushToDisplay: (data: unknown) => Promise<void>
  readAudioFile: (filePath: string) => Promise<Uint8Array>
}
