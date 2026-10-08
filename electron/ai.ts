import { app, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createAiConnections } from './ai-connections.ts'
import type { AiResult } from '@nesso/ai'
import { ElectronError } from './errors.ts'

export function connectAi(dev: boolean) {
  const file = path.join(app.getPath('userData'), 'ai-connections.enc')
  const available = () => {
    if (!safeStorage.isEncryptionAvailable() || process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
      throw new ElectronError([{ path: 'storage', message: 'Secure credential storage is unavailable' }])
    }
  }
  const connections = createAiConnections({
    read: () => {
      available()
      let encrypted: Buffer
      try { encrypted = readFileSync(file) } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
      return safeStorage.decryptString(encrypted)
    },
    write: (value) => {
      available()
      writeFileSync(`${file}.tmp`, safeStorage.encryptString(value), { mode: 0o600 })
      renameSync(`${file}.tmp`, file)
    },
  })
  const trustedUrl = dev ? 'http://127.0.0.1:5173/' : 'nesso://app/'
  for (const method of ['list', 'save', 'remove', 'activate', 'verify', 'models'] as const) {
    ipcMain.handle(`ai:${method}`, async (event, input: unknown): Promise<AiResult<unknown>> => {
      if (!BrowserWindow.getAllWindows().some((window) => window.webContents === event.sender)
        || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== trustedUrl) {
        return { issues: [{ path: 'desktop', message: 'Untrusted request' }] }
      }
      try { return { value: await connections[method](input) } } catch (error) {
        return { issues: error instanceof ElectronError ? error.issues : [{ path: 'desktop', message: 'AI connection operation failed' }] }
      }
    })
  }
}
