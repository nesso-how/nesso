import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { registerHooks } from 'node:module'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createDataLocation } from './data-location.ts'
import { createFileStorage } from './file-storage.ts'
import { createNessoStore } from '../src/store/create.ts'
import { connectPersistence, loadPersistence } from '../src/store/persistence.ts'
import type { BackupCandidate } from '../shared/backup.ts'

test('native backup IPC coordinates windows, honors cancellation, validates before confirmation and fences stale saves after restore', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'nesso-backup-ipc-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const directory = path.join(root, 'data')
  await mkdir(directory)
  const location = await createDataLocation(directory)
  const storage = createFileStorage(directory)
  const host = createNessoStore(null)
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  await persistence.flush()
  await persistence.dispose()
  type Event = { sender: (typeof windows)[number]['webContents']; trusted: boolean }
  const handlers = new Map<string, (event: Event, ...input: unknown[]) => Promise<unknown>>()
  const bus = Object.assign(new EventEmitter(), {
    handle: (name: string, handler: (event: Event, ...input: unknown[]) => Promise<unknown>) =>
      handlers.set(name, handler),
  })
  let nextFile: string | undefined
  let saved = true
  let reloads = 0
  const windows = [1, 2].map((id) => ({
    webContents: Object.assign(new EventEmitter(), {
      id,
      isDestroyed: () => false,
      reload: () => {
        reloads++
      },
      send: (channel: string, value: unknown) => {
        if (channel === 'data-location:prepare')
          queueMicrotask(() =>
            bus.emit('data-location:prepared', { sender: { id }, trusted: true }, value, saved),
          )
      },
    }),
  }))
  const app = Object.assign(new EventEmitter(), {
    getPath: () => directory,
    getVersion: () => '1.0.0-alpha.33',
  })
  Reflect.set(globalThis, '__nessoBackupElectron', {
    app,
    ipcMain: bus,
    BrowserWindow: {
      getAllWindows: () => windows,
      fromWebContents: (sender: Event['sender']) =>
        windows.find((window) => window.webContents === sender),
    },
    dialog: {
      showOpenDialog: async () => ({ canceled: !nextFile, filePaths: nextFile ? [nextFile] : [] }),
      showSaveDialog: async () => ({ canceled: !nextFile, filePath: nextFile }),
    },
    shell: { openPath: async () => '' },
  })
  const hooks = registerHooks({
    resolve: (specifier, context, next) =>
      specifier === 'electron'
        ? {
            url: 'data:text/javascript,export const {app,ipcMain,BrowserWindow,dialog,shell} = globalThis.__nessoBackupElectron',
            shortCircuit: true,
          }
        : next(specifier, context),
  })
  context.after(() => {
    hooks.deregister()
    Reflect.deleteProperty(globalThis, '__nessoBackupElectron')
  })
  const { connectDataLocation } = await import('./data-location-ipc.ts')
  const { connectDesktopPersistence } = await import('./persistence.ts')
  const trusted = (event: unknown) => (event as Event).trusted
  const transfer = connectDataLocation(trusted, location, () => false)
  connectDesktopPersistence(trusted, location, transfer.locked, transfer.generation)
  const event: Event = { sender: windows[0].webContents, trusted: true }
  const call = (channel: string, ...input: unknown[]) =>
    handlers.get(channel)!(event, ...input) as Promise<{
      value: unknown
      issues?: { message: string }[]
    }>
  const untrusted = (await handlers.get('backup:create')!({ ...event, trusted: false })) as {
    issues?: unknown
  }
  assert.ok(untrusted.issues)
  const untrustedBackup = (await handlers.get('storage:backup')!(
    { ...event, trusted: false },
    0,
  )) as { issues?: unknown }
  assert.ok(untrustedBackup.issues)
  assert.equal((await call('storage:backup', 0)).value, null)
  assert.equal((await call('backup:create')).value, false)
  nextFile = path.join(directory, 'document.json')
  assert.equal((await call('backup:create')).issues?.[0].message, 'backupDestination')
  nextFile = path.join(root, 'backup.json')
  assert.equal((await call('backup:create')).value, true)
  const backup = JSON.parse(await readFile(nextFile, 'utf8'))
  const choose = async () => (await call('backup:choose')).value as BackupCandidate
  const cancelled = await choose()
  bus.emit('backup:cancel', event)
  assert.equal((await call('backup:restore', cancelled.id)).issues?.[0].message, 'backupInvalid')
  assert.equal(reloads, 0)
  const unsaved = await choose()
  saved = false
  assert.equal((await call('backup:restore', unsaved.id)).issues?.[0].message, 'storageSaveFailure')
  assert.equal(reloads, 0)
  assert.equal(transfer.generation(), 0)
  assert.equal(location.state().moving, false)
  saved = true
  const candidate = await choose()
  await storage.write('conversation', {
    version: 1,
    messages: [{ id: 'new', role: 'user', content: 'not in backup' }],
  })
  assert.equal((await call('backup:restore', candidate.id)).value, null)
  assert.equal(reloads, 2)
  assert.equal(transfer.generation(), 1)
  assert.equal(transfer.locked(), false)
  assert.ok((await call('storage:write', 'conversation', { stale: true }, 0)).issues)
  assert.ok((await call('storage:backup', 0)).issues)
  for (const section of Object.keys(backup.records))
    assert.deepEqual(
      (await call('storage:read', section, 1)).value,
      backup.records[section] ?? undefined,
    )
  const interrupted = await choose()
  await writeFile(path.join(directory, '.nesso-restore.json'), 'unreadable journal')
  assert.equal(
    (await call('backup:restore', interrupted.id)).issues?.[0].message,
    'backupRecoveryRequired',
  )
  assert.equal(transfer.locked(), true)
  assert.equal(transfer.generation(), 1)
  assert.equal(location.state().moving, false)
  assert.equal(
    ((await call('data-location:state')).value as { recoveryRequired: boolean }).recoveryRequired,
    true,
  )
  assert.ok((await call('storage:write', 'conversation', { stale: true }, 1)).issues)
  assert.ok((await call('storage:backup', 1)).issues)
})
