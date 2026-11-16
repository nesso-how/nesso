import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test, { type TestContext } from 'node:test'
import type { IpcMain, IpcMainEvent, NativeTheme } from 'electron'
import { connectAppearance } from './appearance.ts'

const fixture = (context: TestContext) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nesso-appearance-'))
  context.after(() => rmSync(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'appearance.json')
  const open = (trusted = true) => {
    const ipc = new EventEmitter()
    const theme: Pick<NativeTheme, 'themeSource'> = { themeSource: 'system' }
    connectAppearance(ipc as unknown as IpcMain, () => trusted, theme, directory)
    const set = (value: unknown) => ipc.emit('appearance:set', {} as IpcMainEvent, value)
    return { theme, set }
  }
  return { file, open }
}

test('desktop appearance follows the system until the renderer sets it and restores it on launch', (context) => {
  const { open } = fixture(context)
  let window = open()
  assert.equal(window.theme.themeSource, 'system')
  for (const value of ['dark', 'light', 'system'] as const) {
    window.set(value)
    assert.equal(window.theme.themeSource, value)
    window = open()
    assert.equal(window.theme.themeSource, value)
  }
})

test('untrusted or invalid appearance requests and unreadable files leave the theme unchanged', (context) => {
  const { file, open } = fixture(context)
  const errors = context.mock.method(console, 'error', () => {})
  const untrusted = open(false)
  untrusted.set('dark')
  assert.equal(untrusted.theme.themeSource, 'system')
  const window = open()
  window.set('dim')
  assert.equal(window.theme.themeSource, 'system')
  writeFileSync(file, JSON.stringify({ appearance: 'dim' }))
  assert.equal(open().theme.themeSource, 'system')
  assert.equal(errors.mock.callCount(), 1)
})
