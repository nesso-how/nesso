import { z } from 'zod'
import type { Backup } from '../../shared/backup.ts'
import { persistenceSections } from '../../shared/persistence.ts'
import { loadPersistence } from './persistence.ts'
import { fail } from './settings.ts'
import { collectPluginStorageOrphans } from './plugin-storage.ts'

const backupSchema = z.strictObject({
  format: z.literal('nesso-backup'),
  version: z.literal(1),
  createdAt: z.iso.datetime({ precision: 3 }),
  appVersion: z.string().refine((value) => !!value.trim()),
  records: z.record(z.enum(persistenceSections), z.unknown()),
})

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
      read: async (section) => records[section],
      write: async () => fail('backup', 'backupInvalid'),
    })
    if (loaded.blocked.length || !loaded.graph || !loaded.documentId || !loaded.pluginStorage)
      return fail('backup', 'backupInvalid')
    const ids = new Set(loaded.graph.concepts.map(({ id }) => id))
    backup.records['plugin-storage'] = {
      version: 1,
      documentId: loaded.documentId,
      plugins: collectPluginStorageOrphans(loaded.pluginStorage, ids),
    }
    return backup
  } catch {
    return fail('backup', 'backupInvalid')
  }
}
