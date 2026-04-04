import { app, BrowserWindow, ipcMain, dialog, globalShortcut, screen } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFile } from 'fs/promises'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// ─── Splash Text ──────────────────────────────────────────────────────────────
let splashText = ''
try {
  const candidates = [
    join(__dirname, '../../../assets/splashes.txt'),
    join(__dirname, '../../assets/splashes.txt'),
    join(app.getAppPath(), 'assets/splashes.txt'),
  ]
  const splashPath = candidates.find(p => { try { readFileSync(p); return true } catch { return false } })
  if (!splashPath) throw new Error('No splash file found')
  const lines = readFileSync(splashPath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
  splashText = lines[Math.floor(Math.random() * lines.length)]
} catch {
  splashText = 'Awesome!'
}

let hubWin: BrowserWindow | null = null
let cockpitWin: BrowserWindow | null = null
let displayWin: BrowserWindow | null = null
let studioWin: BrowserWindow | null = null

function createHubWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize
  hubWin = new BrowserWindow({
    width: 1000,
    height: 700,
    x: Math.round((screenW - 1000) / 2),
    y: Math.round((screenH - 700) / 2),
    resizable: false,
    frame: false,
    title: 'MHEU',
    backgroundColor: '#05000f',
    webPreferences: {
      preload: join(__dirname, 'preload-hub.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  hubWin.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    hubWin.loadURL(`${VITE_DEV_SERVER_URL}hub.html`)
  } else {
    hubWin.loadFile(join(__dirname, '../dist/hub.html'))
  }

  hubWin.on('closed', () => {
    hubWin = null
    // Close all other windows and quit
    ;[cockpitWin, displayWin, studioWin].forEach((w) => {
      if (w && !w.isDestroyed()) w.close()
    })
    app.quit()
  })
}

function createCockpitWindow() {
  cockpitWin = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    resizable: true,
    title: 'COCKPIT',
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
  })
}

function createDisplayWindow() {
  displayWin = new BrowserWindow({
    width: 1024,
    height: 768,
    resizable: true,
    frame: false,
    titleBarStyle: 'hidden',
    title: 'VISUALIZER',
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

function createStudioWindow() {
  studioWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    resizable: true,
    title: 'STUDIO',
    backgroundColor: '#05050a',
    webPreferences: {
      preload: join(__dirname, 'preload-studio.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  studioWin.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    studioWin.loadURL(`${VITE_DEV_SERVER_URL}studio.html`)
  } else {
    studioWin.loadFile(join(__dirname, '../dist/studio.html'))
  }

  studioWin.on('closed', () => {
    studioWin = null
  })
}

app.whenReady().then(() => {
  createHubWindow()

  // F11 toggles fullscreen on display window
  globalShortcut.register('F11', () => {
    if (displayWin && !displayWin.isDestroyed()) {
      displayWin.setFullScreen(!displayWin.isFullScreen())
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createHubWindow()
    }
  })
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ─── Hub IPC Handlers ─────────────────────────────────────────────────────────

ipcMain.on('get-splash-text', (event) => {
  event.returnValue = splashText
})

ipcMain.on('hub:open-cockpit', () => {
  if (!cockpitWin || cockpitWin.isDestroyed()) {
    createCockpitWindow()
  }
  if (!displayWin || displayWin.isDestroyed()) {
    createDisplayWindow()
  }
  cockpitWin?.focus()
})

ipcMain.on('hub:open-studio', () => {
  if (!studioWin || studioWin.isDestroyed()) {
    createStudioWindow()
  }
  studioWin?.focus()
})

ipcMain.on('hub:open-visualizer', () => {
  if (!displayWin || displayWin.isDestroyed()) {
    createDisplayWindow()
  }
  displayWin?.focus()
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

ipcMain.on('visualizer:beat-data', (_event, data) => {
  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.webContents.send('visualizer:beat-data', data)
  }
})

ipcMain.on('visualizer:dial-data', (_event, data) => {
  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.webContents.send('visualizer:dial-data', data)
  }
})

ipcMain.handle('push-to-display', async (_event, data: unknown) => {
  console.log('[VISUAL] IPC: push-to-display', data)
  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.webContents.send('display-update', data)
  }
})

ipcMain.handle('save-synth-recording', async (_event, data: number[]) => {
  const result = await dialog.showSaveDialog({
    title: 'Save Recording',
    defaultPath: 'synth-recording.webm',
    filters: [{ name: 'WebM Audio', extensions: ['webm'] }],
  })
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, Buffer.from(new Uint8Array(data)))
  console.log('[VISUAL] Saved synth recording:', result.filePath)
  return result.filePath
})

ipcMain.on('display:fullscreen', () => {
  if (displayWin && !displayWin.isDestroyed()) {
    displayWin.setFullScreen(!displayWin.isFullScreen())
  }
})

// ─── Studio IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('studio:save-session', async (_event, data: string) => {
  const result = await dialog.showSaveDialog({
    title: 'Save Session',
    defaultPath: 'session.json',
    filters: [{ name: 'JSON Session', extensions: ['json'] }],
  })
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, data, 'utf-8')
  console.log('[STUDIO] Saved session:', result.filePath)
  return result.filePath
})

ipcMain.on('studio:discard-session', () => {
  console.log('[STUDIO] Session discarded')
})

ipcMain.on('studio:mark-dirty', () => {
  console.log('[STUDIO] Session marked dirty')
})
