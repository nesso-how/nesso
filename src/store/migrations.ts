import { z } from 'zod'
import { iriSchema, newIri } from '@nesso-how/schema'
import { checkMessageSize, pluginStorageLimits } from '@nesso-how/plugin/runtime'
import { fail, parseSettings } from './settings.ts'

const documentV1 = z.strictObject({
  version: z.literal(1),
  graph: z.unknown(),
  workspace: z.unknown(),
})
const documentV2 = z.strictObject({
  version: z.literal(2),
  documentId: iriSchema,
  graph: z.unknown(),
  workspace: z.unknown(),
})
const versionSchema = z.object({ version: z.number().int().positive() })

const pluginStorageV1 = z.strictObject({
  version: z.literal(1),
  documentId: iriSchema,
  plugins: z.array(
    z.strictObject({
      pluginId: z.string(),
      revision: z.unknown(),
      records: z.array(
        z.strictObject({
          key: z.string(),
          conceptId: z.string().max(2048).optional(),
          value: z.unknown(),
        }),
      ),
    }),
  ),
})

export function migratePluginStorage(value: unknown): unknown {
  checkMessageSize(value, pluginStorageLimits.total)
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1: {
      const saved = parseSettings(pluginStorageV1, value)
      return {
        ...saved,
        version: 2,
        plugins: saved.plugins.map((entry) => ({
          ...entry,
          records: entry.records.map(({ conceptId, ...record }) =>
            conceptId === undefined
              ? record
              : { ...record, scope: { kind: 'concept', id: conceptId } },
          ),
        })),
      }
    }
    case 2:
      return value
    default:
      return fail('version', 'Unsupported plugin storage version')
  }
}

export function migrateDocument(value: unknown): z.infer<typeof documentV2> {
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1: {
      const saved = parseSettings(documentV1, value)
      return parseSettings(documentV2, { ...saved, version: 2, documentId: newIri() })
    }
    case 2:
      return parseSettings(documentV2, value)
    default:
      return fail('version', 'Unsupported storage version')
  }
}
