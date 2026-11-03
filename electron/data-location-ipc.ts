import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { NessoError } from '@nesso-how/errors'
import type { DataLocation } from './data-location.ts'
import { ElectronError } from './errors.ts'
import type { TrustedRequest } from './ipc.ts'
import { onDocumentNavigation } from './navigation.ts'
import { prepareDataTransfer } from './data-transfer.ts'
import { createBackups } from './backups.ts'
import { createRecordReplacement } from './record-replacement.ts'
import { containsPath } from './file-system.ts'

export function connectDataLocation(
  trusted: TrustedRequest,
  location: DataLocation,
  busy: () => boolean,
) {
  let locked = false
  let candidate: string | undefined
  let generation = 0
  let activity: 'backup' | 'restore' | undefined
  let choosing = false
  let recoveryRequired = false
  const backups = createBackups(() => location.directory(), app.getVersion())
  const replacement = createRecordReplacement(() => location.directory())
  const state = () => ({
    ...location.state(),
    activity,
    recoveryRequired,
  })
  const publish = () => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('data-location:state', state())
  }
  const handle =
    (
      operation: (event: IpcMainInvokeEvent, input: unknown) => unknown,
      failure = 'storageMoveFailure',
    ) =>
    async (event: IpcMainInvokeEvent, input: unknown) => {
      if (!trusted(event))
        return { issues: [{ path: 'dataLocation', message: 'storageDestination' }] }
      try {
        return { value: await operation(event, input) }
      } catch (error) {
        return {
          issues:
            error instanceof NessoError
              ? error.issues
              : [
                  {
                    path: failure === 'backupFailed' ? 'backup' : 'dataLocation',
                    message: failure,
                  },
                ],
        }
      }
    }
  ipcMain.handle('data-location:state', handle(state))
  ipcMain.handle(
    'data-location:choose',
    handle(async (event) => {
      if (location.state().moving)
        throw new ElectronError([{ path: 'dataLocation', message: 'storageBusy' }])
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window)
        throw new ElectronError([{ path: 'dataLocation', message: 'storageDestination' }])
      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: location.state().directory,
      })
      if (result.canceled || !result.filePaths[0]) return null
      candidate = await location.validate(result.filePaths[0])
      return candidate
    }),
  )
  ipcMain.handle(
    'data-location:validate',
    handle(async (_event, input) => {
      if (typeof input !== 'string' || input !== location.state().defaultDirectory)
        throw new ElectronError([{ path: 'dataLocation', message: 'storageDestination' }])
      candidate = await location.validate(input)
      return candidate
    }),
  )
  ipcMain.handle(
    'data-location:open',
    handle(async () => {
      const error = await shell.openPath(location.directory())
      if (error) throw new ElectronError([{ path: 'dataLocation', message: 'storageOpenFailure' }])
      return null
    }),
  )
  const transaction = async (operation: () => Promise<unknown>, kind?: 'backup' | 'restore') => {
    if (locked || location.state().moving || busy())
      throw new ElectronError([{ path: 'dataLocation', message: 'storageBusy' }])
    activity = kind
    location.setMoving(true)
    publish()
    try {
      await prepareDataTransfer(
        BrowserWindow.getAllWindows().map((window) => window.webContents),
        ipcMain,
        trusted,
      )
      locked = true
      await operation()
    } finally {
      if (!recoveryRequired) locked = false
      activity = undefined
      location.setMoving(false)
      publish()
    }
    return location.state()
  }
  ipcMain.handle(
    'data-location:move',
    handle((_event, input) => {
      if (typeof input !== 'string' || input !== candidate)
        throw new ElectronError([{ path: 'dataLocation', message: 'storageDestination' }])
      return transaction(() => location.move(input))
    }),
  )
  ipcMain.handle(
    'data-location:cleanup',
    handle(() =>
      transaction(async () => {
        try {
          await location.cleanup()
        } catch {
          throw new ElectronError([{ path: 'dataLocation', message: 'storageCleanup' }])
        }
      }),
    ),
  )
  const pick = async (event: IpcMainInvokeEvent, save: boolean) => {
    if (locked || choosing || location.state().moving || busy())
      throw new ElectronError([{ path: 'backup', message: 'storageBusy' }])
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new ElectronError([{ path: 'backup', message: 'backupFailed' }])
    choosing = true
    try {
      if (save) {
        const result = await dialog.showSaveDialog(window, {
          defaultPath: `nesso-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
          filters: [{ name: 'Nesso backup', extensions: ['json'] }],
        })
        return result.canceled ? undefined : result.filePath
      }
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [{ name: 'Nesso backup', extensions: ['json'] }],
      })
      return result.canceled ? undefined : result.filePaths[0]
    } finally {
      choosing = false
    }
  }
  ipcMain.handle(
    'backup:create',
    handle(async (event) => {
      const file = await pick(event, true)
      if (!file || event.sender.isDestroyed() || !trusted(event)) return false
      await transaction(async () => {
        const parent = await realpath(path.dirname(file))
        for (const directory of [location.directory(), await realpath(app.getPath('userData'))]) {
          if (containsPath(directory, parent))
            throw new ElectronError([{ path: 'backup', message: 'backupDestination' }])
        }
        await backups.save(file)
      }, 'backup')
      return true
    }, 'backupFailed'),
  )
  ipcMain.handle(
    'backup:choose',
    handle(async (event) => {
      backups.cancel(event.sender.id)
      const file = await pick(event, false)
      if (!file || event.sender.isDestroyed() || !trusted(event)) return null
      const candidate = await backups.choose(event.sender.id, file)
      if (event.sender.isDestroyed() || !trusted(event)) {
        backups.cancel(event.sender.id)
        return null
      }
      return candidate
    }, 'backupFailed'),
  )
  ipcMain.on('backup:cancel', (event) => {
    if (trusted(event)) backups.cancel(event.sender.id)
  })
  app.on('web-contents-created', (_event, contents) => {
    onDocumentNavigation(contents, () => backups.cancel(contents.id))
    contents.once('destroyed', () => backups.cancel(contents.id))
  })
  ipcMain.handle(
    'backup:restore',
    handle(async (event, id) => {
      const backup = backups.take(event.sender.id, id)
      await transaction(async () => {
        try {
          await replacement.replace(backup.records)
        } catch (error) {
          recoveryRequired =
            error instanceof NessoError &&
            error.issues.some(({ message }) => message === 'backupRecoveryRequired')
          throw error
        }
        generation++
        locked = false
        for (const window of BrowserWindow.getAllWindows()) window.webContents.reload()
      }, 'restore')
      return null
    }, 'backupFailed'),
  )
  return { locked: () => locked, generation: () => generation }
}
