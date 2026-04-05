import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  loadMp3: (): Promise<string | null> => ipcRenderer.invoke('load-mp3'),
  play: (): Promise<void> => ipcRenderer.invoke('play'),
  pause: (): Promise<void> => ipcRenderer.invoke('pause'),
  stop: (): Promise<void> => ipcRenderer.invoke('stop'),
  pushToDisplay: (data: unknown): Promise<void> => ipcRenderer.invoke('push-to-display', data),
  readAudioFile: (filePath: string): Promise<Uint8Array> => ipcRenderer.invoke('read-audio-file', filePath),
  send: (channel: string, data: unknown): void => ipcRenderer.send(channel, data),
  toggleDisplayFullscreen: (): void => ipcRenderer.send('display:fullscreen'),
  saveSynthRecording: (data: number[]): Promise<string | null> =>
    ipcRenderer.invoke('save-synth-recording', data),
  importVideo: (): Promise<{
    path: string; name: string; size: number;
    duration: number; width: number; height: number;
    fps: number; codec: string;
  } | null> => ipcRenderer.invoke('import-video'),
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
export type CockpitAPI = {
  loadMp3: () => Promise<string | null>
  play: () => Promise<void>
  pause: () => Promise<void>
  stop: () => Promise<void>
  pushToDisplay: (data: unknown) => Promise<void>
  readAudioFile: (filePath: string) => Promise<Uint8Array>
  send: (channel: string, data: unknown) => void
  toggleDisplayFullscreen: () => void
  saveSynthRecording: (data: number[]) => Promise<string | null>
  importVideo: () => Promise<{
    path: string; name: string; size: number;
    duration: number; width: number; height: number;
    fps: number; codec: string;
  } | null>
  projectSave: (data: { name: string; state: Record<string, unknown> }) => Promise<unknown>
  projectLoad: (data: { id: number }) => Promise<unknown>
  projectList: () => Promise<unknown[]>
  projectDelete: (data: { id: number }) => Promise<boolean>
}
