import { ipcMain } from 'electron'
import { broadcastFrequencyData } from './audio-ws-server'

export function setupAudioBroadcaster(): void {
  ipcMain.on('audio-ws:push-freq', (_event, data: number[]) => {
    try {
      broadcastFrequencyData(new Uint8Array(data))
    } catch { /* ignore */ }
  })
}
