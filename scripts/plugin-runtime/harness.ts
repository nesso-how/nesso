import { app, BrowserWindow, protocol, session } from 'electron'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import assert from 'node:assert/strict'
import { serveAppAsset } from '../../electron/asset-protocol.ts'
import { desktopHostCsp } from '../../shared/plugin-policy.ts'
import { cases, type Platform, type Scenario } from './cases.ts'
import type { CheckContext } from './helpers.ts'
import { verifyDefinitions, verifyWorker } from './security.ts'
import { verifyBundled } from './bundled.ts'

const [scenario, name, profile] = process.argv.slice(2) as [Scenario, Platform, string]
assert.ok(Object.hasOwn(cases, scenario) && (cases[scenario] as readonly string[]).includes(name) && profile)
app.setPath('userData', profile)
app.on('window-all-closed', () => {})
protocol.registerSchemesAsPrivileged([{ scheme: 'nesso', privileges: { standard: true, secure: true, supportFetchAPI: true } }])

let stage = 'initialization'
const deadline = setTimeout(() => {
  console.error(`${scenario}/${name}: timed out during ${stage}`)
  app.exit(1)
}, 60_000)

app.whenReady().then(async () => {
  const root = path.resolve(import.meta.dirname, '../../dist')
  const host = '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="frame-src \'self\'; object-src \'none\'"></head><body></body></html>'
  protocol.handle('nesso', (request) => new URL(request.url).pathname === '/'
    ? new Response(host, { headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': desktopHostCsp } })
    : serveAppAsset(root, request))
  const attempted: string[] = []
  session.defaultSession.webRequest.onBeforeRequest((request, callback) => { if (request.url.includes('plugin-probe')) attempted.push(request.url); callback({}) })
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      if (url.pathname === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }).end(host); return }
      const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`)
      if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return }
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png' }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(file))
    } catch { response.writeHead(404).end() }
  })
  let url = 'nesso://app/'
  if (name === 'static-web') {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    url = `http://127.0.0.1:${address.port}/`
  }
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, backgroundThrottling: false, ...(name === 'desktop' ? { preload: path.resolve('dist-electron/electron/preload.cjs') } : {}) } })
  window.webContents.on('will-navigate', (event) => { if (event.url !== url) event.preventDefault() })
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error' && !/Content Security Policy|sandboxed|violates|Refused to connect/.test(event.message)) console.error(event.message.slice(0, 2048))
  })
  const context: CheckContext = { window, url, name, attempted }
  try {
    if (scenario !== 'worker') {
      stage = 'page loading'
      await window.loadURL(url)
    }
    stage = scenario
    switch (scenario) {
      case 'definitions': await verifyDefinitions(context); break
      case 'worker': await verifyWorker(context); break
      case 'bundled': await verifyBundled(context); break
    }
  } finally {
    window.destroy()
    server.close()
    clearTimeout(deadline)
  }
  console.log(`${scenario}/${name}: passed`)
  app.exit(0)
}).catch((error: unknown) => { console.error(`${scenario}/${name}: failed during ${stage}`, error); app.exit(1) })
