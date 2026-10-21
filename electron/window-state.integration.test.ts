import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import type { BrowserWindow, Rectangle } from 'electron'
import { createWindowState } from './window-state.ts'

const fixture = (context: TestContext) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nesso-window-'))
  context.after(() => rmSync(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'window-state.json')
  const open = (workArea = { x: 0, y: 25, width: 1920, height: 1055 }) => createWindowState(directory, () => workArea)
  const bounds: Rectangle = { x: 120, y: 90, width: 1100, height: 740 }
  const window = Object.assign(new EventEmitter(), {
    getNormalBounds: () => bounds,
    isMaximized: (): boolean => false,
    isMinimized: (): boolean => false,
  })
  const initial = open()
  initial.track(window as unknown as BrowserWindow)
  return { file, open, bounds, window, initial }
}

test('closing and reopening restores window bounds', (context) => {
  const { open, bounds, window, initial } = fixture(context)
  assert.deepEqual(initial.bounds, { width: 1280, height: 800 })
  window.emit('close')
  assert.deepEqual(open().bounds, bounds)
  assert.equal(open().maximized, false)
})

test('maximized and minimized windows retain their normal bounds', (context) => {
  const { open, bounds, window } = fixture(context)
  window.emit('maximize')
  window.emit('close')
  assert.equal(open().maximized, true)
  window.isMinimized = () => true
  window.emit('unmaximize')
  window.emit('close')
  assert.deepEqual(open().bounds, bounds)
  assert.equal(open().maximized, true)
  window.isMinimized = () => false
  window.emit('unmaximize')
  window.emit('close')
  assert.equal(open().maximized, false)
})

test('restored bounds fit the available screen after a monitor is disconnected', (context) => {
  const { open, bounds, window } = fixture(context)
  Object.assign(bounds, { x: 2400, y: 300, width: 1600, height: 1200 })
  window.emit('close')
  const screen = { x: 0, y: 25, width: 1280, height: 775 }
  assert.deepEqual(open(screen).bounds, screen)
})

test('positions on monitors with negative coordinates are preserved', (context) => {
  const { open, bounds, window } = fixture(context)
  Object.assign(bounds, { x: -1500, y: -100, width: 1100, height: 740 })
  window.emit('close')
  assert.deepEqual(open({ x: -1920, y: -200, width: 1920, height: 1080 }).bounds, bounds)
})

test('invalid window state falls back to defaults without blocking startup', (context) => {
  const { file, open } = fixture(context)
  context.mock.method(console, 'error', () => {})
  for (const value of ['{', JSON.stringify({ bounds: { x: 0, y: 0, width: -1, height: 800 }, maximized: false })]) {
    writeFileSync(file, value)
    assert.deepEqual(open().bounds, { width: 1280, height: 800 })
  }
})

test('window state write failures do not prevent closing', (context) => {
  const { file, window } = fixture(context)
  context.mock.method(console, 'error', () => {})
  rmSync(path.dirname(file), { recursive: true })
  assert.doesNotThrow(() => window.emit('close'))
})
