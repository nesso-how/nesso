import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test, { type TestContext } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import type { CancellationToken } from 'builder-util-runtime'
import type { AutoUpdater } from 'electron'
import type { AppUpdater } from 'electron-updater'
import {
  connectUpdates,
  CONFIRM_TIMEOUT_MS,
  INSTALL_FEEDBACK_MS,
  INSTALL_TIMEOUT_MS,
  STARTUP_CHECK_FALLBACK_MS,
  type UpdateState,
} from './updates.ts'

const version = '1.0.0-alpha.28'

const fixture = (
  context: TestContext,
  checkForUpdates = async () => null,
  nativeUpdates = true,
  installOnQuit = false,
  startupComplete = true,
) => {
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
    downloadUpdate: context.mock.fn(async (_token: CancellationToken) => [] as string[]),
    quitAndInstall: context.mock.fn(),
  })
  const nativeUpdater = Object.assign(new EventEmitter(), { checkForUpdates: context.mock.fn() })
  const notify = context.mock.fn((_state: UpdateState) => {})
  const updates = connectUpdates(
    updater as unknown as AppUpdater,
    nativeUpdates ? (nativeUpdater as unknown as AutoUpdater) : undefined,
    notify,
    installOnQuit,
  )
  if (startupComplete) updates.start()
  return { updater, nativeUpdater, updates, notify, interval, check: () => check() }
}

test('updates check once startup completes and hourly without overlap, retrying after failure', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const pending = Promise.withResolvers<null>()
  const { updater, updates, interval, check } = fixture(
    context,
    () => pending.promise,
    true,
    false,
    false,
  )
  assert.equal(updater.checkForUpdates.mock.callCount(), 0)
  updates.start()
  updates.start()
  context.mock.timers.tick(STARTUP_CHECK_FALLBACK_MS)
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

test('updates still check after the fallback when startup never completes', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, updates } = fixture(context, async () => null, true, false, false)
  context.mock.timers.tick(STARTUP_CHECK_FALLBACK_MS - 1)
  assert.equal(updater.checkForUpdates.mock.callCount(), 0)
  context.mock.timers.tick(1)
  assert.equal(updater.checkForUpdates.mock.callCount(), 1)
  updates.start()
  assert.equal(updater.checkForUpdates.mock.callCount(), 1)
})

test('updates download automatically but restart only after confirmation, validation and saving', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, nativeUpdater, updates, notify, check } = fixture(context)
  assert.equal(updater.autoInstallOnAppQuit, false)

  updater.emit('update-available', { version })
  assert.deepEqual(updates.getState(), { status: 'downloading', version })
  assert.equal(updater.downloadUpdate.mock.callCount(), 1)
  updates.restart()
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updater.emit('update-downloaded')
  assert.equal(nativeUpdater.checkForUpdates.mock.callCount(), 1)
  nativeUpdater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'ready', version })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  const notifications = notify.mock.callCount()
  check()
  assert.equal(notify.mock.callCount(), notifications)
  assert.equal(updater.checkForUpdates.mock.callCount(), 1)
  updates.restart()
  assert.deepEqual(updates.getState(), { status: 'saving', version })
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updates.install(true)
  assert.deepEqual(updates.getState(), { status: 'installing', version })
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  context.mock.timers.tick(INSTALL_FEEDBACK_MS)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
})

test('failed downloads are reported and retried automatically at the next interval', async (context) => {
  const { updater, updates, check } = fixture(context)
  updater.downloadUpdate.mock.mockImplementationOnce(async () => {
    throw new Error('Download failed')
  })
  updater.emit('update-available', { version })
  await setImmediate()
  assert.deepEqual(updates.getState(), { status: 'downloading', version, error: 'download' })
  updates.restart()
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updater.checkForUpdates.mock.mockImplementationOnce(async () => {
    updater.emit('update-available', { version })
    return null
  })
  check()
  assert.equal(updater.downloadUpdate.mock.callCount(), 2)
  assert.deepEqual(updates.getState(), { status: 'downloading', version })
})

test('ready updates keep checking and download only newer versions, never while saving or installing', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, updates, check } = fixture(context, async () => null, false)
  await setImmediate()
  updater.emit('update-available', { version })
  updater.emit('update-downloaded')
  await setImmediate()
  for (const advertised of [version, '1.0.0-alpha.27']) {
    updater.checkForUpdates.mock.mockImplementationOnce(async () => {
      updater.emit('update-available', { version: advertised })
      return null
    })
    check()
    await setImmediate()
    assert.deepEqual(updates.getState(), { status: 'ready', version })
    assert.equal(updater.downloadUpdate.mock.callCount(), 1)
  }
  assert.equal(updater.checkForUpdates.mock.callCount(), 3)
  const newer = '1.0.0-alpha.29'
  updater.checkForUpdates.mock.mockImplementationOnce(async () => {
    updater.emit('update-available', { version: newer })
    return null
  })
  check()
  await setImmediate()
  assert.deepEqual(updates.getState(), { status: 'downloading', version: newer })
  assert.equal(updater.downloadUpdate.mock.callCount(), 2)
  updates.restart()
  assert.deepEqual(updates.getState(), { status: 'downloading', version: newer })
  updater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'ready', version: newer })
  updates.restart()
  check()
  updater.emit('update-available', { version: '1.0.0-alpha.30' })
  assert.deepEqual(updates.getState(), { status: 'saving', version: newer })
  updates.install(true)
  check()
  updater.emit('update-available', { version: '1.0.0-alpha.30' })
  assert.deepEqual(updates.getState(), { status: 'installing', version: newer })
  assert.equal(updater.checkForUpdates.mock.callCount(), 4)
  assert.equal(updater.downloadUpdate.mock.callCount(), 2)
})

test('stalled downloads are cancelled after an interval without progress and retried only after settling', async (context) => {
  const { updater, nativeUpdater, updates, check } = fixture(context)
  const pending = Promise.withResolvers<string[]>()
  updater.downloadUpdate.mock.mockImplementationOnce(() => pending.promise)
  updater.emit('update-available', { version })
  const token = updater.downloadUpdate.mock.calls[0].arguments[0]
  await setImmediate()
  check()
  assert.equal(token.cancelled, false)
  updater.emit('download-progress')
  check()
  assert.equal(token.cancelled, false)
  check()
  assert.equal(token.cancelled, true)
  assert.deepEqual(updates.getState(), { status: 'downloading', version, error: 'download' })
  updater.emit('update-downloaded')
  nativeUpdater.emit('update-downloaded')
  updates.restart()
  updates.install(true)
  check()
  updater.emit('update-available', { version })
  assert.deepEqual(updates.getState(), { status: 'downloading', version, error: 'download' })
  assert.equal(nativeUpdater.checkForUpdates.mock.callCount(), 0)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  assert.equal(updater.checkForUpdates.mock.callCount(), 1)
  assert.equal(updater.downloadUpdate.mock.callCount(), 1)
  pending.reject(new Error('cancelled'))
  await setImmediate()
  updater.checkForUpdates.mock.mockImplementationOnce(async () => {
    updater.emit('update-available', { version })
    return null
  })
  check()
  assert.equal(updater.downloadUpdate.mock.callCount(), 2)
  const retryToken = updater.downloadUpdate.mock.calls[1].arguments[0]
  assert.notEqual(retryToken, token)
  assert.equal(retryToken.cancelled, false)
  updater.emit('update-downloaded')
  nativeUpdater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'ready', version })
  await setImmediate()
  check()
  check()
  assert.equal(retryToken.cancelled, false)
})

test('stalled macOS staging after the download is reported and retried', async (context) => {
  const { updater, nativeUpdater, updates, check } = fixture(context)
  updater.emit('update-available', { version })
  await setImmediate()
  updater.emit('update-downloaded')
  assert.equal(nativeUpdater.checkForUpdates.mock.callCount(), 1)
  check()
  assert.deepEqual(updates.getState(), { status: 'downloading', version })
  check()
  assert.deepEqual(updates.getState(), { status: 'downloading', version, error: 'download' })
  assert.equal(updater.checkForUpdates.mock.callCount(), 2)
  await setImmediate()
  nativeUpdater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'downloading', version, error: 'download' })
  updater.checkForUpdates.mock.mockImplementationOnce(async () => {
    updater.emit('update-available', { version })
    return null
  })
  check()
  assert.equal(updater.downloadUpdate.mock.callCount(), 2)
  await setImmediate()
  updater.emit('update-downloaded')
  assert.equal(nativeUpdater.checkForUpdates.mock.callCount(), 2)
  nativeUpdater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'ready', version })
})

test('Windows and Linux updates become ready without the macOS native updater', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, nativeUpdater, updates } = fixture(context, async () => null, false)
  updater.emit('update-downloaded')
  assert.equal(updates.getState(), null)
  updater.emit('update-available', { version })
  updater.emit('update-downloaded')
  assert.deepEqual(updates.getState(), { status: 'ready', version })
  assert.equal(nativeUpdater.checkForUpdates.mock.callCount(), 0)
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updates.restart()
  updates.install(false)
  assert.deepEqual(updates.getState(), { status: 'ready', version, error: 'save' })
  updates.restart()
  updates.install(true)
  context.mock.timers.tick(INSTALL_FEEDBACK_MS)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
})

test('failed or missing save acknowledgements prevent restarting and allow retrying', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, nativeUpdater, updates } = fixture(context)
  updater.emit('update-available', { version })
  updater.emit('update-downloaded')
  nativeUpdater.emit('update-downloaded')
  updates.restart()
  updates.install(false)
  assert.deepEqual(updates.getState(), { status: 'ready', version, error: 'save' })
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updates.restart()
  context.mock.timers.tick(10_000)
  assert.deepEqual(updates.getState(), { status: 'ready', version, error: 'save' })
  updates.restart()
  updates.confirming()
  context.mock.timers.tick(10_000)
  assert.deepEqual(updates.getState(), { status: 'saving', version })
  updates.install(false)
  assert.deepEqual(updates.getState(), { status: 'ready', version, error: 'save' })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updates.restart()
  updates.install(true)
  context.mock.timers.tick(INSTALL_FEEDBACK_MS)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
  assert.equal(updater.downloadUpdate.mock.callCount(), 1)
})

test('installation failures preserve the downloaded version and allow retrying', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, updates } = fixture(context, async () => null, false)
  updater.emit('update-available', { version })
  updater.emit('update-downloaded')
  updates.restart()
  updater.quitAndInstall.mock.mockImplementationOnce(() => {
    throw new Error('Install failed')
  })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  context.mock.timers.tick(INSTALL_FEEDBACK_MS)
  assert.deepEqual(updates.getState(), { status: 'ready', version, error: 'install' })
  updates.restart()
  updates.install(true)
  assert.deepEqual(updates.getState(), { status: 'installing', version })
  context.mock.timers.tick(INSTALL_FEEDBACK_MS)
  assert.equal(updater.quitAndInstall.mock.callCount(), 2)
  assert.equal(updater.downloadUpdate.mock.callCount(), 1)
})

test('stalled confirmations and restarts recover, and updates install on quit only when enabled', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const { updater, updates } = fixture(context, async () => null, false, true)
  assert.equal(updater.autoInstallOnAppQuit, true)
  updater.emit('update-available', { version })
  updater.emit('update-downloaded')
  updates.restart()
  updates.confirming()
  context.mock.timers.tick(CONFIRM_TIMEOUT_MS - 1)
  assert.deepEqual(updates.getState(), { status: 'saving', version })
  context.mock.timers.tick(1)
  assert.deepEqual(updates.getState(), { status: 'ready', version, error: 'save' })
  updates.install(true)
  assert.equal(updater.quitAndInstall.mock.callCount(), 0)
  updates.restart()
  updates.install(true)
  context.mock.timers.tick(INSTALL_FEEDBACK_MS)
  assert.equal(updater.quitAndInstall.mock.callCount(), 1)
  context.mock.timers.tick(INSTALL_TIMEOUT_MS)
  assert.deepEqual(updates.getState(), { status: 'ready', version, error: 'install' })
  updates.restart()
  updates.install(true)
  context.mock.timers.tick(INSTALL_FEEDBACK_MS)
  assert.equal(updater.quitAndInstall.mock.callCount(), 2)
})
