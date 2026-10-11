import { app, BrowserWindow, dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { persistenceSections, type PersistenceSection } from '../shared/persistence.ts'
import { createFileStorage } from './file-storage.ts'
import { ElectronError } from './errors.ts'
import type { TrustedRequest } from './ipc.ts'

export function connectDesktopPersistence(trusted: TrustedRequest) {
  const storage = createFileStorage(app.getPath('userData'))
  const handle = async (event: IpcMainInvokeEvent, section: unknown, write: boolean, value?: unknown) => {
    try {
      if (!trusted(event) || !persistenceSections.includes(section as PersistenceSection)) {
        throw new ElectronError([{ path: 'storage', message: 'Invalid storage request' }])
      }
      if (write) {
        await storage.write(section as PersistenceSection, value)
        return { value: null }
      }
      return { value: await storage.read(section as PersistenceSection) }
    } catch (error) {
      return { issues: error instanceof ElectronError ? error.issues : [{ path: '', message: error instanceof Error ? error.message : 'Storage failed' }] }
    }
  }
  ipcMain.handle('storage:read', (event, section: unknown) => handle(event, section, false))
  ipcMain.handle('storage:write', (event, section: unknown, value: unknown) => handle(event, section, true, value))
  let quitting = false
  app.on('before-quit', (event) => {
    if (!BrowserWindow.getAllWindows().length) return
    event.preventDefault()
    quitting = true
    for (const window of BrowserWindow.getAllWindows()) window.close()
  })
  return (window: BrowserWindow) => {
    let ready = false
    let closing = false
    let saved = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const belongs = (event: IpcMainEvent) => trusted(event) && event.sender === window.webContents
    const onReady = (event: IpcMainEvent) => { if (belongs(event)) ready = true }
    const failed = () => {
      closing = false
      quitting = false
      clearTimeout(timer)
      void dialog.showMessageBox(window, {
        type: 'error', title: 'Unable to save',
        message: 'Nesso could not save your changes. The window will stay open so you can retry or export your document.',
      })
    }
    const onSaved = (event: IpcMainEvent, success: unknown) => {
      if (!belongs(event) || !closing) return
      clearTimeout(timer)
      if (success !== true) return failed()
      saved = true
      window.close()
    }
    ipcMain.on('storage:ready', onReady)
    ipcMain.on('storage:closed', onSaved)
    window.on('close', (event) => {
      if (saved || !ready) return
      event.preventDefault()
      if (closing) return
      closing = true
      timer = setTimeout(failed, 10_000)
      window.webContents.send('storage:prepare')
    })
    window.on('closed', () => {
      clearTimeout(timer)
      ipcMain.removeListener('storage:ready', onReady)
      ipcMain.removeListener('storage:closed', onSaved)
      if (quitting && !BrowserWindow.getAllWindows().length) app.quit()
    })
  }
}
