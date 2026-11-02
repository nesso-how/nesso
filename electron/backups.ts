import { randomUUID } from 'node:crypto'
import { NessoError } from '@nesso-how/errors'
import type { Backup, BackupCandidate } from '../shared/backup.ts'
import { createBackup, parseBackup } from '../src/store/backup.ts'
import { createFileStorage } from './file-storage.ts'
import { readChosenFile, saveChosenFile } from './file-access.ts'

export function createBackups(directory: () => string, appVersion: string) {
  const candidates = new Map<number, { id: string; backup: Backup }>()
  return {
    cancel: (owner: number) => {
      candidates.delete(owner)
    },
    choose: async (owner: number, file: string): Promise<BackupCandidate> => {
      candidates.delete(owner)
      const { text } = await readChosenFile(file, 'application/json', () => true)
      let value: unknown
      try {
        value = JSON.parse(text)
      } catch {
        throw new NessoError([{ path: 'backup', message: 'backupInvalid' }])
      }
      const backup = await parseBackup(value)
      const id = randomUUID()
      candidates.set(owner, { backup, id })
      return { id, createdAt: backup.createdAt }
    },
    take: (owner: number, id: unknown): Backup => {
      const candidate = candidates.get(owner)
      candidates.delete(owner)
      if (!candidate || candidate.id !== id)
        throw new NessoError([{ path: 'backup', message: 'backupInvalid' }])
      return candidate.backup
    },
    save: async (file: string) => {
      const text = await createBackup(createFileStorage(directory), appVersion)
      await saveChosenFile(
        file,
        { name: 'nesso-backup.json', mediaType: 'application/json', text },
        () => true,
      )
    },
  }
}
