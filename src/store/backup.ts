import { z } from 'zod'
import { fileTextLimit } from '@nesso-how/plugin/runtime'
import metadata from '../../package.json' with { type: 'json' }
import { backupSchema, type Backup } from '../../shared/backup.ts'
import { persistenceSections, type PersistenceStorage } from '../../shared/persistence.ts'
import { loadPersistence } from './persistence.ts'
import { fail } from './settings.ts'

export async function parseBackup(value: unknown): Promise<Backup> {
  const header = z
    .object({ format: z.literal('nesso-backup'), version: z.number() })
    .safeParse(value)
  if (header.success && header.data.version > 1) fail('backup', 'backupUnsupported')
  try {
    const backup = structuredClone(backupSchema.parse(value))
    const { records } = backup
    if (persistenceSections.some((section) => records[section] === undefined))
      fail('backup', 'backupInvalid')
    const loaded = await loadPersistence({
      read: async (section) => records[section] ?? undefined,
    })
    if (loaded.blocked.length || loaded.graph === undefined || !loaded.documentId)
      return fail('backup', 'backupInvalid')
    Object.assign(backup.records, loaded.upgrades)
    return backup
  } catch {
    return fail('backup', 'backupInvalid')
  }
}

export async function createBackup(
  storage: Pick<PersistenceStorage, 'read'>,
  appVersion = metadata.version,
): Promise<string> {
  const records = Object.fromEntries(
    await Promise.all(
      persistenceSections.map(async (section) => [section, (await storage.read(section)) ?? null]),
    ),
  )
  const backup = backupSchema.parse({
    format: 'nesso-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion,
    records,
  })
  await parseBackup(backup)
  const text = JSON.stringify(backup)
  if (new TextEncoder().encode(text).byteLength > fileTextLimit) fail('backup', 'backupTooLarge')
  return text
}
