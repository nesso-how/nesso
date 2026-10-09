import type { safeStorage } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { ElectronError } from './errors.ts'

export function createAiStorage(file: string, encryption: Pick<typeof safeStorage, 'isEncryptionAvailable' | 'getSelectedStorageBackend' | 'encryptString' | 'decryptString'>, platform = process.platform) {
  const available = () => {
    if (!encryption.isEncryptionAvailable() || platform === 'linux' && encryption.getSelectedStorageBackend() === 'basic_text') {
      throw new ElectronError([{ path: 'storage', message: 'Secure credential storage is unavailable' }])
    }
  }
  return {
    read: () => {
      let encrypted: Buffer
      try { encrypted = readFileSync(file) } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
      available()
      return encryption.decryptString(encrypted)
    },
    write: (value: string) => {
      available()
      writeFileSync(`${file}.tmp`, encryption.encryptString(value), { mode: 0o600 })
      renameSync(`${file}.tmp`, file)
    },
  }
}
