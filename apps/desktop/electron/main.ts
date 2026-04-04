import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let cockpitWin: BrowserWindow | null = null
let displayWin: BrowserWindow | null = null

function createCockpitWindow() {
  cockpitWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    resizable: true,
    title: 'VISUAL — COCKPIT',
    backgroundColor: '#05050f',
    webPreferences: {
      preload: join(__dirname, 'preload-cockpit.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  cockpitWin.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    cockpitWin.loadURL(VITE_DEV_SERVER_URL)
  } else {
    cockpitWin.loadFile(join(__dirname, '../dist/index.html'))
  }

  cockpitWin.on('closed', () => {
    cockpitWin = null
    // Close display window when cockpit closes
    if (displayWin && !displayWin.isDestroyed()) {
      displayWin.close()
    }
    app.quit()
  })
}

function createDisplayWindow() {
  displayWin = new BrowserWindow({
    width: 1024,
    height: 768,
    resizable: true,
    frame: false,
    titleBarStyle: 'hidden',
    title: 'VISUAL — DISPLAY',
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, 'preload-display.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  displayWin.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    displayWin.loadURL(`${VITE_DEV_SERVER_URL}display.html`)
  } else {
    displayWin.loadFile(join(__dirname, '../dist/display.html'))
  }

  displayWin.on('closed', () => {
    displayWin = null
  })
}

app.whenReady().then(() => {
  createCockpitWindow()
  createDisplayWindow()

  // F11 toggles fullscreen on display window
  globalShortcut.register('F11', () => {
    if (displayWin && !displayWin.isDestroyed()) {
      displayWin.setFullScreen(!displayWin.isFullScreen())
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createCockpitWindow()
      createDisplayWindow()
    }
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('load-mp3', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Load MP3',
    filters: [{ name: 'MP3 Audio', extensions: ['mp3'] }],
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    console.log('[VISUAL] Loaded file:', filePath)
    return filePath
  }
  return null
})

ipcMain.handle('play', async () => {
  console.log('[VISUAL] IPC: play')
})

ipcMain.handle('pause', async () => {
  console.log('[VISUAL] IPC: pause')
})

ipcMain.handle('stop', async () => {
  console.log('[VISUAL] IPC: stop')
})

ipcMain.handle('read-audio-file', async (_event, filePath: string) => {
  const { readFile } = await import('fs/promises')
  return await readFile(filePath)
})

ipcMain.handle('push-to-display', async (_event, data: unknown) => {
  console.log('[VISUAL] IPC: push-to-display', data)
  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.webContents.send('display-update', data)
  }
})
