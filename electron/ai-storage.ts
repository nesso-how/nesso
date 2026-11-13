import type { safeStorage } from 'electron'
import { createHash } from 'node:crypto'
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ElectronError } from './errors.ts'

export function createAiStorage(
  file: string,
  encryption: Pick<
    typeof safeStorage,
    'isEncryptionAvailable' | 'getSelectedStorageBackend' | 'encryptString' | 'decryptString'
  >,
  platform = process.platform,
) {
  const available = () => {
    if (
      !encryption.isEncryptionAvailable() ||
      (platform === 'linux' && encryption.getSelectedStorageBackend() === 'basic_text')
    ) {
      throw new ElectronError([
        { path: 'storage', message: 'Secure credential storage is unavailable' },
      ])
    }
  }
  const syncDirectory = () => {
    if (platform === 'win32') return
    const handle = openSync(path.dirname(file), 'r')
    try {
      fsyncSync(handle)
    } catch (error) {
      if (
        !['EINVAL', 'ENOTSUP', 'EOPNOTSUPP'].includes((error as NodeJS.ErrnoException).code ?? '')
      )
        throw error
    } finally {
      closeSync(handle)
    }
  }
  const replace = (target: string, data: Buffer) => {
    writeFileSync(`${target}.tmp`, data, { mode: 0o600, flush: true })
    renameSync(`${target}.tmp`, target)
    syncDirectory()
  }
  const write = (value: string) => {
    available()
    replace(file, encryption.encryptString(value))
  }
  return {
    read: () => {
      let encrypted: Buffer
      try {
        encrypted = readFileSync(file)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw error
      }
      available()
      return encryption.decryptString(encrypted)
    },
    write,
    upgrade: (value: string) => {
      available()
      const original = readFileSync(file)
      replace(`${file}.backup-${createHash('sha256').update(original).digest('hex')}`, original)
      write(value)
    },
  }
}
