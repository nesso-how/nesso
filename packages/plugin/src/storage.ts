import { z } from 'zod'
import { checkMessageSize } from './data.ts'
import { parseOrThrow, PluginError } from './errors.ts'
import type { DeepReadonly } from './types.ts'

export const pluginStorageLimits = {
  record: 256 * 1024,
  namespace: 8 * 1024 * 1024,
  total: 64 * 1024 * 1024,
  records: 10_000,
  namespaces: 128,
  depth: 24,
} as const

type JsonValue =
  | null
  | string
  | number
  | boolean
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue }

const isJsonValue = (value: unknown, depth = 0): value is JsonValue => {
  if (depth > pluginStorageLimits.depth) return false
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (Array.isArray(value))
    return (
      Reflect.ownKeys(value).length === value.length + 1 &&
      Array.from(value).every((item) => isJsonValue(item, depth + 1))
    )
  return (
    Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === Object.keys(value).length &&
    Object.values(value).every((item) => isJsonValue(item, depth + 1))
  )
}

const fields = {
  key: z.string().min(1).max(128),
  conceptId: z.string().max(2048).optional(),
}
export const pluginStorageKey = z.strictObject(fields)
export const pluginStorageRecord = z
  .strictObject({
    ...fields,
    value: z
      .custom<JsonValue>((value) => isJsonValue(value), 'Expected a bounded JSON value')
      .transform((value) => structuredClone(value)),
  })
  .superRefine((value, context) => {
    try {
      checkMessageSize(value, pluginStorageLimits.record, pluginStorageLimits.depth)
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error instanceof PluginError ? error.message : 'Invalid storage record',
      })
    }
  })
export const pluginStorageRevision = z.number().int().nonnegative()
export const pluginStorageSnapshot = z.strictObject({
  revision: pluginStorageRevision,
  records: z.array(pluginStorageRecord).max(pluginStorageLimits.records),
})

export type PluginStorageRecord = DeepReadonly<z.infer<typeof pluginStorageRecord>>
export type PluginStorageKey = DeepReadonly<z.infer<typeof pluginStorageKey>>
export type PluginStorage = {
  readonly list: () => Promise<readonly PluginStorageRecord[]>
  readonly set: (
    key: string,
    value: PluginStorageRecord['value'],
    conceptId?: string,
  ) => Promise<boolean>
  readonly delete: (key: string, conceptId?: string) => Promise<boolean>
}

export function parsePluginStorageSnapshot(
  value: unknown,
): DeepReadonly<z.infer<typeof pluginStorageSnapshot>> {
  checkMessageSize(value, pluginStorageLimits.namespace)
  return parseOrThrow(pluginStorageSnapshot, value)
}

export function parsePluginStorageRecord(value: unknown): PluginStorageRecord {
  checkMessageSize(value, pluginStorageLimits.record, pluginStorageLimits.depth)
  return parseOrThrow(pluginStorageRecord, value)
}

export function parsePluginStorageKey(value: unknown): PluginStorageKey {
  checkMessageSize(value, 4096)
  return parseOrThrow(pluginStorageKey, value)
}
