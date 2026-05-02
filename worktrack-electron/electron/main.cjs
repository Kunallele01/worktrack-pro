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

// Generates a 32x32 blue circle PNG via pure Node.js — no external icon file needed.
function makeTrayIcon() {
  const { deflateSync } = require('zlib')
  const S = 32

  const crcTable = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    crcTable[i] = c
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
  }
  function mkChunk(type, data) {
    const tb = Buffer.from(type, 'ascii')
    const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(data.length)
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])))
    return Buffer.concat([lenBuf, tb, data, crcBuf])
  }

  // Build 32x32 RGBA scanlines: blue circle (#4f86f7) on transparent background
  const cx = S / 2 - 0.5, cy = S / 2 - 0.5, r = S / 2 - 2
  const rows = []
  for (let y = 0; y < S; y++) {
    const row = Buffer.alloc(1 + S * 4)   // filter byte (None=0) + RGBA pixels
    for (let x = 0; x < S; x++) {
      const dx = x - cx, dy = y - cy
      const d  = Math.sqrt(dx * dx + dy * dy)
      const off = 1 + x * 4
      let alpha = d < r - 1 ? 255 : d <= r ? Math.round(255 * (r - d)) : 0
      if (alpha > 0) { row[off] = 79; row[off+1] = 134; row[off+2] = 247; row[off+3] = alpha }
    }
    rows.push(row)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8; ihdr[9] = 6  // 8-bit RGBA

  return nativeImage.createFromBuffer(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    mkChunk('IHDR', ihdr),
    mkChunk('IDAT', deflateSync(Buffer.concat(rows))),
    mkChunk('IEND', Buffer.alloc(0)),
  ]))
}

function createTray() {
  const icon = makeTrayIcon()
  try {
    tray = new Tray(icon)
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
  Menu.setApplicationMenu(null)  // Remove File/Edit/View/Window/Help bar
  allowGeolocation()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
