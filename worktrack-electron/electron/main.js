import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, session, shell } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { homedir } from 'os'

let mainWindow = null
let tray       = null

// ── Window ───────────────────────────────────────────────────────────────── //

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 820,
    minWidth:  1100,
    minHeight: 720,
    frame: true,
    titleBarStyle: 'default',
    backgroundColor: '#0A0E1A',
    show: false,
    webPreferences: {
      preload:         join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  })

  // Centre on screen
  mainWindow.center()

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Minimise to tray on close (when logged in)
  mainWindow.on('close', (e) => {
    if (tray) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── GPS permission ────────────────────────────────────────────────────────── //

function allowGeolocation() {
  // Grant geolocation permission so navigator.geolocation works in renderer
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'geolocation')
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return permission === 'geolocation'
  })
}

// ── System tray ───────────────────────────────────────────────────────────── //

function createTray() {
  // Generate a simple blue circle icon programmatically
  const iconData = nativeImage.createEmpty()
  const size     = { width: 16, height: 16 }
  // Use a simple native empty image with background colour
  // (a proper .ico can be set later)
  try {
    const iconPath = join(__dirname, '../../resources/icon.ico')
    tray = new Tray(iconPath)
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

// Email via nodemailer (runs in main process — has full Node.js access)
ipcMain.handle('send-email', async (_event, { host, port, user, pass, fromName, to, subject, html }) => {
  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.default.createTransport({
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

// Save Excel file to Downloads folder
ipcMain.handle('save-excel', async (_event, { buffer, filename }) => {
  const downloadsDir = join(homedir(), 'Downloads')
  const filePath     = join(downloadsDir, filename)
  writeFileSync(filePath, Buffer.from(buffer))
  shell.showItemInFolder(filePath)
  return filePath
})

// Enable/disable Windows startup
ipcMain.handle('set-startup', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled })
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('get-startup', () => {
  return app.getLoginItemSettings().openAtLogin
})

// Allow tray to be created from renderer after login
ipcMain.handle('create-tray', () => {
  if (!tray) createTray()
})

// Remove tray on logout so window can close properly
ipcMain.handle('destroy-tray', () => {
  if (tray) { tray.destroy(); tray = null }
})

ipcMain.handle('get-version', () => app.getVersion())

// ── App lifecycle ────────────────────────────────────────────────────────── //

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
