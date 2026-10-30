import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron'
import { persistenceSections, type PersistenceSection } from '../shared/persistence.ts'
import { createFileStorage } from './file-storage.ts'
import { ElectronError } from './errors.ts'
import type { TrustedRequest } from './ipc.ts'
import type { DataLocation } from './data-location.ts'

export function connectDesktopPersistence(
  trusted: TrustedRequest,
  location: DataLocation,
  locked: () => boolean,
) {
  const storage = createFileStorage(() => {
    if (locked()) throw new ElectronError([{ path: 'dataLocation', message: 'storageBusy' }])
    return location.directory()
  })
  const handle = async (
    event: IpcMainInvokeEvent,
    section: unknown,
    write: boolean,
    value?: unknown,
  ) => {
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
      return {
        issues:
          error instanceof ElectronError
            ? error.issues
            : [{ path: '', message: error instanceof Error ? error.message : 'Storage failed' }],
      }
    }
  }
  ipcMain.handle('storage:read', (event, section: unknown) => handle(event, section, false))
  ipcMain.handle('storage:write', (event, section: unknown, value: unknown) =>
    handle(event, section, true, value),
  )
  let quitting = false
  app.on('before-quit', (event) => {
    if (location.state().moving) {
      event.preventDefault()
      return
    }
    if (!BrowserWindow.getAllWindows().length) return
    event.preventDefault()
    quitting = true
    for (const window of BrowserWindow.getAllWindows()) window.close()
  })
  return (window: BrowserWindow) => {
    let ready = false
    let closing = false
    let confirming = false
    let saved = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const belongs = (event: IpcMainEvent) => trusted(event) && event.sender === window.webContents
    const onReady = (event: IpcMainEvent) => {
      if (belongs(event)) ready = true
    }
    const failed = () => {
      if (!closing || confirming || window.isDestroyed()) return
      confirming = true
      clearTimeout(timer)
      const italian = app.getLocale().startsWith('it')
      void dialog
        .showMessageBox(window, {
          type: 'warning',
          title: italian ? 'Modifiche non salvate' : 'Unsaved changes',
          message: italian
            ? 'Non tutte le modifiche sono state salvate. Vuoi chiudere comunque?'
            : 'Not all changes have been saved. Close anyway?',
          detail: italian
            ? 'Chiudendo perderai le modifiche non salvate. Mantieni aperto Nesso per riprovare. I file esistenti non verranno sostituiti.'
            : 'Closing will discard unsaved changes. Keep Nesso open to retry. Existing files will not be replaced.',
          buttons: italian
            ? ['Mantieni aperto', 'Chiudi senza salvare']
            : ['Keep open', 'Close without saving'],
          defaultId: 0,
          cancelId: 0,
          noLink: true,
        })
        .then(({ response }) => {
          if (window.isDestroyed()) return
          if (response === 1) {
            saved = true
            window.close()
          } else {
            closing = false
            quitting = false
          }
        })
        .catch((error) => {
          closing = false
          quitting = false
          console.error(
            new ElectronError([
              {
                path: 'storage',
                message: error instanceof Error ? error.message : 'Close confirmation failed',
              },
            ]),
          )
        })
        .finally(() => {
          confirming = false
        })
    }
    const onSaved = (event: IpcMainEvent, success: unknown) => {
      if (!belongs(event) || !closing || confirming) return
      clearTimeout(timer)
      if (success !== true) {
        closing = false
        quitting = false
        return
      }
      saved = true
      window.close()
    }
    ipcMain.on('storage:ready', onReady)
    const onConfirming = (event: IpcMainEvent) => {
      if (belongs(event) && closing) clearTimeout(timer)
    }
    ipcMain.on('storage:confirming', onConfirming)
    ipcMain.on('storage:closed', onSaved)
    window.webContents.on('render-process-gone', failed)
    window.on('unresponsive', failed)
    window.on('close', (event) => {
      if (location.state().moving) {
        event.preventDefault()
        return
      }
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
      ipcMain.removeListener('storage:confirming', onConfirming)
      ipcMain.removeListener('storage:closed', onSaved)
      if (quitting && !BrowserWindow.getAllWindows().length) app.quit()
    })
  }
}
