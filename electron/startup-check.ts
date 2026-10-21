import { app } from 'electron'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { ElectronError } from './errors.ts'

export function connectStartupCheck(profile: string): void {
  if (!path.isAbsolute(profile)) throw new ElectronError([{ path: 'startup-check', message: 'Expected an absolute profile path' }])
  app.setPath('userData', profile)
  const fail = (error: unknown) => {
    console.error(error)
    app.exit(1)
  }
  const deadline = setTimeout(() => fail(new ElectronError([{ path: 'startup-check', message: 'Startup timed out' }])), 45_000)
  process.on('uncaughtException', fail)
  process.on('unhandledRejection', fail)
  app.on('browser-window-created', (_event, window) => {
    window.webContents.on('preload-error', (_event, _file, error) => fail(error))
    window.webContents.on('render-process-gone', (_event, details) => fail(details))
    window.webContents.on('did-fail-load', (_event, code, description) => fail({ code, description }))
    window.webContents.once('did-finish-load', () => {
      void window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        window.addEventListener('error', (event) => reject(event.message))
        window.addEventListener('unhandledrejection', (event) => reject(String(event.reason)))
        const timer = setInterval(() => {
          document.querySelector('.intro-header button')?.click()
          if (!document.querySelector('#canvas .react-flow')) return
          clearInterval(timer)
          if (!window.nessoPersistence || !window.nessoPlugins || !window.nessoDataLocation) {
            reject('Desktop preload bridges are missing')
          } else resolve(true)
        }, 100)
      })`).then(() => {
        writeFileSync(path.join(profile, 'startup-ready'), 'ready')
        app.quit()
      }).catch(fail)
    })
  })
  app.once('will-quit', () => clearTimeout(deadline))
}
