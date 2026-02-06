/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Menu,
  Tray,
  nativeImage
} from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import crypto from 'node:crypto'
import fs from 'node:fs'

/* ======================================================
   SIMPLE PERSISTENT KV STORE (MAIN PROCESS)
   ====================================================== */

let kvCache = null

function kvFilePath() {
  return path.join(app.getPath('userData'), 'kv.json')
}

function isAllowedKvKey(key) {
  const k = String(key || '')
  // Only allow our own keys; prevents accidental abuse of sync IPC.
  return k === 'octoPlayerShuffle' || k === 'octoPlayerEQ' || k.startsWith('octoPlayer.')
}

function loadKv() {
  if (kvCache) return kvCache
  try {
    const raw = fs.readFileSync(kvFilePath(), 'utf8')
    const parsed = JSON.parse(raw)
    kvCache = parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    kvCache = {}
  }
  return kvCache
}

function writeKv(next) {
  kvCache = next && typeof next === 'object' ? next : {}
  const target = kvFilePath()
  const tmp = target + '.tmp'
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(tmp, JSON.stringify(kvCache, null, 2), 'utf8')
    fs.renameSync(tmp, target)
  } catch (err) {
    // Best-effort: don't crash app if disk write fails.
    log('[Main] Failed to write kv store:', err)
    try { fs.unlinkSync(tmp) } catch { }
  }
}

function kvGet(key) {
  if (!isAllowedKvKey(key)) return null
  const store = loadKv()
  const v = store[String(key)]
  return v === undefined ? null : String(v)
}

function kvSet(key, value) {
  if (!isAllowedKvKey(key)) return false
  const k = String(key)
  const v = String(value ?? '')
  // Hard cap to avoid giant sync IPC payloads.
  if (v.length > 1024 * 1024) return false
  const store = loadKv()
  store[k] = v
  writeKv(store)
  return true
}

function kvRemove(key) {
  if (!isAllowedKvKey(key)) return false
  const store = loadKv()
  delete store[String(key)]
  writeKv(store)
  return true
}

// Optional GPU safe-mode for troubleshooting blank windows on some Windows setups.
// Usage (Windows cmd): `set OCTO_DISABLE_GPU=1` then launch Octo.
try {
  if (process.platform === 'win32' && process.env.OCTO_DISABLE_GPU === '1') {
    app.disableHardwareAcceleration()
    app.commandLine.appendSwitch('disable-gpu')
  }
} catch {
  // ignore
}

/* ======================================================
   BASIC LOGGING (FILE + CONSOLE)
   ====================================================== */

let logFilePath = null

function fmtLogArgs(args) {
  return args
    .map(a => {
      if (a instanceof Error) return a.stack || a.message
      if (typeof a === 'string') return a
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')
}

function log(...args) {
  const line = `[${new Date().toISOString()}] ${fmtLogArgs(args)}`
  // Always keep console output for dev / running from terminal
  try {
    console.log(line)
  } catch {
    // ignore
  }
  if (!logFilePath) return
  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true })
    fs.appendFileSync(logFilePath, line + os.EOL)
  } catch {
    // ignore
  }
}

function initFileLogging() {
  try {
    logFilePath = path.join(app.getPath('userData'), 'main.log')
    log('[Main] Logging to:', logFilePath)
  } catch (err) {
    // If this fails, we still have console output.
    console.error('[Main] Failed to init file logging:', err)
  }
}

/* ======================================================
   HELPERS
   ====================================================== */
function ensureWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const probe = path.join(dir, `.probe-${Date.now()}`)
    fs.writeFileSync(probe, 'ok')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

function embyClientHeaders(token) {
  // Mirror the renderer's header strategy so proxies / stricter servers accept requests.
  const deviceId = kvGet('octoPlayer.deviceId') || 'octo-player-desktop'
  const version = (() => {
    try { return app.getVersion() } catch { return '0.0.0' }
  })()

  const headers = {
    Accept: 'application/json',
    'X-Emby-Client': 'Octo Player',
    'X-Emby-Device-Name': 'Octo Desktop',
    'X-Emby-Device-Id': deviceId,
    'X-Emby-Client-Version': version,
    'X-Emby-Authorization': [
      'MediaBrowser',
      'Client="Octo Player"',
      'Device="Octo Desktop"',
      `DeviceId="${deviceId}"`,
      `Version="${version}"`
    ].join(', ')
  }

  if (token) {
    headers['X-Emby-Token'] = String(token)
    headers.Authorization = `MediaBrowser Token=${token}`
  }

  return headers
}

async function throwIfNotOk(res) {
  if (res.ok) return
  let body = ''
  try {
    body = await res.text()
  } catch {
    body = ''
  }
  const snippet = body ? `: ${String(body).slice(0, 500)}` : ''
  throw new Error(`HTTP ${res.status}${snippet}`)
}

/* ======================================================
   USER DATA / CACHE PATHS (SAFE ON WINDOWS)
   ====================================================== */
let resolvedUserData = null

function initUserDataPath() {
  try {
    const windowsLocalAppData =
      process.platform === 'win32' ? process.env.LOCALAPPDATA : null

    const userDataBase = windowsLocalAppData || app.getPath('appData')
    resolvedUserData = path.join(userDataBase, app.getName())

    if (!ensureWritableDir(resolvedUserData)) {
      resolvedUserData = path.join(
        app.getPath('temp'),
        `${app.getName()}-userdata`
      )
      ensureWritableDir(resolvedUserData)
    }

    app.setPath('userData', resolvedUserData)
    log('[Main] User data path:', resolvedUserData)
  } catch (err) {
    console.error('[Main] Error setting up paths:', err)
  }
}

/* ======================================================
   GLOBALS
   ====================================================== */
Menu.setApplicationMenu(null)

// Get __dirname safely - works in both normal and asar contexts
let __dirname
try {
  __dirname = path.dirname(fileURLToPath(import.meta.url))
} catch (err) {
  console.error('[Main] Failed to get __dirname:', err)
  __dirname = app.getAppPath() // Fallback
}
console.log('[Main] __dirname:', __dirname)

// Use a stable icon path (not Vite-hashed) for tray/window icons.
// This file is packaged because the whole `electron/` folder is included.
let iconPath = null
try {
  iconPath = path.join(__dirname, 'assets', 'icon.png')
  if (!fs.existsSync(iconPath)) {
    console.warn('[Main] Icon not found:', iconPath)
    iconPath = null
  }
} catch (err) {
  console.warn('[Main] Error resolving icon path:', err)
  iconPath = null
}

let win = null
let tray = null
let isQuitting = false
let closeBehavior = 'tray' // 'tray' | 'close'

/* ======================================================
   SINGLE INSTANCE LOCK
   ====================================================== */
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance is already running - quit this one immediately
  app.quit()
} else {
  // This is the primary instance - listen for second-instance attempts
  app.on('second-instance', () => {
    // Someone tried to run a second instance, show our window instead
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
}

/* ======================================================
   WINDOW / TRAY
   ====================================================== */
function showMainWindow() {
  if (!win) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createTray() {
  if (tray) return
  try {
    const image = iconPath
      ? nativeImage.createFromPath(iconPath)
      : nativeImage.createEmpty()
    tray = new Tray(image)
    tray.setToolTip('Octo Player')

    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Show Octo Player', click: showMainWindow },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            isQuitting = true
            app.quit()
          }
        }
      ])
    )

    tray.on('click', showMainWindow)
    tray.on('double-click', showMainWindow)
  } catch (err) {
    // Prevent tray initialization issues from crashing the app.
    console.error('[Main] Failed to create tray:', err)
    tray = null
  }
}

function createWindow() {
  console.log('[Main] createWindow: Starting...')
  
  win = new BrowserWindow({
    title: 'Octo Player',
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f0e15',
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      // Preload must be CommonJS (.cjs) due to Electron's preload requirements
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      backgroundThrottling: false
    }
  })

  console.log('[Main] createWindow: BrowserWindow created')

  const resolveIndexHtml = () => {
    const candidates = [
      // Most common (electron-builder): app.getAppPath() points to .../resources/app.asar
      path.join(app.getAppPath(), 'dist', 'index.html'),
      // Fallbacks (rare): explicit resources-based paths
      path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html')
    ]
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p
      } catch {
        // ignore
      }
    }
    return candidates[0]
  }

  try {
    if (app.isPackaged) {
      const htmlPath = resolveIndexHtml()
      log('[Main] Loading from:', htmlPath)
      win.loadFile(htmlPath)
    } else {
      log('[Main] Loading dev server')
      win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
    }
  } catch (err) {
    log('[Main] Error loading HTML:', err)
  }

  // Capture renderer errors even in production (written to main.log)
  try {
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      log('[Renderer]', { level, message, line, sourceId })
    })
  } catch {
    // ignore
  }

  win.webContents.on('did-finish-load', () => {
    try {
      log('[Main] did-finish-load URL:', win?.webContents?.getURL?.())
    } catch {
      // ignore
    }
  })

  // Dev-only: open devtools automatically
  if (!app.isPackaged) {
    setTimeout(() => {
      try {
        if (win && win.webContents) {
          win.webContents.openDevTools({ mode: 'detach' })
        }
      } catch (err) {
        console.error('[Main] Failed to open devtools:', err)
      }
    }, 500)
  }

  // Optional: enable devtools in packaged builds when debugging a blank screen.
  // Set env var before launching: OCTO_DEVTOOLS=1
  if (app.isPackaged && process.env.OCTO_DEVTOOLS === '1') {
    setTimeout(() => {
      try {
        win?.webContents?.openDevTools?.({ mode: 'detach' })
      } catch (err) {
        log('[Main] Failed to open devtools (packaged):', err)
      }
    }, 500)
  }

  // Log errors from the renderer process
  win.webContents.on('crashed', () => {
    console.error('[Main] Renderer process crashed')
  })
  
  win.webContents.on('render-process-gone', (event, details) => {
    log('[Main] Render process gone:', details)
  })

  // Log if file fails to load
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log('[Main] Failed to load URL:', validatedURL, 'Error:', errorCode, errorDescription)
  })

  win.on('close', e => {
    if (isQuitting || process.platform === 'darwin') return
    if (closeBehavior === 'close') {
      isQuitting = true
      return
    }
    e.preventDefault()
    win.hide()
    createTray()
  })

  win.on('closed', () => {
    win = null
  })

  console.log('[Main] createWindow: Complete')
}

/* ======================================================
   APP LIFECYCLE
   ====================================================== */
console.log('[Main] Setting up app.whenReady...')

const readyPromise = app.whenReady()
console.log('[Main] whenReady promise created')

readyPromise.then(() => {
  try {
    // Ensure paths and logging are initialized after Electron is ready.
    initUserDataPath()
    initFileLogging()

    console.log('[Main] App is ready - entered then block')

    // Diagnostics from preload/renderer (useful for blank-screen issues)
    ipcMain.on('octo:preload-ready', (_event, payload) => {
      log('[Preload] ready', payload)
    })
    ipcMain.on('octo:renderer-error', (_event, payload) => {
      log('[Renderer] window.error', payload)
    })
    ipcMain.on('octo:renderer-unhandledrejection', (_event, payload) => {
      log('[Renderer] unhandledrejection', payload)
    })

    // Renderer persistence (sync IPC)
    ipcMain.on('storage:getSync', (event, key) => {
      event.returnValue = kvGet(key)
    })
    ipcMain.on('storage:setSync', (event, key, value) => {
      event.returnValue = kvSet(key, value)
    })
    ipcMain.on('storage:removeSync', (event, key) => {
      event.returnValue = kvRemove(key)
    })

    // IPC handlers (called from electron/preload.cjs)
    ipcMain.handle('emby:systemInfo', async (_event, { url, token }) => {
      const res = await fetch(url, {
        headers: embyClientHeaders(token)
      })
      await throwIfNotOk(res)
      return await res.json()
    })

    ipcMain.handle(
      'emby:authenticateByName',
      async (_event, { url, username, password }) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            ...embyClientHeaders(null),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ Username: username, Pw: password })
        })
        await throwIfNotOk(res)
        return await res.json()
      }
    )

    ipcMain.handle('emby:fetchJson', async (_event, { url, token }) => {
      const res = await fetch(url, {
        headers: embyClientHeaders(token)
      })
      await throwIfNotOk(res)
      return await res.json()
    })

    ipcMain.handle('emby:fetchImage', async (_event, { url, token }) => {
      const res = await fetch(url, {
        headers: embyClientHeaders(token)
      })
      // Missing images are expected (Emby returns 404 for absent kinds).
      // Treat as a cache-miss instead of surfacing as an error.
      if (res.status === 404) return ''
      await throwIfNotOk(res)

      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const contentType = res.headers.get('content-type') || 'image/png'
      return `data:${contentType};base64,${base64}`
    })

    ipcMain.handle(
      'emby:postJson',
      async (_event, { url, token, body, contentType }) => {
        const headers = embyClientHeaders(token)
        if (contentType) headers['Content-Type'] = contentType

        const res = await fetch(url, {
          method: 'POST',
          headers,
          body
        })
        await throwIfNotOk(res)

        const contentTypeHeader = res.headers.get('content-type') || ''
        if (contentTypeHeader.includes('application/json')) {
          return await res.json()
        }
        return await res.text()
      }
    )

    ipcMain.handle('emby:deleteJson', async (_event, { url, token }) => {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: embyClientHeaders(token)
      })
      await throwIfNotOk(res)

      const contentTypeHeader = res.headers.get('content-type') || ''
      if (contentTypeHeader.includes('application/json')) {
        return await res.json()
      }
      return await res.text()
    })

    ipcMain.handle('window:minimize', event => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) window.minimize()
    })

    ipcMain.handle('window:close', event => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window) {
        window.close()
      }
    })

    ipcMain.handle('settings:setCloseBehavior', (_event, behavior) => {
      if (behavior === 'tray' || behavior === 'close') {
        closeBehavior = behavior
        console.log('[IPC] Close behavior set to:', behavior)
      }
    })
    
    createWindow()
    console.log('[Main] Window created - after createWindow call')

    if (!app.isPackaged) {
      globalShortcut.register('Control+Shift+I', () => {
        const w = BrowserWindow.getAllWindows()[0]
        if (w) w.webContents.toggleDevTools()
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
    
    console.log('[Main] Event listeners registered')
  } catch (err) {
    console.error('[Main] ERROR in whenReady:', err)
    console.error('[Main] Stack:', err.stack)
    process.exit(1)
  }
}).catch(err => {
  console.error('[Main] whenReady promise REJECTED:', err)
  console.error('[Main] Stack:', err.stack)
  process.exit(1)
})

console.log('[Main] Setup complete, waiting for app ready')

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  if (tray && !isQuitting) return
  app.quit()
})
