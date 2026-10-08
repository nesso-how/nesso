import { app, autoUpdater, BrowserWindow, ipcMain, nativeTheme, net, protocol, session, type IpcMainEvent } from 'electron'
import electronUpdater from 'electron-updater'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ElectronError } from './errors.ts'
import { connectUpdates } from './updates.ts'
import { connectAi } from './ai.ts'

const dev = !app.isPackaged && process.argv.includes('--dev')
const root = path.join(app.getAppPath(), 'dist')
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'"

nativeTheme.themeSource = 'light'

protocol.registerSchemesAsPrivileged([
  { scheme: 'nesso', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const report = (error: unknown): void => {
  console.error(new ElectronError([{ path: 'desktop', message: error instanceof Error ? error.message : String(error) }]))
  app.exit(1)
}

const createWindow = async (): Promise<void> => {
  const window = new BrowserWindow({
    width: 1280, height: 800, backgroundColor: '#ffffff',
    webPreferences: { preload: path.join(import.meta.dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  await window.loadURL(dev ? 'http://127.0.0.1:5173' : 'nesso://app/')
}

app.whenReady().then(async () => {
  connectAi(dev)
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  protocol.handle('nesso', async (request) => {
    const url = new URL(request.url)
    const file = path.resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`)
    if (url.host !== 'app' || !file.startsWith(`${root}${path.sep}`)) {
      return new Response(null, { status: 403 })
    }
    const response = await net.fetch(pathToFileURL(file).href)
    response.headers.set('Content-Security-Policy', csp)
    return response
  })
  if (app.isPackaged && process.platform === 'darwin') {
    const updates = connectUpdates(electronUpdater.autoUpdater, autoUpdater, (state) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('update:state', state)
        if (state?.status === 'installing') window.webContents.send('update:prepare')
      }
    })
    const trusted = (event: IpcMainEvent) =>
      BrowserWindow.getAllWindows().some((window) => window.webContents === event.sender)
      && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === 'nesso://app/'
    ipcMain.on('update:subscribe', (event) => {
      if (trusted(event)) event.sender.send('update:state', updates.getState())
    })
    ipcMain.on('update:restart', (event) => {
      if (trusted(event)) updates.restart()
    })
    ipcMain.on('update:install', (event, saved: unknown) => {
      if (!trusted(event)) return
      if (saved === true) event.sender.session.flushStorageData()
      updates.install(saved === true)
    })
  }
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow().catch(report)
  })
}).catch(report)

app.on('window-all-closed', () => {})
