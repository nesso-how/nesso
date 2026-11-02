import { z } from 'zod'
import { iriSchema, newIri } from '@nesso-how/schema'
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
