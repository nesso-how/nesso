import assert from 'node:assert/strict'
import { once } from 'node:events'
import { ipcMain } from 'electron'
import { waitFor, type CheckContext } from './helpers.ts'

export async function verifyStartup({ window, url }: CheckContext) {
  let release = () => {}
  const hold = () =>
    new Promise((resolve) => {
      release = () => resolve({ value: { safeMode: false, packages: [], issues: [] } })
    })
  let listing = hold()
  ipcMain.handle('plugins:list', () => listing)
  ipcMain.handle('storage:session', () => 0)
  ipcMain.handle('storage:read', () => ({ value: undefined }))
  ipcMain.handle('storage:write', () => ({ value: null }))
  const inspect = () =>
    window.webContents.executeJavaScript(`({
    splash: !!document.querySelector('.splash'),
    playing: !!document.querySelector('.splash.is-playing'),
    busy: document.querySelector('.splash')?.getAttribute('aria-busy'),
    intro: !!document.querySelector('.intro') && !document.querySelector('.intro').closest('[inert]'),
    warnings: document.querySelectorAll('[data-slot="toast"][data-tone="warning"]').length,
    recovery: !!document.querySelector('.startup-recovery')
  })`) as Promise<{
      splash: boolean
      playing: boolean
      busy: string | null
      intro: boolean
      warnings: number
      recovery: boolean
    }>

  await window.loadURL(url)
  await waitFor(inspect, (state) => state.busy === 'true')
  const branding = await window.webContents.executeJavaScript(`(async () => {
    const source = await (await fetch(new URL('logo.svg', document.baseURI))).text()
    const logo = new DOMParser().parseFromString(source, 'image/svg+xml')
    return {
      wordmark: document.querySelector('.splash-wordmark')?.getAttribute('d'),
      logoWordmark: logo.querySelector('#wordmark')?.getAttribute('d'),
      text: document.querySelectorAll('.splash-logo text').length + logo.querySelectorAll('text').length
    }
  })()`)
  assert.ok(branding.wordmark)
  assert.equal(branding.wordmark, branding.logoWordmark)
  assert.equal(branding.text, 0)
  await window.webContents.executeJavaScript(
    `document.querySelector('.splash').dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}))`,
  )
  await window.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 1100))')
  assert.equal((await inspect()).splash, true)
  assert.equal((await inspect()).intro, false)
  const recovered = await waitFor(inspect, (state) => state.intro)
  assert.equal(recovered.splash, false)
  assert.equal(recovered.warnings, 1)
  assert.equal(recovered.recovery, false)
  release()

  listing = hold()
  const reloaded = once(window.webContents, 'did-finish-load')
  window.webContents.reload()
  await reloaded
  const refreshing = await waitFor(inspect, (state) => state.busy === 'true')
  assert.equal(refreshing.playing, false)
  release()
  const ready = await waitFor(inspect, (state) => state.intro)
  assert.equal(ready.splash, false)
  assert.equal(ready.warnings, 0)
}
