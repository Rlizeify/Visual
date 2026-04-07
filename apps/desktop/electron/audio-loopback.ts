/** Desktop audio capture via Electron displayMedia (no native modules). */
import { ipcMain, BrowserWindow } from 'electron'

export function setupLoopbackIpc(): void {
  ipcMain.handle('audio:get-loopback-source', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, error: 'No window' }
    win.webContents.session.setDisplayMediaRequestHandler((_request, callback) => {
      callback({ video: win.webContents.mainFrame, audio: 'loopback' })
    })
    return { success: true }
  })
}
