'use strict'

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, session, shell } = require('electron')
const path   = require('path')
const fs     = require('fs')
const os     = require('os')

let mainWindow = null
let tray       = null

// ── GPS permission ────────────────────────────────────────────────────────── //

function allowGeolocation() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'geolocation')
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'geolocation'
  })
}

// ── Window ────────────────────────────────────────────────────────────────── //

function createWindow() {
  const rendererPath = path.join(__dirname, '..', 'out', 'renderer', 'index.html')
  const preloadPath  = path.join(__dirname, '..', 'out', 'preload', 'preload.js')

  mainWindow = new BrowserWindow({
    width:  1280,
    height: 820,
    minWidth:  1100,
    minHeight: 720,
    backgroundColor: '#0A0E1A',
    show: false,
    webPreferences: {
      preload:          preloadPath,
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
      webSecurity:      false,   // Required for file:// to load local bundled assets
    },
  })

  mainWindow.center()
  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.on('close', (e) => {
    if (tray) { e.preventDefault(); mainWindow.hide() }
  })

  // Only log actual renderer crashes
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason !== 'clean-exit')
      console.error('[WorkTrack] Renderer crashed:', details.reason)
  })

  // Dev: load Vite dev server; Production: load built file
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(rendererPath)
  }
}

// ── System tray ───────────────────────────────────────────────────────────── //

function createTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'resources', 'icon.ico')
    tray = new Tray(fs.existsSync(iconPath) ? iconPath : nativeImage.createEmpty())
  } catch {
    tray = new Tray(nativeImage.createEmpty())
  }
  const menu = Menu.buildFromTemplate([
    { label: 'Open WorkTrack Pro', click: () => { mainWindow.show(); mainWindow.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { tray = null; app.quit() } },
  ])
  tray.setToolTip('WorkTrack Pro')
  tray.setContextMenu(menu)
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus() })
}

// ── IPC handlers ──────────────────────────────────────────────────────────── //

ipcMain.handle('send-email', async (_e, { host, port, user, pass, fromName, to, subject, html }) => {
  const nodemailer = require('nodemailer')
  const transporter = nodemailer.createTransport({
    host, port: Number(port), secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  })
  await transporter.sendMail({
    from:    `"${fromName}" <${user}>`,
    to:      Array.isArray(to) ? to.join(', ') : to,
    subject, html,
  })
  return { ok: true }
})

ipcMain.handle('save-excel', async (_e, { buffer, filename }) => {
  const dlDir   = path.join(os.homedir(), 'Downloads')
  const outPath = path.join(dlDir, filename)
  fs.writeFileSync(outPath, Buffer.from(buffer))
  shell.showItemInFolder(outPath)
  return outPath
})

ipcMain.handle('set-startup', (_e, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled })
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('get-startup', () => app.getLoginItemSettings().openAtLogin)

ipcMain.handle('create-tray',  () => { if (!tray) createTray() })
ipcMain.handle('destroy-tray', () => { if (tray) { tray.destroy(); tray = null } })
ipcMain.handle('get-version',  () => app.getVersion())

// WiFi SSID — used for office detection on desktops without GPS
ipcMain.handle('get-wifi-ssid', () => {
  try {
    const { execSync } = require('child_process')
    const out = execSync('netsh wlan show interfaces', { encoding: 'utf8', timeout: 3000 })
    // Match "    SSID                   : OfficeName"
    const m = out.match(/^\s+SSID\s+:\s+(.+)$/m)
    return m ? m[1].trim() : null
  } catch {
    return null
  }
})

// Windows Location via child Python process (most accurate on Windows desktops)
// Falls back gracefully if Python or winsdk not available
ipcMain.handle('get-windows-location', async () => {
  return new Promise((resolve) => {
    try {
      const { spawn } = require('child_process')
      const script = `
import asyncio, json, sys
async def go():
    try:
        import winsdk.windows.devices.geolocation as wdg
        g = wdg.Geolocator()
        g.desired_accuracy = wdg.PositionAccuracy.HIGH
        p = await asyncio.wait_for(g.get_geoposition_async(), timeout=12)
        c = p.coordinate
        print(json.dumps({"lat": c.latitude, "lon": c.longitude, "accuracy": c.accuracy}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
asyncio.run(go())
`
      const py = spawn('python', ['-c', script], { timeout: 15000 })
      let out = ''
      py.stdout.on('data', d => { out += d.toString() })
      py.on('close', () => {
        try { resolve(JSON.parse(out.trim())) }
        catch { resolve({ error: 'parse failed' }) }
      })
      py.on('error', () => resolve({ error: 'python not available' }))
    } catch (e) {
      resolve({ error: e.message })
    }
  })
})

// ── App lifecycle ─────────────────────────────────────────────────────────── //

app.whenReady().then(() => {
  allowGeolocation()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
