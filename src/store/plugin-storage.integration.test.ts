import assert from 'node:assert/strict'
import test from 'node:test'
import type { PersistenceSection } from '../../shared/persistence.ts'
import { createNessoStore } from './create.ts'
import { initializeNessoStore } from './initialize.ts'
import { connectPersistence, loadPersistence } from './persistence.ts'

const graph = { concepts: [{ id: 'urn:a', label: 'A', position: { x: 0, y: 0 } }, { id: 'urn:b', label: 'B', position: { x: 100, y: 0 } }], relations: [], relationTypes: [] }

const memoryStorage = () => {
  const records = new Map<PersistenceSection, unknown>()
  const writes: PersistenceSection[] = []
  return {
    records, writes,
    read: async (section: PersistenceSection) => structuredClone(records.get(section)),
    write: async (section: PersistenceSection, value: unknown) => { records.set(section, structuredClone(value)); writes.push(section) },
  }
}

const put = (host: ReturnType<typeof createNessoStore>, key: string, value: unknown, conceptId?: string) => {
  const revision = host.store.getState().pluginStorage.find(({ pluginId }) => pluginId === 'nesso-plugin-example')?.revision ?? 0
  host.store.applyOperations([{
    kind: 'plugin-storage.set', pluginId: 'nesso-plugin-example', documentId: host.store.getState().documentId, revision,
    record: conceptId === undefined ? { key, value: value as never } : { key, value: value as never, conceptId },
  }])
}

async function fixture() {
  const storage = memoryStorage()
  const host = createNessoStore(graph)
  host.store.setLocale('en')
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  await persistence.flush()
  storage.writes.length = 0
  return { storage, host, persistence }
}

test('plugin progress round-trips independently of graph JSON-LD without rewriting restored records', async () => {
  const { storage, host, persistence } = await fixture()
  const document = structuredClone(storage.records.get('document'))
  put(host, 'settings', { enabled: true })
  put(host, 'progress', { due: 123, log: ['good'] }, 'urn:a')
  await persistence.flush()
  assert.deepEqual(storage.writes, ['plugin-storage'])
  assert.deepEqual(storage.records.get('document'), document)
  const loaded = await loadPersistence(storage)
  assert.deepEqual(loaded.blocked, [])
  const reopened = initializeNessoStore(loaded, ['en'])
  assert.equal(reopened.store.getState().documentId, host.store.getState().documentId)
  assert.deepEqual(reopened.store.getState().pluginStorage, host.store.getState().pluginStorage)
  storage.writes.length = 0
  const restoredPersistence = connectPersistence(reopened, storage, loaded)
  await restoredPersistence.flush()
  assert.deepEqual(storage.writes, [])
  await restoredPersistence.dispose()
  await persistence.dispose()
})

test('startup removes only concept orphans after successful restoration and persists cleanup without executing plugins', async () => {
  const { storage, host, persistence } = await fixture()
  put(host, 'settings', { enabled: true })
  put(host, 'progress', 'live', 'urn:a')
  put(host, 'progress', 'deleted', 'urn:b')
  host.store.removeConcept('urn:b')
  await persistence.dispose()
  const original = structuredClone(storage.records.get('plugin-storage'))
  const loaded = await loadPersistence(storage)
  assert.equal(loaded.pluginStorage?.[0].records.length, 3)
  const reopened = initializeNessoStore(loaded, ['en'])
  assert.equal(reopened.store.getState().pluginStorage[0].records.length, 2)
  assert.deepEqual(storage.records.get('plugin-storage'), original)
  storage.writes.length = 0
  const restoredPersistence = connectPersistence(reopened, storage, loaded)
  assert.equal(await restoredPersistence.flush(), true)
  assert.deepEqual(storage.writes, ['plugin-storage'])
  const cleaned = await loadPersistence(storage)
  assert.deepEqual(cleaned.pluginStorage?.[0].records.map(({ conceptId }) => conceptId), [undefined, 'urn:a'])
  await restoredPersistence.dispose()
})

test('failed, missing or mismatched document/storage restoration never overwrites or cleans saved plugin data', async () => {
  for (const failure of ['document', 'plugin-storage', 'missing-document', 'wrong-document']) {
    const { storage, host, persistence } = await fixture()
    put(host, 'progress', 'keep', 'urn:b')
    host.store.removeConcept('urn:b')
    await persistence.dispose()
    if (failure === 'document') storage.records.set('document', 'unreadable')
    if (failure === 'plugin-storage') storage.records.set('plugin-storage', 'unreadable')
    if (failure === 'missing-document') storage.records.delete('document')
    if (failure === 'wrong-document') storage.records.set('plugin-storage', { ...(storage.records.get('plugin-storage') as object), documentId: 'urn:other-document' })
    const original = structuredClone(storage.records.get('plugin-storage'))
    const loaded = await loadPersistence(storage)
    assert.ok(loaded.blocked.includes('plugin-storage'))
    const reopened = initializeNessoStore(loaded, ['en'])
    assert.deepEqual(reopened.store.getState().pluginStorage, [])
    const restoredPersistence = connectPersistence(reopened, storage, loaded)
    await restoredPersistence.flush()
    assert.deepEqual(storage.records.get('plugin-storage'), original)
    assert.ok(reopened.store.getState().persistenceIssues.some(({ section }) => section === 'plugin-storage'))
    await restoredPersistence.dispose()
  }
})

test('reset storage cannot replace the old document data until the new document identity is saved', async () => {
  const { storage, host, persistence } = await fixture()
  put(host, 'settings', 'old')
  await persistence.flush()
  const original = structuredClone(storage.records.get('plugin-storage'))
  const save = storage.write
  storage.write = async (section, value) => {
    if (section === 'document') throw new Error('Disk full')
    await save(section, value)
  }
  host.store.resetGraph()
  assert.equal(await persistence.flush(), false)
  assert.deepEqual(storage.records.get('plugin-storage'), original)
  assert.ok(host.store.getState().persistenceIssues.some(({ section }) => section === 'document'))
  storage.write = save
  storage.writes.length = 0
  assert.equal(await persistence.flush(), true)
  assert.deepEqual(storage.writes, ['document', 'plugin-storage'])
  const restored = await loadPersistence(storage)
  assert.deepEqual(restored.blocked, [])
  assert.equal(restored.documentId, host.store.getState().documentId)
  assert.deepEqual(restored.pluginStorage, [])
  await persistence.dispose()
})
