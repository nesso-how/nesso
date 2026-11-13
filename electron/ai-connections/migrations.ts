import { z } from 'zod'
import { ElectronError } from '../errors.ts'
import { storedRecord } from './schema.ts'

const unversionedRecord = z.strictObject({ ...storedRecord.shape, version: z.never().optional() })
const versionSchema = z.object({ version: z.number().int().positive().optional() })

export function migrateAiConnections(value: unknown) {
  const header = versionSchema.parse(value)
  if (!Object.hasOwn(header, 'version')) {
    const saved = unversionedRecord.parse(value)
    return { record: storedRecord.parse({ ...saved, version: 1 }), upgraded: true }
  }
  if (header.version !== 1)
    throw new ElectronError([
      { path: 'storage.version', message: 'Unsupported AI connections version' },
    ])
  return { record: storedRecord.parse(value), upgraded: false }
}
