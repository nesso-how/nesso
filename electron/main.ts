import { app, BrowserWindow, nativeTheme, net, protocol, session } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

class ElectronError extends Error {
  override name = 'ElectronError'
  readonly issues: { path: string; message: string }[]
  constructor(issues: { path: string; message: string }[]) {
    super(issues.map(({ path, message }) => `${path}: ${message}`).join('\n'))
    this.issues = issues
  }
}

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
  const window = new BrowserWindow({ width: 1280, height: 800, backgroundColor: '#ffffff' })
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  await window.loadURL(dev ? 'http://127.0.0.1:5173' : 'nesso://app/')
}

app.whenReady().then(async () => {
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
  await createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow().catch(report)
  })
}).catch(report)

app.on('window-all-closed', () => {})
