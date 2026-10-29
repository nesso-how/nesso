import { app, autoUpdater, BrowserWindow, dialog, ipcMain, protocol, screen, session, shell, type WebContents } from 'electron'
import electronUpdater from 'electron-updater'
import path from 'node:path'
import { ElectronError } from './errors.ts'
import { connectUpdates } from './updates.ts'
import { connectAi } from './ai.ts'
import { connectMcp } from './mcp.ts'
import { connectExternalLinks } from './links.ts'
import { connectDesktopPersistence } from './persistence.ts'
import { createTrustedRequest } from './ipc.ts'
import { createDataLocation } from './data-location.ts'
import { connectDataLocation } from './data-location-ipc.ts'
import { serveAppAsset } from './asset-protocol.ts'
import { connectFiles } from './files.ts'
import { connectPlugins } from './plugins.ts'
import { connectStartupCheck } from './startup-check.ts'
import { createWindowState } from './window-state.ts'

const dev = !app.isPackaged && process.argv.includes('--dev')
const root = path.join(app.getAppPath(), 'dist')
const startupCheckProfile = process.env.NESSO_STARTUP_CHECK_PROFILE
if (startupCheckProfile) connectStartupCheck(startupCheckProfile)

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
  const url = dev ? 'http://127.0.0.1:5173/' : 'nesso://app/'
  const state = createWindowState(app.getPath('userData'), screen)
  const window = new BrowserWindow({
    ...state.bounds, show: false, backgroundColor: '#ffffff',
    icon: path.join(root, 'icon-512.png'),
    webPreferences: { preload: path.join(import.meta.dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  })
  state.track(window)
  connectPersistence(window)
  window.webContents.on('will-navigate', (event) => { if (event.url !== url) event.preventDefault() })
  connectExternalLinks(window.webContents, (url) => shell.openExternal(url))
  await window.loadURL(url)
  window.setBounds(state.bounds)
  if (state.maximized) window.maximize()
  window.show()
}

app.whenReady().then(async () => {
  const trusted = createTrustedRequest(dev)
  connectFiles(trusted)
  connectPlugins(trusted)
  const location = await createDataLocation(app.getPath('userData'))
  const ai = connectAi(trusted, location)
  const mcp = connectMcp(trusted, location)
  let installingUpdate = false
  const dataLocation = connectDataLocation(trusted, location, () => installingUpdate || ai.busy() || mcp.busy())
  const connectPersistence = connectDesktopPersistence(trusted, location, dataLocation.locked)
  const allowedPermissions = ['clipboard-read', 'clipboard-sanitized-write', 'fileSystem']
  const canUsePermission = (contents: WebContents | null, permission: string, details: { isMainFrame: boolean; requestingUrl?: string }): boolean =>
    allowedPermissions.includes(permission)
    && details.isMainFrame && details.requestingUrl === (dev ? 'http://127.0.0.1:5173/' : 'nesso://app/')
    && BrowserWindow.getAllWindows().some((window) => window.webContents === contents && contents.mainFrame.url === details.requestingUrl)
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) => canUsePermission(contents, permission, details))
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(canUsePermission(contents, permission, details)))
  protocol.handle('nesso', (request) => serveAppAsset(root, request))
  if (app.isPackaged && !startupCheckProfile) {
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
