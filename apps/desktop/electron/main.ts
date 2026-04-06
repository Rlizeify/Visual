import { app, BrowserWindow, ipcMain, dialog, globalShortcut, screen } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFile } from 'fs/promises'
import { readFileSync, existsSync } from 'fs'
import { saveProject, loadProject, listProjects, deleteProject, mediaImport, mediaList, mediaRemove, mediaUpdateMetadata, mediaUpdateLastUsed } from './database'
import { startSpotifyAuth, getValidAccessToken, isSpotifyConnected, disconnectSpotify, getSpotifyUserProfile } from './spotify-auth'

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
const toolWindows = new Map<string, BrowserWindow>()

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
    toolWindows.forEach((w) => { if (!w.isDestroyed()) w.close() })
    toolWindows.clear()
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
      webSecurity: false,
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

// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
// function createDisplayWindow() {
//   const { width, height } = screen.getPrimaryDisplay().workAreaSize
//   displayWin = new BrowserWindow({
//     width,
//     height,
//     resizable: true,
//     fullscreen: true,
//     titleBarStyle: 'hidden',
//     title: 'VISUALIZER',
//     backgroundColor: '#000000',
//     webPreferences: {
//       preload: join(__dirname, 'preload-display.js'),
//       nodeIntegration: false,
//       contextIsolation: true,
//       sandbox: false,
//     },
//   })
//
//   displayWin.setMenuBarVisibility(false)
//
//   if (VITE_DEV_SERVER_URL) {
//     displayWin.loadURL(`${VITE_DEV_SERVER_URL}display.html`)
//   } else {
//     displayWin.loadFile(join(__dirname, '../dist/display.html'))
//   }
//
//   displayWin.on('closed', () => {
//     displayWin = null
//   })
// }

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

  // DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
  // // F11 toggles fullscreen on display window
  // globalShortcut.register('F11', () => {
  //   if (displayWin && !displayWin.isDestroyed()) {
  //     displayWin.setFullScreen(!displayWin.isFullScreen())
  //   }
  // })

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
  // DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
  // if (!displayWin || displayWin.isDestroyed()) {
  //   createDisplayWindow()
  // }
  cockpitWin?.focus()
})

// ─── Tool Launcher ────────────────────────────────────────────────────────────

function vendorPath(...segments: string[]): string {
  // In dev: __dirname is apps/desktop/dist-electron → go up 3 levels to repo root
  // In prod: app.getAppPath() points to the app resources
  const root = VITE_DEV_SERVER_URL
    ? join(__dirname, '../../..')
    : join(app.getAppPath(), '../..')
  return join(root, 'vendor', ...segments)
}

const toolRegistry: Record<string, { title: string; htmlPath: string }> = {
  'binary-synth': {
    title: 'Binary Synth',
    htmlPath: vendorPath('binary-synth', 'dist', 'index.html'),
  },
}

ipcMain.on('tool:launch', (_event, { toolName }: { toolName: string }) => {
  const tool = toolRegistry[toolName]
  if (!tool) return

  const existing = toolWindows.get(toolName)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: true,
    title: tool.title,
    backgroundColor: '#0D1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  win.setMenuBarVisibility(false)

  if (!existsSync(tool.htmlPath)) {
    dialog.showErrorBox(
      'Tool not found',
      `Could not find ${tool.title} at:\n${tool.htmlPath}\n\nRun "npm run build" inside vendor/${toolName}/ to generate it.`,
    )
    win.destroy()
    return
  }

  win.loadFile(tool.htmlPath)
  toolWindows.set(toolName, win)

  win.on('closed', () => {
    toolWindows.delete(toolName)
  })
})

ipcMain.on('hub:open-studio', () => {
  if (!studioWin || studioWin.isDestroyed()) {
    createStudioWindow()
  }
  studioWin?.focus()
})

// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
// ipcMain.on('hub:open-visualizer', () => {
//   if (!displayWin || displayWin.isDestroyed()) {
//     createDisplayWindow()
//   }
//   displayWin?.focus()
// })

// ─── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('load-mp3', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Load Audio',
    filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aiff', 'aac', 'm4a'] }],
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

// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
// ipcMain.on('visualizer:beat-data', (_event, data) => {
//   if (displayWin && !displayWin.isDestroyed()) {
//     displayWin.webContents.send('visualizer:beat-data', data)
//   }
// })

// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
// ipcMain.on('visualizer:dial-data', (_event, data) => {
//   if (displayWin && !displayWin.isDestroyed()) {
//     displayWin.webContents.send('visualizer:dial-data', data)
//   }
// })

// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
// ipcMain.on('visualizer:waveform-data', (_event, data) => {
//   if (displayWin && !displayWin.isDestroyed()) {
//     displayWin.webContents.send('visualizer:waveform-data', data)
//   }
// })

// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
// ipcMain.handle('push-to-display', async (_event, data: unknown) => {
//   console.log('[VISUAL] IPC: push-to-display', data)
//   if (displayWin && !displayWin.isDestroyed()) {
//     displayWin.webContents.send('display-update', data)
//   }
// })

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

// DISPLAY WINDOW — commented out, Butterchurn now runs inside Cockpit preview panel
// ipcMain.on('display:fullscreen', () => {
//   if (displayWin && !displayWin.isDestroyed()) {
//     displayWin.setFullScreen(!displayWin.isFullScreen())
//   }
// })

// ─── Video IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('import-video', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import Video',
    filters: [{ name: 'Video Files', extensions: ['mp4', 'webm', 'mov', 'avi'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]
  const { stat } = await import('fs/promises')
  const { basename } = await import('path')

  const stats = await stat(filePath)
  const name = basename(filePath)

  console.log('[VISUAL] Imported video:', filePath)

  // Return basic metadata; renderer extracts duration/resolution via <video>
  return {
    path: filePath,
    name,
    size: stats.size,
    // Defaults — renderer overrides from HTMLVideoElement metadata
    duration: 0,
    width: 0,
    height: 0,
    fps: 30,
    codec: filePath.split('.').pop()?.toUpperCase() ?? 'UNKNOWN',
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

// ─── Studio Sampler IPC ──────────────────────────────────────────────────────

ipcMain.handle('studio:open-sample-dialog', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Load Audio Sample',
    filters: [{
      name: 'Audio Files',
      extensions: ['wav', 'mp3', 'ogg', 'flac', 'aiff'],
    }],
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    console.log('[STUDIO] Loaded sample:', result.filePaths[0])
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('studio:read-audio-file', async (_event, filePath: string) => {
  const { readFile: readF } = await import('fs/promises')
  const buf = await readF(filePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
})

// ─── Project Persistence IPC ────────────────────────────────────────────────

ipcMain.handle('project:save', async (_event, data: { name: string; state: Record<string, unknown> }) => {
  try {
    const project = saveProject(data.name, data.state)
    console.log('[VISUAL] Project saved:', project.name, '#' + project.id)
    return project
  } catch (err) {
    console.error('[VISUAL] Project save failed:', err)
    return null
  }
})

ipcMain.handle('project:load', async (_event, data: { id: number }) => {
  try {
    return loadProject(data.id)
  } catch (err) {
    console.error('[VISUAL] Project load failed:', err)
    return null
  }
})

ipcMain.handle('project:list', async () => {
  try {
    return listProjects()
  } catch (err) {
    console.error('[VISUAL] Project list failed:', err)
    return []
  }
})

ipcMain.handle('project:delete', async (_event, data: { id: number }) => {
  try {
    return deleteProject(data.id)
  } catch (err) {
    console.error('[VISUAL] Project delete failed:', err)
    return false
  }
})

// ─── Media Library IPC ──────────────────────────────────────────────────────

ipcMain.handle('media:import', async (_event, data: { filePath: string; fileName: string; mediaType: 'audio' | 'video'; fileSize?: number }) => {
  try {
    const row = mediaImport(data.filePath, data.fileName, data.mediaType, data.fileSize)
    console.log('[VISUAL] Media imported:', data.fileName, '#' + row.id)
    return row
  } catch (err) {
    console.error('[VISUAL] Media import failed:', err)
    return null
  }
})

ipcMain.handle('media:list', async (_event, data?: { mediaType?: 'audio' | 'video' }) => {
  try {
    return mediaList(data?.mediaType)
  } catch (err) {
    console.error('[VISUAL] Media list failed:', err)
    return []
  }
})

ipcMain.handle('media:remove', async (_event, data: { id: number }) => {
  try {
    return mediaRemove(data.id)
  } catch (err) {
    console.error('[VISUAL] Media remove failed:', err)
    return false
  }
})

ipcMain.handle('media:update-metadata', async (_event, data: { id: number; metadata: object }) => {
  try {
    return mediaUpdateMetadata(data.id, data.metadata)
  } catch (err) {
    console.error('[VISUAL] Media update-metadata failed:', err)
    return false
  }
})

ipcMain.handle('media:update-last-used', async (_event, data: { id: number }) => {
  try {
    return mediaUpdateLastUsed(data.id)
  } catch (err) {
    console.error('[VISUAL] Media update-last-used failed:', err)
    return false
  }
})

ipcMain.handle('media:check-file', async (_event, data: { filePath: string }) => {
  try {
    const { access } = await import('fs/promises')
    await access(data.filePath)
    return true
  } catch {
    return false
  }
})

// ─── Spotify IPC ─────────────────────────────────────────────────────────────

ipcMain.handle('spotify:connect', async () => {
  try {
    const tokens = await startSpotifyAuth()
    return { success: true, accessToken: tokens.access_token }
  } catch (err: any) {
    console.error('[SPOTIFY] Auth failed:', err)
    return { success: false, error: err.message }
  }
})

ipcMain.handle('spotify:disconnect', async () => {
  disconnectSpotify()
})

ipcMain.handle('spotify:is-connected', async () => {
  return isSpotifyConnected()
})

ipcMain.handle('spotify:get-access-token', async () => {
  return await getValidAccessToken()
})

ipcMain.handle('spotify:get-user-profile', async () => {
  return await getSpotifyUserProfile()
})
