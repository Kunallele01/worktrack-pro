import { contextBridge, ipcRenderer } from 'electron'

// Expose safe, limited APIs to the renderer via window.api
contextBridge.exposeInMainWorld('api', {
  sendEmail:   (config)            => ipcRenderer.invoke('send-email', config),
  saveExcel:   (buffer, filename)  => ipcRenderer.invoke('save-excel', { buffer, filename }),
  setStartup:  (enabled)           => ipcRenderer.invoke('set-startup', enabled),
  getStartup:  ()                  => ipcRenderer.invoke('get-startup'),
  createTray:  ()                  => ipcRenderer.invoke('create-tray'),
  destroyTray: ()                  => ipcRenderer.invoke('destroy-tray'),
  getVersion:         ()        => ipcRenderer.invoke('get-version'),
  getWifiSSID:        ()        => ipcRenderer.invoke('get-wifi-ssid'),
  getWindowsLocation: ()        => ipcRenderer.invoke('get-windows-location'),
})
