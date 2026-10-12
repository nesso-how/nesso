import { BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import type { DataLocation } from './data-location.ts'
import { ElectronError } from './errors.ts'
import type { TrustedRequest } from './ipc.ts'
import { prepareDataTransfer } from './data-transfer.ts'

export function connectDataLocation(trusted: TrustedRequest, location: DataLocation, busy: () => boolean) {
  let locked = false
  let candidate: string | undefined
  const publish = () => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('data-location:state', location.state())
  }
  const handle = (operation: (event: IpcMainInvokeEvent, input: unknown) => unknown) => async (event: IpcMainInvokeEvent, input: unknown) => {
    if (!trusted(event)) return { issues: [{ path: 'dataLocation', message: 'storageDestination' }] }
    try { return { value: await operation(event, input) } } catch (error) {
      return { issues: error instanceof ElectronError ? error.issues : [{ path: 'dataLocation', message: 'storageMoveFailure' }] }
    }
  }
  ipcMain.handle('data-location:state', handle(() => location.state()))
  ipcMain.handle('data-location:choose', handle(async (event) => {
    if (location.state().moving) throw new ElectronError([{ path: 'dataLocation', message: 'storageBusy' }])
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new ElectronError([{ path: 'dataLocation', message: 'storageDestination' }])
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'], defaultPath: location.state().directory })
    if (result.canceled || !result.filePaths[0]) return null
    candidate = await location.validate(result.filePaths[0])
    return candidate
  }))
  ipcMain.handle('data-location:validate', handle(async (_event, input) => {
    if (typeof input !== 'string' || input !== location.state().defaultDirectory) throw new ElectronError([{ path: 'dataLocation', message: 'storageDestination' }])
    candidate = await location.validate(input)
    return candidate
  }))
  ipcMain.handle('data-location:open', handle(async () => {
    const error = await shell.openPath(location.directory())
    if (error) throw new ElectronError([{ path: 'dataLocation', message: 'storageOpenFailure' }])
    return null
  }))
  const transaction = async (operation: () => Promise<unknown>) => {
    if (location.state().moving || busy()) throw new ElectronError([{ path: 'dataLocation', message: 'storageBusy' }])
    location.setMoving(true)
    publish()
    try {
      await prepareDataTransfer(BrowserWindow.getAllWindows().map((window) => window.webContents), ipcMain, trusted)
      locked = true
      await operation()
    } finally {
      locked = false
      location.setMoving(false)
      publish()
    }
    return location.state()
  }
  ipcMain.handle('data-location:move', handle((_event, input) => {
    if (typeof input !== 'string' || input !== candidate) throw new ElectronError([{ path: 'dataLocation', message: 'storageDestination' }])
    return transaction(() => location.move(input))
  }))
  ipcMain.handle('data-location:cleanup', handle(() => transaction(async () => {
    try { await location.cleanup() } catch { throw new ElectronError([{ path: 'dataLocation', message: 'storageCleanup' }]) }
  })))
  return { locked: () => locked }
}
