import { randomUUID } from 'node:crypto'
import { NessoError } from '@nesso-how/errors'
import type { Backup, BackupCandidate } from '../shared/backup.ts'
import { persistenceSections } from '../shared/persistence.ts'
import { parseBackup } from '../src/store/backup.ts'
import { createFileStorage } from './file-storage.ts'
import { readChosenFile, saveChosenFile } from './file-access.ts'
import { fileTextLimit } from '../packages/plugin/src/files.ts'

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
      const storage = createFileStorage(directory)
      const records = Object.fromEntries(
        await Promise.all(
          persistenceSections.map(async (section) => [section, await storage.read(section)]),
        ),
      ) as Backup['records']
      if (records['plugin-storage'] === undefined) {
        const document = records.document as { documentId?: unknown } | undefined
        records['plugin-storage'] = { version: 1, documentId: document?.documentId, plugins: [] }
      }
      const backup = await parseBackup({
        format: 'nesso-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        appVersion,
        records,
      })
      const text = JSON.stringify(backup)
      if (Buffer.byteLength(text, 'utf8') > fileTextLimit)
        throw new NessoError([{ path: 'backup', message: 'backupTooLarge' }])
      await saveChosenFile(
        file,
        { name: 'nesso-backup.json', mediaType: 'application/json', text },
        () => true,
      )
    },
  }
}
