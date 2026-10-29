import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePluginManifest, parsePluginMessage, PluginError } from '../src/runtime.ts'
import { parsePluginStorageKey, parsePluginStorageRecord, parsePluginStorageSnapshot, pluginStorageLimits } from '../src/storage.ts'

test('storage contracts accept JSON records, concept keys and single writes without namespace authority', () => {
  assert.deepEqual(parsePluginStorageRecord({ key: 'settings', value: { retention: 0.9, steps: [1, true, null, 'text'] } }), { key: 'settings', value: { retention: 0.9, steps: [1, true, null, 'text'] } })
  assert.deepEqual(parsePluginStorageRecord({ key: 'progress', conceptId: 'urn:concept', value: { due: 10 } }), { key: 'progress', conceptId: 'urn:concept', value: { due: 10 } })
  assert.deepEqual(parsePluginStorageKey({ key: 'obsolete', conceptId: 'urn:concept' }), { key: 'obsolete', conceptId: 'urn:concept' })
  assert.deepEqual(parsePluginStorageRecord({ key: 'progress', conceptId: 'relative', value: null }), { key: 'progress', conceptId: 'relative', value: null })
  const list = { type: 'request', id: 1, contextId: 'context', method: 'storage.list', params: {} }
  assert.deepEqual(parsePluginMessage(list), list)
  const set = { ...list, method: 'storage.set', params: { revision: 0, key: 'settings', value: null } }
  assert.deepEqual(parsePluginMessage(set), set)
  const remove = { ...list, method: 'storage.delete', params: { revision: 0, key: 'settings', conceptId: 'urn:concept' } }
  assert.deepEqual(parsePluginMessage(remove), remove)
  for (const params of [{ ...set.params, pluginId: 'other' }, { ...set.params, documentId: 'urn:other' }, { ...set.params, revision: -1 }, { ...remove.params, revision: -1 }]) {
    assert.throws(() => parsePluginMessage({ ...list, method: 'storage.set', params }), PluginError)
  }
  const manifest = { apiVersion: 1, kind: 'actions', entry: 'index.js', writes: [], capabilities: ['storage'] }
  assert.deepEqual(parsePluginManifest(manifest).capabilities, manifest.capabilities)
  assert.throws(() => parsePluginManifest({ ...manifest, capabilities: ['storage.list'] }), PluginError)
})

test('storage payloads reject non-JSON values, unsupported fields, excessive nesting and quotas', () => {
  const key = { key: 'progress' }
  let nested: unknown = null
  for (let index = 0; index < pluginStorageLimits.depth + 1; index++) nested = { nested }
  const cyclic: { self?: unknown } = {}
  cyclic.self = cyclic
  for (const value of [
    undefined, NaN, Infinity, 1n, new Date(), new Map(), () => {}, { missing: undefined }, [undefined], nested, cyclic,
    new Array<unknown>(1), Object.assign([1], { extra: true }), { [Symbol('extra')]: true }, Object.create(null),
    'x'.repeat(pluginStorageLimits.record),
  ]) assert.throws(() => parsePluginStorageRecord({ ...key, value }), PluginError)
  for (const change of [{ key: '' }, { key: 'x'.repeat(129) }, { conceptId: null }, { conceptId: 'x'.repeat(2049) }, { namespace: 'other' }]) {
    assert.throws(() => parsePluginStorageRecord({ ...key, value: null, ...change }), PluginError)
  }
  for (const change of [{ key: '' }, { conceptId: null }, { value: null }]) {
    assert.throws(() => parsePluginStorageKey({ ...key, ...change }), PluginError)
  }
  for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parsePluginStorageSnapshot({ revision, records: [] }), PluginError)
  assert.throws(() => parsePluginStorageSnapshot({ revision: 0, records: Array.from({ length: pluginStorageLimits.records + 1 }, () => ({ ...key, value: null })) }), PluginError)
})

test('storage parsing owns payloads and preserves JSON values that resemble special object properties', () => {
  const value = JSON.parse('{"__proto__":{"safe":true},"constructor":"value"}')
  const records = [{ key: '__proto__', value }]
  const snapshot = parsePluginStorageSnapshot({ revision: 1, records })
  value.constructor = 'changed'
  assert.equal(JSON.stringify(snapshot.records[0].value), '{"__proto__":{"safe":true},"constructor":"value"}')
  assert.notEqual(snapshot.records, records)
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot.records[0].value, '__proto__'), true)
})
