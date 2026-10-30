import validateName from 'validate-npm-package-name'
import { isAbsoluteIri } from '@nesso-how/schema'
import type { PluginStorageKey, PluginStorageRecord } from '@nesso-how/plugin'
import {
  checkMessageSize,
  parsePluginStorageKey,
  parsePluginStorageRecord,
  parsePluginStorageSnapshot,
  pluginStorageLimits,
  PluginError,
} from '@nesso-how/plugin/runtime'
import { fail, object } from './settings.ts'

export type PluginStorageNamespace = ReturnType<typeof parsePluginStorageSnapshot> & {
  readonly pluginId: string
}
export type PluginStorageWrite =
  | {
      readonly kind: 'plugin-storage.set'
      readonly pluginId: string
      readonly documentId: string
      readonly revision: number
      readonly record: PluginStorageRecord
    }
  | {
      readonly kind: 'plugin-storage.delete'
      readonly pluginId: string
      readonly documentId: string
      readonly revision: number
      readonly key: PluginStorageKey
    }

const recordId = (record: { readonly key: string; readonly conceptId?: string }) =>
  JSON.stringify([record.conceptId ?? null, record.key])

const checkPluginId = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > 214 || !validateName(value).validForNewPackages)
    fail('pluginId', 'Expected a valid npm package name')
  return value as string
}

export function parsePluginStorage(value: unknown): {
  readonly documentId: string
  readonly plugins: readonly PluginStorageNamespace[]
} {
  checkMessageSize(value, pluginStorageLimits.total)
  const saved = object(value, '', ['version', 'documentId', 'plugins'])
  if (saved.version !== 1) fail('version', 'Unsupported storage version')
  if (typeof saved.documentId !== 'string' || !isAbsoluteIri(saved.documentId))
    fail('documentId', 'Expected an absolute document IRI')
  if (!Array.isArray(saved.plugins) || saved.plugins.length > pluginStorageLimits.namespaces)
    fail('plugins', 'Plugin namespace limit exceeded')
  const identities = new Set<string>()
  const plugins = (saved.plugins as unknown[]).map((value) => {
    const entry = object(value, 'plugins', ['pluginId', 'revision', 'records'])
    const pluginId = checkPluginId(entry.pluginId)
    if (identities.has(pluginId)) fail('plugins', 'Duplicate plugin namespace')
    identities.add(pluginId)
    const snapshot = parsePluginStorageSnapshot({
      revision: entry.revision,
      records: entry.records,
    })
    if (new Set(snapshot.records.map(recordId)).size !== snapshot.records.length)
      fail('plugins.records', 'Duplicate storage record')
    return { pluginId, ...snapshot }
  })
  return { documentId: saved.documentId as string, plugins }
}

export function applyPluginStorage(
  plugins: readonly PluginStorageNamespace[],
  write: PluginStorageWrite,
  conceptIds: ReadonlySet<string>,
): readonly PluginStorageNamespace[] {
  const pluginId = checkPluginId(write.pluginId)
  const previous = plugins.find((entry) => entry.pluginId === pluginId)
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
    if (record.conceptId !== undefined && !isAbsoluteIri(record.conceptId))
      fail('storage.conceptId', 'Expected an absolute concept IRI')
    if (record.conceptId !== undefined && !conceptIds.has(record.conceptId))
      fail('storage.conceptId', 'Unknown concept')
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
  const entry = { pluginId, ...snapshot }
  const next = previous
    ? plugins.map((value) => (value === previous ? entry : value))
    : [...plugins, entry]
  if (next.length > pluginStorageLimits.namespaces)
    fail('storage', 'Plugin namespace limit exceeded')
  checkMessageSize(next, pluginStorageLimits.total - 4096)
  return next
}

export function collectPluginStorageOrphans(
  plugins: readonly PluginStorageNamespace[],
  conceptIds: ReadonlySet<string>,
): readonly PluginStorageNamespace[] {
  const next = plugins.map((entry) => {
    const records = entry.records.filter(
      (record) => record.conceptId === undefined || conceptIds.has(record.conceptId),
    )
    return records.length === entry.records.length ? entry : { ...entry, records }
  })
  return next.every((entry, index) => entry === plugins[index]) ? plugins : next
}
