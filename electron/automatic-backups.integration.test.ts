import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createAutomaticBackups } from './automatic-backups.ts'
import { createFileStorage } from './file-storage.ts'
import { createDataLocation } from './data-location.ts'
import { createNessoStore } from '../src/store/create.ts'
import { connectPersistence, loadPersistence } from '../src/store/persistence.ts'

async function fixture(context: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'nesso-automatic-backups-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const userData = path.join(root, 'app')
  const location = await createDataLocation(userData)
  const storage = createFileStorage(userData)
  const persistence = connectPersistence(
    createNessoStore(null),
    storage,
    await loadPersistence(storage),
  )
  await persistence.dispose()
  const open = () => createAutomaticBackups(userData, storage, '1.0.0', location)
  return { root, userData, storage, open }
}

test('automatic backups skip unchanged data, keep the latest 10 copies and report unreadable data', async (context) => {
  const { userData, storage, open } = await fixture(context)
  const automatic = await open()
  const directory = automatic.state().directory
  const copies = async () => (await readdir(directory)).sort()
  await automatic.capture()
  await automatic.capture()
  assert.equal((await copies()).length, 1)
  for (let index = 0; index < 11; index++) {
    await storage.write('conversation', {
      version: 1,
      messages: [{ id: `${index}`, role: 'user', content: `Message ${index}` }],
    })
    await automatic.capture()
  }
  const kept = await copies()
  assert.equal(kept.length, 10)
  const newest = JSON.parse(await readFile(path.join(directory, kept.at(-1)!), 'utf8'))
  assert.equal(newest.records.conversation.messages[0].content, 'Message 10')
  await writeFile(path.join(userData, 'document.json'), 'unreadable')
  await automatic.capture()
  assert.equal(automatic.state().failed, true)
  assert.deepEqual(await copies(), kept)
})

test('backup folder changes persist, isolate installations and do not fall back when offline', async (context) => {
  const { root, userData, storage, open } = await fixture(context)
  const automatic = await open()
  await automatic.capture()
  const original = await readdir(automatic.state().directory)
  await assert.rejects(automatic.setDirectory(userData))
  const cloud = path.join(root, 'cloud')
  await mkdir(cloud)
  const selected = await automatic.setDirectory(cloud)
  assert.equal(selected.failed, false)
  const copies = await readdir(selected.directory)
  assert.equal(copies.length, 1)
  assert.deepEqual(await automatic.setDirectory(selected.directory), selected)
  const restarted = await open()
  assert.deepEqual(restarted.state(), selected)
  await restarted.capture()
  assert.deepEqual(await readdir(selected.directory), copies)
  const otherRoot = path.join(root, 'other')
  const other = await createAutomaticBackups(
    otherRoot,
    storage,
    '1.0.0',
    await createDataLocation(otherRoot),
  )
  const second = await other.setDirectory(cloud)
  assert.notEqual(second.directory, selected.directory)
  assert.equal((await readdir(second.directory)).length, 1)
  await rename(cloud, `${cloud}-offline`)
  await assert.rejects(restarted.capture())
  assert.equal(restarted.state().failed, true)
  const offline = await open()
  assert.equal(offline.state().directory, selected.directory)
  assert.equal(offline.state().failed, true)
  await assert.rejects(lstat(cloud), { code: 'ENOENT' })
  assert.deepEqual(await readdir(selected.defaultDirectory), original)
  const restored = await restarted.setDirectory()
  assert.equal(restored.directory, selected.defaultDirectory)
  assert.equal(restored.failed, false)
  await symlink(`${cloud}-offline`, path.join(root, 'linked'), 'dir')
  await assert.rejects(restarted.setDirectory(path.join(root, 'linked')))
  const configFile = path.join(userData, 'automatic-backups.json')
  await writeFile(configFile, '{"version":99}')
  const invalid = await open()
  assert.equal(invalid.state().configurationFailed, true)
  assert.equal(invalid.state().directory, selected.defaultDirectory)
  await invalid.capture()
  assert.equal(await readFile(configFile, 'utf8'), '{"version":99}')
})
