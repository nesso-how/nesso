import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import type { BrowserWindow } from 'electron'
import { ElectronError } from './errors.ts'
import { connectWindowZoom } from './zoom.ts'

const fixture = (context: TestContext) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nesso-zoom-'))
  context.after(() => rmSync(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'zoom.json')
  const open = () => {
    let level = 0
    const webContents = Object.assign(new EventEmitter(), {
      getZoomLevel: () => level,
      setZoomLevel: (value: number) => {
        level = value
      },
    })
    const window = Object.assign(new EventEmitter(), { webContents })
    connectWindowZoom(window as unknown as BrowserWindow, directory)
    webContents.emit('did-finish-load')
    return window
  }
  return { directory, file, open }
}

test('desktop zoom defaults to actual size, survives reload and restores saved levels', (context) => {
  const { open } = fixture(context)
  let window = open()
  assert.equal(window.webContents.getZoomLevel(), 0)
  for (const level of [1.5, 3.5, -1, 0]) {
    window.webContents.setZoomLevel(level)
    window.webContents.emit('did-finish-load')
    assert.equal(window.webContents.getZoomLevel(), level)
    window.emit('close')
    window = open()
    assert.equal(window.webContents.getZoomLevel(), level)
  }
})

test('unreadable or unknown-version zoom preferences are never overwritten', (context) => {
  const { file, open } = fixture(context)
  context.mock.method(console, 'error', () => {})
  for (const value of ['{', JSON.stringify({ version: 2, zoomLevel: 1 })]) {
    writeFileSync(file, value)
    const window = open()
    assert.equal(window.webContents.getZoomLevel(), 0)
    window.emit('close')
    assert.equal(readFileSync(file, 'utf8'), value)
  }
})

test('zoom preference write failures do not prevent closing', (context) => {
  const { directory, open } = fixture(context)
  const errors = context.mock.method(console, 'error', () => {})
  const window = open()
  rmSync(directory, { recursive: true })
  assert.doesNotThrow(() => window.emit('close'))
  assert.ok(errors.mock.calls[0]?.arguments[0] instanceof ElectronError)
})
