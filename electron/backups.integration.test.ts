import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createNessoStore } from '../src/store/create.ts'
import { connectPersistence, loadPersistence } from '../src/store/persistence.ts'
import { parseBackup } from '../src/store/backup.ts'
import { createFileStorage } from './file-storage.ts'
import { createBackups } from './backups.ts'
import { createRecordReplacement } from './record-replacement.ts'
import { persistenceSections } from '../shared/persistence.ts'
import type { Backup } from '../shared/backup.ts'
import { automaticBackupName } from '../shared/backup.ts'

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
    { kind: 'preferences.disabledBundledActionPlugins', value: ['@nesso-how/review'] },
    {
      kind: 'plugin-storage.set',
      pluginId: '@nesso-how/review',
      documentId: initial.documentId,
      revision: 0,
      record: {
        key: 'progress',
        scope: { kind: 'concept', id: initial.graph.concepts[0].id },
        value: { reviews: 3 },
      },
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
    assert.deepEqual(backup.records[section], (await storage.read(section)) ?? null)
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
    { ...backup, records: { ...backup.records, preferences: { version: 99 } } },
  ])
    await assert.rejects(parseBackup(value), /backupInvalid|backupUnsupported/)
  const orphan = structuredClone(backup) as Backup & {
    records: {
      'plugin-storage': { plugins: { records: { scope: { kind: 'concept'; id: string } }[] }[] }
    }
  }
  orphan.records['plugin-storage'].plugins[0].records[0].scope.id = 'urn:missing'
  assert.deepEqual(await parseBackup(orphan), orphan)
  await writeFile(path.join(directory, 'preferences.json'), 'unreadable')
  await writeFile(file, 'keep existing export')
  await assert.rejects(backups.save(file), /backupInvalid|File read failed|Unexpected token/)
  assert.equal(await readFile(file, 'utf8'), 'keep existing export')
})

test('migration backups preserve all original records and restore through the manual backup path', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-migration-backup-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createFileStorage(directory)
  const host = createNessoStore(null)
  host.store.setLocale('it')
  host.store.setChatMessages([{ id: 'old', role: 'user', content: 'Original conversation' }])
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  assert.equal(await persistence.flush(), true)
  await persistence.dispose()
  const document = (await storage.read('document')) as { graph: unknown; workspace: unknown }
  const legacy = { version: 1, graph: document.graph, workspace: document.workspace }
  await storage.write('document', legacy)
  const preferences = (await storage.read('preferences')) as {
    preferences: Record<string, unknown>
  }
  const { canvasTabOrder: _, ...legacyPreferences } = preferences.preferences
  await storage.write('preferences', { version: 1, preferences: legacyPreferences })
  const originals = Object.fromEntries(
    await Promise.all(
      persistenceSections.map(async (section) => [section, (await storage.read(section)) ?? null]),
    ),
  )
  const loaded = await loadPersistence(storage)
  assert.deepEqual(await storage.read('document'), legacy)
  const reopened = createNessoStore(loaded.graph!, loaded)
  const autosave = connectPersistence(reopened, storage, loaded)
  reopened.store.setLocale('en')
  reopened.store.setChatMessages([{ id: 'new', role: 'user', content: 'After migration' }])
  assert.equal(await autosave.flush(), true)
  await autosave.dispose()
  assert.deepEqual(await storage.read('document'), {
    ...legacy,
    version: 2,
    documentId: loaded.documentId,
  })
  const upgraded = await loadPersistence(storage)
  assert.equal(upgraded.upgrades, undefined)
  assert.equal(upgraded.documentId, loaded.documentId)
  const nextAutosave = connectPersistence(reopened, storage, upgraded)
  assert.equal(await nextAutosave.flush(), true)
  await nextAutosave.dispose()
  const files = (await readdir(directory)).filter((name) => automaticBackupName.test(name))
  assert.equal(files.length, 1)
  const file = path.join(directory, files[0])
  const text = await readFile(file, 'utf8')
  const backup = JSON.parse(text) as Backup
  assert.deepEqual(backup.records, originals)
  const manual = createBackups(() => directory, '1.0.0-alpha.34')
  const candidate = await manual.choose(1, file)
  const restored = manual.take(1, candidate.id)
  assert.deepEqual(restored.records.preferences, {
    version: 3,
    preferences: preferences.preferences,
  })
  await storage.write('plugin-storage', { version: 1, documentId: loaded.documentId, plugins: [] })
  await createRecordReplacement(() => directory).replace(restored.records)
  const result = await loadPersistence(storage)
  assert.deepEqual(result.blocked, [])
  assert.deepEqual(result.graph, loaded.graph)
  assert.deepEqual(result.workspace, loaded.workspace)
  assert.deepEqual(result.preferences, loaded.preferences)
  assert.deepEqual(result.conversation, loaded.conversation)
  assert.equal(await storage.read('plugin-storage'), undefined)
  assert.equal(await readFile(file, 'utf8'), text)
})
