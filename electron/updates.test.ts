import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test, { type TestContext } from 'node:test'
import type { AutoUpdater } from 'electron'
import type { AppUpdater } from 'electron-updater'
import { connectUpdates, type UpdateState } from './updates.ts'

const fixture = (context: TestContext, checkForUpdates = async () => null, nativeUpdates = true) => {
  let check = () => {}
  const interval = context.mock.method(globalThis, 'setInterval', (callback: () => void) => {
    check = callback
    return { unref() {} } as NodeJS.Timeout
  })
  context.mock.method(console, 'error', () => {})
  const updater = Object.assign(new EventEmitter(), {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowDowngrade: true,
    checkForUpdates: context.mock.fn(checkForUpdates),
    downloadUpdate: context.mock.fn(async () => [] as string[]),
    quitAndInstall: context.mock.fn(),
  })
  const nativeUpdater = Object.assign(new EventEmitter(), { checkForUpdates: context.mock.fn() })
  const notify = context.mock.fn((_state: UpdateState) => {})
  const updates = connectUpdates(updater as unknown as AppUpdater, nativeUpdates ? nativeUpdater as unknown as AutoUpdater : undefined, notify)
  return { updater, nativeUpdater, updates, notify, interval, check: () => check() }
}

test('updates check at startup and hourly without overlap, retrying after failure', async (context) => {
  const pending = Promise.withResolvers<null>()
  const { updater, updates, interval, check } = fixture(context, () => pending.promise)
  assert.equal(updater.checkForUpdates.mock.callCount(), 1)
  assert.equal(interval.mock.calls[0].arguments[1], 60 * 60 * 1000)
  check()
  assert.equal(updater.checkForUpdates.mock.callCount(), 1)
  pending.reject(new Error('Offline'))
  await pending.promise.catch(() => {})
  assert.equal(updates.getState(), null)
  updater.checkForUpdates.mock.mockImplementationOnce(async () => null)
  check()
  assert.equal(updater.checkForUpdates.mock.callCount(), 2)
})

test('updates download automatically but restart only after confirmation, validation and saving', (context) => {
  const { updater, nativeUpdater, updates, notify, check } = fixture(context)
  assert.equal(updater.autoInstallOnAppQuit, false)

  updater.emit('update-available')
  assert.deepEqual(updates.getState(), { status: 'downloading' })
  assert.equal(updater.downloadUpdate.mock.callCount(), 1)
  updates.restart()
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updater.emit('update-downloaded')
  assert.equal(nativeUpdater.checkForUpdates.mock.callCount(), 1)
  nativeUpdater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'ready' })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  const notifications = notify.mock.callCount()
  check()
  assert.equal(notify.mock.callCount(), notifications + 1)
  assert.equal(updater.checkForUpdates.mock.callCount(), 1)
  updates.restart()
  assert.deepEqual(updates.getState(), { status: 'installing' })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
})

test('failed downloads are retried automatically at the next interval', async (context) => {
  const { updater, updates, check } = fixture(context)
  updater.downloadUpdate.mock.mockImplementationOnce(async () => { throw new Error('Download failed') })
  updater.emit('update-available')
  await Promise.resolve()
  assert.equal(updates.getState(), null)
  updates.restart()
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updater.checkForUpdates.mock.mockImplementationOnce(async () => {
    updater.emit('update-available')
    return null
  })
  check()
  assert.equal(updater.downloadUpdate.mock.callCount(), 2)
  assert.deepEqual(updates.getState(), { status: 'downloading' })
})

test('Windows and Linux updates become ready without the macOS native updater', (context) => {
  const { updater, nativeUpdater, updates } = fixture(context, async () => null, false)
  updater.emit('update-downloaded')
  assert.equal(updates.getState(), null)
  updater.emit('update-available')
  updater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'ready' })
  assert.equal(nativeUpdater.checkForUpdates.mock.callCount(), 0)
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updates.restart()
  updates.install(false)
  assert.deepEqual(updates.getState(), { status: 'ready', error: 'save' })
  updates.restart()
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
})

test('failed or missing save acknowledgements prevent restarting and allow retrying', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, nativeUpdater, updates } = fixture(context)
  updater.emit('update-available')
  updater.emit('update-downloaded')
  nativeUpdater.emit('update-downloaded')
  updates.restart()
  updates.install(false)
  assert.deepEqual(updates.getState(), { status: 'ready', error: 'save' })
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updates.restart()
  context.mock.timers.tick(10_000)
  assert.deepEqual(updates.getState(), { status: 'ready', error: 'save' })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updates.restart()
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
  assert.equal(updater.downloadUpdate.mock.callCount(), 1)
})
