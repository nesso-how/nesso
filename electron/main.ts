import { app, autoUpdater, BrowserWindow, dialog, ipcMain, net, protocol, session, shell, type WebContents } from 'electron'
import electronUpdater from 'electron-updater'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ElectronError } from './errors.ts'
import { connectUpdates } from './updates.ts'
import { connectAi } from './ai.ts'
import { connectMcp } from './mcp.ts'
import { connectExternalLinks } from './links.ts'
import { connectDesktopPersistence } from './persistence.ts'
import { createTrustedRequest } from './ipc.ts'
import { createDataLocation } from './data-location.ts'
import { connectDataLocation } from './data-location-ipc.ts'

const dev = !app.isPackaged && process.argv.includes('--dev')
const root = path.join(app.getAppPath(), 'dist')
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'"

if (!app.requestSingleInstanceLock()) app.exit(0)

protocol.registerSchemesAsPrivileged([
  { scheme: 'nesso', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const report = (error: unknown): void => {
  console.error(new ElectronError([{ path: 'desktop', message: error instanceof Error ? error.message : String(error) }]))
  if (app.isReady()) dialog.showErrorBox('Nesso', app.getLocale().startsWith('it')
    ? 'Impossibile aprire i dati locali. Verifica che la cartella dati e gli eventuali dischi esterni siano accessibili, poi riapri Nesso. Nessun dato è stato sostituito.'
    : 'Could not open local data. Make sure the data folder and any external drives are accessible, then reopen Nesso. No data has been replaced.')
  app.exit(1)
}

const createWindow = async (connectPersistence: (window: BrowserWindow) => void): Promise<void> => {
  const window = new BrowserWindow({
    width: 1280, height: 800, backgroundColor: '#ffffff',
    icon: path.join(root, 'icon-512.png'),
    webPreferences: { preload: path.join(import.meta.dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  })
  connectPersistence(window)
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  connectExternalLinks(window.webContents, (url) => shell.openExternal(url))
  await window.loadURL(dev ? 'http://127.0.0.1:5173' : 'nesso://app/')
}

app.whenReady().then(async () => {
  const trusted = createTrustedRequest(dev)
  const location = await createDataLocation(app.getPath('userData'))
  const ai = connectAi(trusted, location)
  const mcp = connectMcp(trusted, location)
  let installingUpdate = false
  const dataLocation = connectDataLocation(trusted, location, () => installingUpdate || ai.busy() || mcp.busy())
  const connectPersistence = connectDesktopPersistence(trusted, location, dataLocation.locked)
  const canUseClipboard = (contents: WebContents | null, permission: string, details: { isMainFrame: boolean; requestingUrl?: string }): boolean =>
    (permission === 'clipboard-read' || permission === 'clipboard-sanitized-write')
    && details.isMainFrame && details.requestingUrl === (dev ? 'http://127.0.0.1:5173/' : 'nesso://app/')
    && BrowserWindow.getAllWindows().some((window) => window.webContents === contents && contents.mainFrame.url === details.requestingUrl)
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => canUseClipboard(contents, permission, details))
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(canUseClipboard(contents, permission, details)))
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
  if (app.isPackaged) {
    const updates = connectUpdates(electronUpdater.autoUpdater, process.platform === 'darwin' ? autoUpdater : undefined, (state) => {
      installingUpdate = state?.status === 'installing'
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('update:state', state)
        if (state?.status === 'installing') window.webContents.send('update:prepare')
      }
    })
    ipcMain.on('update:subscribe', (event) => {
      if (trusted(event)) event.sender.send('update:state', updates.getState())
    })
    ipcMain.on('update:restart', (event) => {
      if (trusted(event) && !location.state().moving) updates.restart()
    })
    ipcMain.on('update:install', (event, saved: unknown) => {
      if (!trusted(event)) return
      updates.install(saved === true)
    })
  }
  await createWindow(connectPersistence)
  app.on('activate', () => {
    if (location.state().moving) return
    if (BrowserWindow.getAllWindows().length === 0) void createWindow(connectPersistence).catch(report)
  })
}).catch(report)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
