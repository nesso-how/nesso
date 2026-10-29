import assert from 'node:assert/strict'
import test from 'node:test'
import { pluginStorageLimits } from '@nesso-how/plugin/runtime'
import { createNessoStore } from './create.ts'
import { parsePluginStorage, type PluginStorageWrite } from './plugin-storage.ts'

const graph = { concepts: [{ id: 'urn:a', label: 'A', position: { x: 0, y: 0 } }, { id: 'urn:b', label: 'B', position: { x: 100, y: 0 } }], relations: [], relationTypes: [] }
const set = (host: ReturnType<typeof createNessoStore>, key: string, value: unknown, conceptId?: string, revision = 0, pluginId = 'nesso-plugin-example'): PluginStorageWrite => ({
  kind: 'plugin-storage.set', documentId: host.store.getState().documentId, pluginId, revision,
  record: conceptId === undefined ? { key, value: value as never } : { key, value: value as never, conceptId },
})
const remove = (host: ReturnType<typeof createNessoStore>, key: string, conceptId?: string, revision = 0): PluginStorageWrite => ({
  kind: 'plugin-storage.delete', documentId: host.store.getState().documentId, pluginId: 'nesso-plugin-example', revision,
  key: conceptId === undefined ? { key } : { key, conceptId },
})

test('storage writes are immutable and outside graph history, including net no-ops', () => {
  const host = createNessoStore(graph)
  const initial = host.store.getState()
  const value = { count: 1 }
  host.store.applyOperations([
    set(host, 'progress', value),
    set(host, 'progress', [true, null], 'urn:a', 1),
    set(host, 'progress', 'other', 'urn:b', 2),
  ])
  value.count = 99
  const saved = host.store.getState()
  assert.equal(saved.graph, initial.graph)
  assert.equal(saved.workspace, initial.workspace)
  assert.equal(saved.preferences, initial.preferences)
  assert.equal(saved.conversation, initial.conversation)
  assert.equal(saved.history, initial.history)
  assert.deepEqual(saved.pluginStorage[0].records[0].value, { count: 1 })
  assert.equal(saved.pluginStorage[0].records.length, 3)
  assert.equal(saved.pluginStorage[0].revision, 3)
  host.store.applyOperations([set(host, 'progress', { count: 1 }, undefined, 3)])
  assert.equal(host.store.getState(), saved)
  host.store.applyOperations([set(host, 'temporary', 0, undefined, 3)])
  host.store.applyOperations([remove(host, 'temporary', undefined, 4)])
  const evolved = host.store.getState()
  assert.equal(evolved.pluginStorage[0].revision, 5)
  for (const operation of [
    set(host, 'progress', 2, undefined, 0),
    set(host, 'invalid', 0, 'urn:missing', 5),
    { ...set(host, 'progress', 2, undefined, 5), documentId: 'urn:other' },
    { ...set(host, 'progress', 2, undefined, 5), pluginId: '../other' },
  ]) {
    assert.throws(() => host.store.applyOperations([operation]))
    assert.equal(host.store.getState(), evolved)
  }
  assert.throws(() => host.store.applyOperations([
    { kind: 'concept.label', id: 'urn:a', value: 'Must roll back' },
    set(host, 'bad', 0, 'urn:missing', 5),
  ]))
  assert.equal(host.store.getState(), evolved)
  host.setWritesPaused(true)
  assert.throws(() => host.store.applyOperations([remove(host, 'progress', undefined, 5)]), /being moved/)
  assert.equal(host.store.getState(), evolved)
  host.setWritesPaused(false)
  host.store.setConceptLabel('urn:a', 'Changed')
  host.store.undo()
  assert.deepEqual(host.store.getState().graph, graph)
  assert.equal(host.store.getState().pluginStorage, evolved.pluginStorage)
  host.store.applyOperations([remove(host, 'progress', 'urn:b', 5)])
  assert.equal(host.store.getState().history.canRedo, true)
  host.store.redo()
  assert.equal(host.store.getState().graph.concepts[0].label, 'Changed')
  assert.equal(host.store.getState().pluginStorage[0].records.length, 2)
})

test('view edits and concept deletion retain progress for undo, while a reset starts a fresh document namespace', () => {
  const host = createNessoStore(graph)
  host.store.applyOperations([set(host, 'progress', { count: 1 }, 'urn:a')])
  const saved = host.store.getState()
  const view = host.store.createView('A', ['urn:a'])
  host.store.setViewMembership(view, 'urn:a', false)
  assert.equal(host.store.getState().pluginStorage, saved.pluginStorage)
  host.store.deleteView(view)
  assert.equal(host.store.getState().pluginStorage, saved.pluginStorage)
  host.store.removeConcept('urn:a')
  assert.equal(host.store.getState().pluginStorage, saved.pluginStorage)
  host.store.undo()
  assert.ok(host.store.getState().graph.concepts.some(({ id }) => id === 'urn:a'))
  assert.equal(host.store.getState().pluginStorage, saved.pluginStorage)
  host.store.applyOperations([{ kind: 'document.reset', id: 'urn:a' }])
  assert.notEqual(host.store.getState().documentId, saved.documentId)
  assert.deepEqual(host.store.getState().pluginStorage, [])
  assert.equal(host.store.getState().history.canUndo, false)
  const reset = host.store.getState()
  assert.throws(() => host.store.applyOperations([{ ...set(host, 'progress', 0), documentId: saved.documentId }]))
  assert.equal(host.store.getState(), reset)
})

test('storage restoration rejects duplicate namespaces/records and namespace and record quotas are atomic', () => {
  const record = { key: 'progress', value: null }
  const entry = { pluginId: 'nesso-plugin-example', revision: 1, records: [record] }
  const saved = { version: 1, documentId: 'urn:document', plugins: [entry] }
  assert.deepEqual(parsePluginStorage(saved), { documentId: saved.documentId, plugins: saved.plugins })
  for (const value of [
    { ...saved, version: 2 }, { ...saved, documentId: 'relative' }, { ...saved, plugins: [entry, entry] },
    { ...saved, plugins: [{ ...entry, records: [record, record] }] },
    { ...saved, plugins: [{ ...entry, pluginId: '../other' }] },
  ]) assert.throws(() => parsePluginStorage(value))
  const full = createNessoStore(graph, { documentId: saved.documentId, pluginStorage: [{ ...entry, records: Array.from({ length: pluginStorageLimits.records }, (_, index) => ({ key: String(index), value: null })) }] })
  const before = full.store.getState()
  assert.throws(() => full.store.applyOperations([set(full, 'overflow', null, undefined, 1)]))
  assert.equal(full.store.getState(), before)
  const text = 'x'.repeat(240 * 1024)
  const large = createNessoStore(graph, { pluginStorage: [{ ...entry, records: Array.from({ length: 34 }, (_, index) => ({ key: String(index), value: text })) }] })
  const largeBefore = large.store.getState()
  assert.throws(() => large.store.applyOperations([set(large, 'overflow', text, undefined, 1)]))
  assert.equal(large.store.getState(), largeBefore)
  const namespaces = createNessoStore(graph, { pluginStorage: Array.from({ length: pluginStorageLimits.namespaces }, (_, index) => ({ ...entry, pluginId: `nesso-plugin-${index}` })) })
  const namespaceBefore = namespaces.store.getState()
  assert.throws(() => namespaces.store.applyOperations([set(namespaces, 'overflow', null)]))
  assert.equal(namespaces.store.getState(), namespaceBefore)
})
