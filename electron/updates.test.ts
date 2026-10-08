import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test, { type TestContext } from 'node:test'
import type { AutoUpdater } from 'electron'
import type { AppUpdater } from 'electron-updater'
import { connectUpdates } from './updates.ts'

const fixture = (context: TestContext) => {
  context.mock.method(globalThis, 'setInterval', () => ({ unref() {} }) as NodeJS.Timeout)
  context.mock.method(console, 'error', () => {})
  const updater = Object.assign(new EventEmitter(), {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowDowngrade: true,
    checkForUpdates: context.mock.fn(async () => null),
    downloadUpdate: context.mock.fn(async () => [] as string[]),
    quitAndInstall: context.mock.fn(),
  })
  const nativeUpdater = Object.assign(new EventEmitter(), { checkForUpdates: context.mock.fn() })
  const updates = connectUpdates(updater as unknown as AppUpdater, nativeUpdater as unknown as AutoUpdater, () => {})
  return { updater, nativeUpdater, updates }
}

test('updates download only on click and restart only after native validation and successful saving', async (context) => {
  const { updater, nativeUpdater, updates } = fixture(context)
  assert.equal(updater.autoDownload, false)
  assert.equal(updater.autoInstallOnAppQuit, false)
  assert.equal(updater.allowDowngrade, false)
  await updates.download()
  updates.install(true)
  assert.equal(updater.downloadUpdate.mock.callCount(), 0)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)

  updater.emit('update-available')
  await Promise.all([updates.download(), updates.download()])
  assert.equal(updater.downloadUpdate.mock.callCount(), 1)
  updater.emit('update-downloaded')
  assert.equal(nativeUpdater.checkForUpdates.mock.callCount(), 1)
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  nativeUpdater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'installing' })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
})

test('failed downloads do not restart the app and can be retried', async (context) => {
  const { updater, updates } = fixture(context)
  updater.emit('update-available')
  updater.downloadUpdate.mock.mockImplementationOnce(async () => { throw new Error('Download failed') })
  await updates.download()
  assert.deepEqual(updates.getState(), { status: 'available', error: 'download' })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  await updates.download()
  assert.equal(updater.downloadUpdate.mock.callCount(), 2)
})

test('failed or missing save acknowledgements prevent restarting and allow retrying', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, nativeUpdater, updates } = fixture(context)
  updater.emit('update-available')
  await updates.download()
  nativeUpdater.emit('update-downloaded')
  updates.install(false)
  assert.deepEqual(updates.getState(), { status: 'available', error: 'save' })
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  await updates.download()
  nativeUpdater.emit('update-downloaded')
  context.mock.timers.tick(10_000)
  assert.deepEqual(updates.getState(), { status: 'available', error: 'save' })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
})
