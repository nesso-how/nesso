import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, rm, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createFileStorage } from './file-storage.ts'
import { ElectronError } from './errors.ts'

test('file storage round-trips independent records, orders writes and preserves unreadable files', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-storage-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createFileStorage(directory)
  assert.equal(await storage.read('document'), undefined)
  await Promise.all([
    storage.write('document', { version: 1, value: 'first' }),
    storage.write('document', { version: 1, value: 'last' }),
    storage.write('preferences', { version: 1 }),
    storage.write('plugin-storage', { version: 1, documentId: 'urn:document', plugins: [] }),
  ])
  assert.deepEqual(await storage.read('document'), { version: 1, value: 'last' })
  assert.deepEqual(await storage.read('preferences'), { version: 1 })
  assert.deepEqual(await storage.read('plugin-storage'), { version: 1, documentId: 'urn:document', plugins: [] })
  if (process.platform !== 'win32') assert.equal((await stat(path.join(directory, 'document.json'))).mode & 0o777, 0o600)
  await writeFile(path.join(directory, 'document.json'), 'unreadable')
  await assert.rejects(storage.read('document'), ElectronError)
  assert.equal(await readFile(path.join(directory, 'document.json'), 'utf8'), 'unreadable')
})

test('failed file writes keep the previous record intact and do not poison the queue', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-storage-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createFileStorage(directory)
  await storage.write('document', { version: 1 })
  await mkdir(path.join(directory, 'document.json.tmp'))
  await assert.rejects(storage.write('document', { version: 2 }), ElectronError)
  assert.deepEqual(await storage.read('document'), { version: 1 })
  await storage.write('preferences', { version: 1 })
  assert.deepEqual(await storage.read('preferences'), { version: 1 })
})
