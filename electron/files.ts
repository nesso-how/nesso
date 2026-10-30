import { BrowserWindow, dialog, ipcMain } from 'electron'
import { parseFileOptions } from '../packages/plugin/src/files.ts'
import type { TrustedRequest } from './ipc.ts'
import { ElectronError } from './errors.ts'
import { readChosenFile, saveChosenFile } from './file-access.ts'

function fail(message: string): never {
  throw new ElectronError([{ path: 'files', message }])
}

export function connectFiles(trusted: TrustedRequest) {
  const active = new Map<number, { id: string; cancelled: boolean }>()
  ipcMain.on('files:cancel', (event, id: unknown) => {
    if (!trusted(event)) return
    const request = active.get(event.sender.id)
    if (request && request.id === id) request.cancelled = true
  })
  for (const kind of ['open', 'save'] as const)
    ipcMain.handle(`files:${kind}`, async (event, id: unknown, input: unknown) => {
      if (
        !trusted(event) ||
        typeof id !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(id) ||
        active.has(event.sender.id)
      )
        fail('File interaction unavailable')
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) fail('File interaction unavailable')
      const request = { id, cancelled: false }
      active.set(event.sender.id, request)
      const current = () => !request.cancelled && !event.sender.isDestroyed() && trusted(event)
      try {
        if (kind === 'open') {
          const options = parseFileOptions('open', input)
          const result = await dialog.showOpenDialog(window, {
            properties: ['openFile'],
            filters: [{ name: 'Text files', extensions: options.extensions }],
          })
          if (!current() || result.canceled || !result.filePaths[0]) return null
          return await readChosenFile(
            result.filePaths[0],
            options.mimeTypes[0] ?? 'application/octet-stream',
            current,
          )
        }
        const options = parseFileOptions('save', input)
        const result = await dialog.showSaveDialog(window, { defaultPath: options.name })
        if (!current() || result.canceled || !result.filePath) return { saved: false }
        return await saveChosenFile(result.filePath, options, current)
      } catch {
        fail('File interaction failed')
      } finally {
        active.delete(event.sender.id)
      }
    })
}
