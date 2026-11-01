import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createNessoStore } from '../src/store/create.ts'
import { connectPersistence, loadPersistence } from '../src/store/persistence.ts'
import { parseBackup } from '../src/store/backup.ts'
import { createFileStorage } from './file-storage.ts'
import { createBackups } from './backups.ts'
import { persistenceSections } from '../shared/persistence.ts'
import type { Backup } from '../shared/backup.ts'

test('manual backups round-trip every record, exclude device secrets and bind confirmation to exact chosen content', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'nesso-backup-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const directory = path.join(root, 'data')
  const storage = createFileStorage(directory)
  const host = createNessoStore(null)
  host.store.setLocale('it')
  host.store.setChatMessages([{ id: 'question', role: 'user', content: 'Remember this' }])
  const initial = host.store.getState()
  host.store.applyOperations([
    {
      kind: 'plugin-storage.set',
      pluginId: '@nesso-how/review',
      documentId: initial.documentId,
      revision: 0,
      record: { key: 'progress', conceptId: initial.graph.concepts[0].id, value: { reviews: 3 } },
    },
  ])
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  assert.equal(await persistence.flush(), true)
  await persistence.dispose()
  await writeFile(path.join(directory, 'ai-connections.enc'), 'secret')
  const backups = createBackups(() => directory, '1.0.0-alpha.33')
  const file = path.join(root, 'backup.json')
  await backups.save(file)
  const backup = await parseBackup(JSON.parse(await readFile(file, 'utf8')))
  assert.deepEqual(Object.keys(backup.records), [...persistenceSections])
  assert.equal(JSON.stringify(backup).includes('secret'), false)
  for (const section of persistenceSections)
    assert.deepEqual(backup.records[section], await storage.read(section))
  const candidate = await backups.choose(1, file)
  await writeFile(file, 'replaced after confirmation')
  assert.throws(() => backups.take(2, candidate.id), /backupInvalid/)
  assert.deepEqual(backups.take(1, candidate.id), backup)
  assert.throws(() => backups.take(1, candidate.id), /backupInvalid/)
  for (const value of [
    { ...backup, format: 'nesso-backup-prototype' },
    { ...backup, version: 2 },
    { ...backup, records: { ...backup.records, preferences: undefined } },
    { ...backup, records: { ...backup.records, document: { version: 99 } } },
  ])
    await assert.rejects(parseBackup(value), /backupInvalid|backupUnsupported/)
  const orphan = structuredClone(backup) as Backup & {
    records: { 'plugin-storage': { plugins: { records: { conceptId: string }[] }[] } }
  }
  orphan.records['plugin-storage'].plugins[0].records[0].conceptId = 'urn:missing'
  const cleaned = (await parseBackup(orphan)) as Backup & {
    records: { 'plugin-storage': { plugins: { records: unknown[] }[] } }
  }
  assert.deepEqual(cleaned.records['plugin-storage'].plugins[0].records, [])
  await writeFile(path.join(directory, 'preferences.json'), 'unreadable')
  await writeFile(file, 'keep existing export')
  await assert.rejects(backups.save(file), /backupInvalid|File read failed|Unexpected token/)
  assert.equal(await readFile(file, 'utf8'), 'keep existing export')
})
