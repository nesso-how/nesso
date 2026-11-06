import { z } from 'zod'
import { iriSchema, newIri } from '@nesso-how/schema'
import { checkMessageSize, pluginStorageLimits } from '@nesso-how/plugin/runtime'
import { defaultCanvasTabOrder, fail, parseSettings, preferencesSchema } from './settings.ts'

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
const preferencesV1 = z.strictObject({
  version: z.literal(1),
  preferences: preferencesSchema.omit({ disabledBundledActionPlugins: true, canvasTabOrder: true }),
})
const preferencesV2 = z.strictObject({
  version: z.literal(2),
  preferences: preferencesSchema.omit({ canvasTabOrder: true }),
})
const preferencesV3 = z.strictObject({ version: z.literal(3), preferences: preferencesSchema })

export function migratePreferences(value: unknown): z.infer<typeof preferencesV3> {
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1:
      return migratePreferences({ ...parseSettings(preferencesV1, value), version: 2 })
    case 2: {
      const saved = parseSettings(preferencesV2, value)
      return {
        version: 3,
        preferences: { ...saved.preferences, canvasTabOrder: [...defaultCanvasTabOrder] },
      }
    }
    case 3:
      return parseSettings(preferencesV3, value)
    default:
      return fail('version', 'Unsupported preferences version')
  }
}

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

const pluginStorageV2 = z.strictObject({
  version: z.literal(2),
  documentId: iriSchema,
  plugins: z.array(
    z.strictObject({ pluginId: z.string(), revision: z.unknown(), records: z.unknown() }),
  ),
})

export function migratePluginStorage(value: unknown): unknown {
  checkMessageSize(value, pluginStorageLimits.total)
  const { version } = parseSettings(versionSchema, value)
  switch (version) {
    case 1: {
      const saved = parseSettings(pluginStorageV1, value)
      return migratePluginStorage({
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
      })
    }
    case 2: {
      const saved = parseSettings(pluginStorageV2, value)
      return {
        ...saved,
        version: 3,
        plugins: saved.plugins.map(({ pluginId, ...entry }) => ({
          pluginId,
          local: false,
          ...entry,
        })),
      }
    }
    case 3:
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
