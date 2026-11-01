import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRecordReplacement } from './record-replacement.ts'
import { persistenceSections, type PersistenceSection } from '../shared/persistence.ts'

test('partial replacement failures roll back every record and preserve originally missing records', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-replace-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  await writeFile(path.join(directory, 'document.json'), 'original unreadable bytes')
  await mkdir(path.join(directory, 'preferences.json.restore-tmp'))
  const replacement = createRecordReplacement(() => directory)
  const records = Object.fromEntries(
    persistenceSections.map((section) => [section, { version: 1, section }]),
  ) as Record<PersistenceSection, unknown>
  await assert.rejects(replacement.replace(records), /backupRestoreFailed/)
  assert.equal(
    await readFile(path.join(directory, 'document.json'), 'utf8'),
    'original unreadable bytes',
  )
  assert.equal((await readdir(directory)).includes('.nesso-restore.json'), false)
  await assert.rejects(readFile(path.join(directory, 'preferences.json')), { code: 'ENOENT' })
  await writeFile(path.join(directory, 'preferences.json'), 'original preferences')
  await assert.rejects(replacement.replace(records), /backupRecoveryRequired/)
  const journal = JSON.parse(await readFile(path.join(directory, '.nesso-restore.json'), 'utf8'))
  assert.deepEqual(journal.records, {
    document: 'original unreadable bytes',
    preferences: 'original preferences',
    conversation: null,
    'plugin-storage': null,
  })
})

test('startup rolls back an interrupted replacement before loading data, without retaining an automatic backup', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-recover-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const records = {
    document: 'original',
    preferences: null,
    conversation: 'original chat',
    'plugin-storage': 'original progress',
  }
  await writeFile(
    path.join(directory, '.nesso-restore.json'),
    JSON.stringify({ version: 1, records }),
  )
  for (const section of persistenceSections)
    await writeFile(path.join(directory, `${section}.json`), 'partly replaced')
  const replacement = createRecordReplacement(() => directory)
  await replacement.recover()
  for (const section of ['document', 'conversation', 'plugin-storage'] as const)
    assert.equal(await readFile(path.join(directory, `${section}.json`), 'utf8'), records[section])
  await assert.rejects(readFile(path.join(directory, 'preferences.json')), { code: 'ENOENT' })
  assert.equal(
    (await readdir(directory)).some((name) => name.includes('restore')),
    false,
  )
  await writeFile(path.join(directory, '.nesso-restore.json'), 'invalid journal')
  await assert.rejects(replacement.recover())
  assert.equal(await readFile(path.join(directory, 'document.json'), 'utf8'), 'original')
})
