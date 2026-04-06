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
  mediaImport: (data: { filePath: string; fileName: string; mediaType: 'audio' | 'video'; fileSize?: number }): Promise<unknown> =>
    ipcRenderer.invoke('media:import', data),
  mediaList: (data?: { mediaType?: 'audio' | 'video' }): Promise<unknown[]> =>
    ipcRenderer.invoke('media:list', data),
  mediaRemove: (data: { id: number }): Promise<boolean> =>
    ipcRenderer.invoke('media:remove', data),
  mediaUpdateMetadata: (data: { id: number; metadata: object }): Promise<boolean> =>
    ipcRenderer.invoke('media:update-metadata', data),
  mediaUpdateLastUsed: (data: { id: number }): Promise<boolean> =>
    ipcRenderer.invoke('media:update-last-used', data),
  mediaCheckFile: (data: { filePath: string }): Promise<boolean> =>
    ipcRenderer.invoke('media:check-file', data),
  // Settings
  getSetting: (data: { key: string }): Promise<string | null> =>
    ipcRenderer.invoke('settings:get', data),
  setSetting: (data: { key: string; value: string }): Promise<void> =>
    ipcRenderer.invoke('settings:set', data),
  pickMusicDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('settings:pick-music-directory'),
  scanMusicDirectory: (): Promise<unknown[]> =>
    ipcRenderer.invoke('settings:scan-music-directory'),
  // Spotify
  spotifyConnect: (): Promise<{ success: boolean; accessToken?: string; error?: string }> =>
    ipcRenderer.invoke('spotify:connect'),
  spotifyDisconnect: (): Promise<void> =>
    ipcRenderer.invoke('spotify:disconnect'),
  spotifyIsConnected: (): Promise<boolean> =>
    ipcRenderer.invoke('spotify:is-connected'),
  spotifyGetAccessToken: (): Promise<string | null> =>
    ipcRenderer.invoke('spotify:get-access-token'),
  spotifyGetUserProfile: (): Promise<{ display_name: string; email: string } | null> =>
    ipcRenderer.invoke('spotify:get-user-profile'),
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
  mediaImport: (data: { filePath: string; fileName: string; mediaType: 'audio' | 'video'; fileSize?: number }) => Promise<unknown>
  mediaList: (data?: { mediaType?: 'audio' | 'video' }) => Promise<unknown[]>
  mediaRemove: (data: { id: number }) => Promise<boolean>
  mediaUpdateMetadata: (data: { id: number; metadata: object }) => Promise<boolean>
  mediaUpdateLastUsed: (data: { id: number }) => Promise<boolean>
  mediaCheckFile: (data: { filePath: string }) => Promise<boolean>
  // Settings
  getSetting: (data: { key: string }) => Promise<string | null>
  setSetting: (data: { key: string; value: string }) => Promise<void>
  pickMusicDirectory: () => Promise<string | null>
  scanMusicDirectory: () => Promise<unknown[]>
  // Spotify
  spotifyConnect: () => Promise<{ success: boolean; accessToken?: string; error?: string }>
  spotifyDisconnect: () => Promise<void>
  spotifyIsConnected: () => Promise<boolean>
  spotifyGetAccessToken: () => Promise<string | null>
  spotifyGetUserProfile: () => Promise<{ display_name: string; email: string } | null>
}
