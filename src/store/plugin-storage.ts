import validateName from 'validate-npm-package-name'
import { z } from 'zod'
import { iriSchema, isAbsoluteIri } from '@nesso-how/schema'
import type { PluginStorageKey, PluginStorageRecord } from '@nesso-how/plugin'
import {
  checkMessageSize,
  parsePluginStorageKey,
  parsePluginStorageRecord,
  parsePluginStorageSnapshot,
  pluginStorageLimits,
  PluginError,
} from '@nesso-how/plugin/runtime'
import { fail, parseSettings } from './settings.ts'

export type PluginStorageNamespace = ReturnType<typeof parsePluginStorageSnapshot> & {
  readonly pluginId: string
  readonly local: boolean
}
export type PluginStorageWrite =
  | {
      readonly kind: 'plugin-storage.set'
      readonly pluginId: string
      readonly local: boolean
      readonly documentId: string
      readonly revision: number
      readonly record: PluginStorageRecord
    }
  | {
      readonly kind: 'plugin-storage.delete'
      readonly pluginId: string
      readonly local: boolean
      readonly documentId: string
      readonly revision: number
      readonly key: PluginStorageKey
    }

const recordId = (record: PluginStorageKey) =>
  JSON.stringify([record.scope?.kind ?? null, record.scope?.id ?? null, record.key])

const pluginIdSchema = z
  .string()
  .max(214)
  .refine((id) => validateName(id).validForNewPackages, 'Expected a valid npm package name')
const checkPluginId = (value: unknown): string => parseSettings(pluginIdSchema, value, 'pluginId')

export const findPluginStorage = (
  plugins: readonly PluginStorageNamespace[],
  pluginId: string,
  local: boolean,
) => plugins.find((entry) => entry.pluginId === pluginId && entry.local === local)

const storageSchema = z.strictObject({
  version: z.literal(3),
  documentId: iriSchema,
  plugins: z
    .array(
      z.strictObject({
        pluginId: pluginIdSchema,
        local: z.boolean(),
        revision: z.unknown(),
        records: z.unknown(),
      }),
    )
    .max(pluginStorageLimits.namespaces),
})

export function parsePluginStorage(value: unknown): {
  readonly documentId: string
  readonly plugins: readonly PluginStorageNamespace[]
} {
  checkMessageSize(value, pluginStorageLimits.total)
  const saved = parseSettings(storageSchema, value)
  const identities = new Set<string>()
  const plugins = saved.plugins.map((entry) => {
    const { pluginId, local } = entry
    const identity = JSON.stringify([pluginId, local])
    if (identities.has(identity)) fail('plugins', 'Duplicate plugin namespace')
    identities.add(identity)
    const snapshot = parsePluginStorageSnapshot({
      revision: entry.revision,
      records: entry.records,
    })
    if (new Set(snapshot.records.map(recordId)).size !== snapshot.records.length)
      fail('plugins.records', 'Duplicate storage record')
    return { pluginId, local, ...snapshot }
  })
  return { documentId: saved.documentId, plugins }
}

export function applyPluginStorage(
  plugins: readonly PluginStorageNamespace[],
  write: PluginStorageWrite,
  conceptIds: ReadonlySet<string>,
  viewIds: ReadonlySet<string>,
): readonly PluginStorageNamespace[] {
  const pluginId = checkPluginId(write.pluginId)
  const local = parseSettings(z.boolean(), write.local, 'local')
  const previous = findPluginStorage(plugins, pluginId, local)
  const revision = previous?.revision ?? 0
  if (!Number.isSafeInteger(write.revision) || write.revision < 0)
    fail('storage.revision', 'Expected a nonnegative safe integer')
  if (write.revision !== revision)
    throw new PluginError('stale-state', [
      { path: 'storage.revision', message: 'Plugin storage changed before commit' },
    ])
  const records = new Map(previous?.records.map((record) => [recordId(record), record]))
  if (write.kind === 'plugin-storage.delete') {
    const key = parsePluginStorageKey(write.key)
    records.delete(recordId(key))
  } else {
    const record = parsePluginStorageRecord(write.record)
    if (record.scope !== undefined) {
      const { kind, id } = record.scope
      if (kind === 'concept' && !isAbsoluteIri(id))
        fail('storage.scope.id', 'Expected an absolute IRI')
      if (!(kind === 'concept' ? conceptIds : viewIds).has(id))
        fail('storage.scope.id', kind === 'concept' ? 'Unknown concept' : 'Unknown view')
    }
    records.set(recordId(record), record)
  }
  if (
    records.size === (previous?.records.length ?? 0) &&
    (previous?.records ?? []).every(
      (record) => JSON.stringify(records.get(recordId(record))) === JSON.stringify(record),
    )
  )
    return plugins
  if (revision === Number.MAX_SAFE_INTEGER)
    fail('storage.revision', 'Storage revision limit exceeded')
  if (records.size > pluginStorageLimits.records)
    fail('storage.records', 'Storage record limit exceeded')
  const snapshot = { revision: revision + 1, records: [...records.values()] }
  checkMessageSize(snapshot, pluginStorageLimits.namespace)
  const entry = { pluginId, local, ...snapshot }
  const next = previous
    ? plugins.map((value) => (value === previous ? entry : value))
    : [...plugins, entry]
  if (next.length > pluginStorageLimits.namespaces)
    fail('storage', 'Plugin namespace limit exceeded')
  checkMessageSize(next, pluginStorageLimits.total - 4096)
  return next
}
