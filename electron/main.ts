import {
  app,
  autoUpdater,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  screen,
  session,
  shell,
  webContents,
  type WebContents,
} from 'electron'
import electronUpdater from 'electron-updater'
import path from 'node:path'
import { ElectronError } from './errors.ts'
import { connectUpdates } from './updates.ts'
import { connectAi } from './ai.ts'
import { connectMcp } from './mcp.ts'
import { connectNotesLinks, connectExternalLinks } from './links.ts'
import { connectDesktopPersistence } from './persistence.ts'
import { appUrl, createTrustedRequest } from './ipc.ts'
import { createDataLocation } from './data-location/index.ts'
import { connectDataLocation } from './data-location/ipc.ts'
import { serveAppAsset } from './asset-protocol.ts'
import { connectFiles } from './files.ts'
import { connectPlugins } from './plugins.ts'
import { connectPluginTermination } from './plugin-termination.ts'
import { connectStartupCheck } from './startup-check.ts'
import { createWindowState } from './window-state.ts'
import { connectWindowZoom } from './zoom.ts'
import { createRecordReplacement } from './record-replacement.ts'
import { connectMenu, connectTabShortcuts } from './menu.ts'
import { createAutomaticBackups } from './automatic-backups.ts'
import { createFileStorage } from './file-storage.ts'
import { releasesUrl } from '../shared/link-policy.ts'

const dev = !app.isPackaged && process.argv.includes('--dev')
const rendererUrl = appUrl(dev)
const root = path.join(app.getAppPath(), 'dist')
const startupCheckProfile = process.env.NESSO_STARTUP_CHECK_PROFILE
const updateFeed = startupCheckProfile && process.env.NESSO_UPDATE_FEED
const updatesEnabled = app.isPackaged && (!startupCheckProfile || Boolean(updateFeed))
const installUpdatesOnQuit =
  !updateFeed && (process.platform === 'win32' || Boolean(process.env.APPIMAGE))
if (startupCheckProfile) connectStartupCheck(startupCheckProfile, Boolean(updateFeed))

if (!app.requestSingleInstanceLock()) app.exit(0)

protocol.registerSchemesAsPrivileged([
  { scheme: 'nesso', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const report = (error: unknown): void => {
  console.error(
    new ElectronError([
      { path: 'desktop', message: error instanceof Error ? error.message : String(error) },
    ]),
  )
  if (!app.isReady()) return app.exit(1)
  const choice = dialog.showMessageBoxSync({
    type: 'error',
    title: 'Nesso',
    ...(app.getLocale().startsWith('it')
      ? {
          message:
            'Impossibile aprire i dati locali. Verifica che la cartella dati e gli eventuali dischi esterni siano accessibili, poi riapri Nesso. Nessun dato è stato sostituito.',
          buttons: ['Chiudi', 'Scarica l’ultima versione'],
        }
      : {
          message:
            'Could not open local data. Make sure the data folder and any external drives are accessible, then reopen Nesso. No data has been replaced.',
          buttons: ['Close', 'Download latest version'],
        }),
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })
  if (choice !== 1) return app.exit(1)
  void shell.openExternal(releasesUrl).then(
    () => app.exit(1),
    () => app.exit(1),
  )
}

const createWindow = async (connectPersistence: (window: BrowserWindow) => void): Promise<void> => {
  const state = createWindowState(app.getPath('userData'), screen)
  const window = new BrowserWindow({
    ...state.bounds,
    show: false,
    backgroundColor: '#ffffff',
    icon: path.join(root, 'icon-512.png'),
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  })
  state.track(window)
  connectWindowZoom(window, app.getPath('userData'))
  connectPersistence(window)
  window.webContents.on('will-navigate', (event) => {
    if (event.url !== rendererUrl) event.preventDefault()
  })
  connectExternalLinks(window.webContents, (url) => shell.openExternal(url))
  connectTabShortcuts(window.webContents)
  await window.loadURL(rendererUrl)
  window.setBounds(state.bounds)
  if (state.maximized) window.maximize()
  window.show()
}

app
  .whenReady()
  .then(async () => {
    const trusted = createTrustedRequest(rendererUrl)
    connectMenu(trusted, dev)
    connectNotesLinks(ipcMain, trusted, (url) => shell.openExternal(url))
    connectFiles(trusted)
    connectPlugins(trusted)
    connectPluginTermination(ipcMain, trusted, () => webContents.getAllWebContents())
    const location = await createDataLocation(app.getPath('userData'))
    await createRecordReplacement(() => location.directory()).recover()
    const ai = connectAi(trusted, location)
    const mcp = connectMcp(trusted, location)
    let installingUpdate = false
    const automatic = await createAutomaticBackups(
      app.getPath('userData'),
      createFileStorage(() => location.directory()),
      app.getVersion(),
      location,
    )
    const dataLocation = connectDataLocation(
      trusted,
      location,
      () => installingUpdate || ai.busy() || mcp.busy(),
      automatic,
    )
    const connectPersistence = connectDesktopPersistence(
      trusted,
      location,
      dataLocation.locked,
      dataLocation.generation,
      automatic,
    )
    const allowedPermissions = ['clipboard-read', 'clipboard-sanitized-write', 'fileSystem']
    const canUsePermission = (
      contents: WebContents | null,
      permission: string,
      details: { isMainFrame: boolean; requestingUrl?: string },
    ): boolean =>
      allowedPermissions.includes(permission) &&
      details.isMainFrame &&
      details.requestingUrl === rendererUrl &&
      BrowserWindow.getAllWindows().some(
        (window) =>
          window.webContents === contents && contents.mainFrame.url === details.requestingUrl,
      )
    session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) =>
      canUsePermission(contents, permission, details),
    )
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
      callback(canUsePermission(contents, permission, details)),
    )
    protocol.handle('nesso', (request) => serveAppAsset(root, request))
    if (updatesEnabled) {
      if (updateFeed)
        electronUpdater.autoUpdater.setFeedURL({ provider: 'generic', url: updateFeed })
      const updates = connectUpdates(
        electronUpdater.autoUpdater,
        process.platform === 'darwin' ? autoUpdater : undefined,
        (state) => {
          installingUpdate = state?.status === 'saving' || state?.status === 'installing'
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('update:state', state)
            if (state?.status === 'saving') window.webContents.send('update:prepare')
          }
        },
        installUpdatesOnQuit,
      )
      ipcMain.on('update:subscribe', (event) => {
        if (trusted(event)) event.sender.send('update:state', updates.getState())
      })
      ipcMain.on('update:startup-complete', (event) => {
        if (trusted(event)) updates.start()
      })
      ipcMain.on('update:restart', (event) => {
        if (trusted(event) && !location.state().moving) updates.restart()
      })
      ipcMain.on('update:confirming', (event) => {
        if (trusted(event)) updates.confirming()
      })
      ipcMain.on('update:install', (event, saved: unknown) => {
        if (!trusted(event)) return
        updates.install(saved === true)
      })
    }
    await createWindow(connectPersistence)
    app.on('activate', () => {
      if (location.state().moving || dataLocation.locked()) return
      if (BrowserWindow.getAllWindows().length === 0)
        void createWindow(connectPersistence).catch(report)
    })
  })
  .catch(report)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
