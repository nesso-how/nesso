import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createDataLocation } from './index.ts'
import { createFileStorage } from '../file-storage.ts'
import { persistenceSections } from '../../shared/persistence.ts'

const digest = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')

async function fixture(context: TestContext, committed?: boolean, legacy = false) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'nesso-location-')))
  context.after(() => rm(root, { recursive: true, force: true }))
  const source = path.join(root, 'default')
  const destination = path.join(root, 'chosen')
  const bootstrap = path.join(source, 'data-location.json')
  await mkdir(source)
  await mkdir(destination)
  const identity = randomUUID()
  const files = ['document.json', '.nesso-data-id'].map((name) => {
    const data = name === 'document.json' ? '{"version":1}' : identity
    return { name, data, hash: digest(data) }
  })
  if (committed !== undefined) {
    for (const { name, data } of files) {
      await writeFile(path.join(source, name), data)
      await writeFile(path.join(destination, name), data)
    }
    await writeFile(
      bootstrap,
      JSON.stringify({
        ...(legacy ? {} : { version: 1 }),
        directory: committed ? destination : source,
        identity,
        transfer: { source, destination, files: files.map(({ name, hash }) => ({ name, hash })) },
      }),
    )
  }
  return { root, source, destination, bootstrap, identity, files }
}

test('moves JSON records live and restores the default, leaving credentials and profile files local', async (context) => {
  const { source, destination } = await fixture(context)
  await mkdir(path.join(source, 'Cache'))
  const credentials = [
    'ai-connections.enc',
    `ai-connections.enc.backup-${'a'.repeat(64)}`,
    'mcp-access.enc',
  ]
  for (const name of credentials) await writeFile(path.join(source, name), 'local secret')
  const location = await createDataLocation(source)
  const storage = createFileStorage(location.directory)
  for (const section of persistenceSections) await storage.write(section, { version: 1 })
  await location.move(destination)
  assert.equal(location.state().directory, destination)
  assert.equal(location.state().cleanupPending, false)
  assert.deepEqual((await readdir(source)).sort(), [
    'Cache',
    'ai-connections.enc',
    credentials[1],
    'data-location.json',
    'mcp-access.enc',
  ])
  assert.deepEqual(
    (await readdir(destination)).sort(),
    ['.nesso-data-id', ...persistenceSections.map((section) => `${section}.json`)].sort(),
  )
  await storage.write('document', { version: 2 })
  const backup = `nesso-backup-${randomUUID()}.json`
  await writeFile(path.join(destination, backup), 'complete backup')
  assert.equal((await createDataLocation(source)).state().directory, destination)
  assert.deepEqual(await storage.read('document'), { version: 2 })
  assert.deepEqual(await storage.read('plugin-storage'), { version: 1 })
  await location.move(source)
  assert.equal(await readFile(path.join(source, backup), 'utf8'), 'complete backup')
  assert.deepEqual(await readdir(destination), [])
  assert.deepEqual(await storage.read('document'), { version: 2 })
  for (const name of credentials)
    assert.equal(await readFile(path.join(source, name), 'utf8'), 'local secret')
})

test('rejects occupied, overlapping and invalid destinations, and never transfers symlinked records', async (context) => {
  const { root, source, destination } = await fixture(context)
  const location = await createDataLocation(source)
  await mkdir(path.join(source, 'nested'))
  for (const directory of [root, path.join(source, 'nested')])
    await assert.rejects(location.validate(directory), /storageNested/)
  await assert.rejects(location.validate('relative'), /storageDestination/)
  await writeFile(path.join(destination, 'foreign'), 'keep')
  await assert.rejects(location.move(destination), /storageOccupied/)
  await rm(path.join(destination, 'foreign'))
  if (process.platform !== 'win32' && process.getuid?.() !== 0) {
    await chmod(destination, 0o500)
    await assert.rejects(location.move(destination), /storageReadonly/)
    await chmod(destination, 0o700)
    assert.equal(location.state().cleanupPending, false)
  }
  await writeFile(path.join(root, 'foreign'), 'keep')
  await symlink(path.join(root, 'foreign'), path.join(source, 'document.json'))
  await assert.rejects(location.move(destination), /storageSource/)
  assert.deepEqual(await readdir(destination), [])
  assert.equal(await readFile(path.join(root, 'foreign'), 'utf8'), 'keep')
})

test('startup recovers interrupted transfers on either side of activation without deleting unrelated files', async (context) => {
  for (const [committed, legacy] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    const { source, destination, bootstrap, identity } = await fixture(context, committed, legacy)
    const original = await readFile(bootstrap)
    const backup = `data-location.json.backup-${digest(original)}`
    await writeFile(path.join(destination, 'foreign'), 'keep')
    const location = await createDataLocation(source)
    assert.equal(location.state().directory, committed ? destination : source)
    assert.equal(location.state().cleanupPending, false)
    assert.deepEqual(
      JSON.parse(await readFile(path.join(location.directory(), 'document.json'), 'utf8')),
      { version: 1 },
    )
    assert.deepEqual(
      (await readdir(committed ? source : destination)).sort(),
      committed ? ['data-location.json', ...(legacy ? [backup] : [])] : ['foreign'],
    )
    assert.equal(await readFile(path.join(destination, 'foreign'), 'utf8'), 'keep')
    assert.deepEqual(JSON.parse(await readFile(bootstrap, 'utf8')), {
      version: 1,
      directory: location.state().directory,
      identity,
    })
    if (legacy) assert.deepEqual(await readFile(path.join(source, backup)), original)
  }
})

test('cleanup preserves changed, partial, missing or unowned data and retries after the conflict is resolved', async (context) => {
  for (const failure of ['source', 'destination', 'missing', 'partial', 'unowned']) {
    const committed = failure !== 'partial' && failure !== 'unowned'
    const { source, destination, bootstrap, files } = await fixture(context, committed)
    const target = path.join(failure === 'source' ? source : destination, 'document.json')
    if (failure === 'missing') await rm(target)
    else await writeFile(target, 'changed')
    if (failure === 'unowned') {
      const config = JSON.parse(await readFile(bootstrap, 'utf8'))
      config.transfer.files.shift()
      await writeFile(bootstrap, JSON.stringify(config))
    }
    const location = await createDataLocation(source)
    if (failure === 'unowned') {
      assert.equal(location.state().cleanupPending, false)
      assert.equal(await readFile(target, 'utf8'), 'changed')
      continue
    }
    assert.equal(location.state().cleanupPending, true)
    await assert.rejects(location.cleanup())
    await assert.rejects(location.move(source), /storageCleanup/)
    assert.equal(
      await readFile(path.join(source, 'document.json'), 'utf8'),
      failure === 'source' ? 'changed' : files[0].data,
    )
    await writeFile(target, files[0].data)
    await location.cleanup()
    assert.equal(location.state().cleanupPending, false)
  }
})

test('missing or replaced data folders and corrupt configuration never fall back to empty data', async (context) => {
  const { root, source, destination, bootstrap } = await fixture(context)
  const location = await createDataLocation(source)
  const storage = createFileStorage(location.directory)
  await storage.write('document', { version: 1 })
  await location.move(destination)
  await rename(destination, path.join(root, 'disconnected'))
  await assert.rejects(createDataLocation(source), /storageUnavailable/)
  await assert.rejects(storage.write('document', { version: 2 }))
  await mkdir(destination)
  await assert.rejects(createDataLocation(source), /storageUnavailable/)
  await assert.rejects(storage.write('document', { version: 2 }))
  assert.deepEqual(await readdir(destination), [])
  await writeFile(bootstrap, 'broken config')
  await assert.rejects(createDataLocation(source), /storageConfig/)
})

test('legacy configurations are read unchanged and upgrade only after their exact original is preserved', async (context) => {
  const { root, source, destination, bootstrap, identity } = await fixture(context)
  const legacy = JSON.stringify({ directory: source, identity })
  await writeFile(path.join(source, '.nesso-data-id'), identity)
  await writeFile(bootstrap, legacy)
  const location = await createDataLocation(source)
  assert.equal(await readFile(bootstrap, 'utf8'), legacy)
  const backup = `${bootstrap}.backup-${digest(legacy)}`
  await mkdir(backup)
  await assert.rejects(location.move(destination))
  assert.equal(await readFile(bootstrap, 'utf8'), legacy)
  assert.deepEqual(await readdir(destination), [])
  await rm(backup, { recursive: true })
  await location.move(destination)
  assert.equal(await readFile(backup, 'utf8'), legacy)
  assert.deepEqual(JSON.parse(await readFile(bootstrap, 'utf8')), {
    version: 1,
    directory: destination,
    identity,
  })
  const offline = JSON.stringify({ directory: destination, identity })
  await writeFile(bootstrap, offline)
  await rename(destination, path.join(root, 'offline'))
  await assert.rejects(createDataLocation(source), /storageUnavailable/)
  assert.equal(await readFile(bootstrap, 'utf8'), offline)
})

test('unsupported versions and invalid journals are rejected before cleanup or writes', async (context) => {
  const { source, destination, bootstrap, identity, files } = await fixture(context, true)
  const transfer = { source, destination, files: files.map(({ name, hash }) => ({ name, hash })) }
  for (const config of [
    { version: 2, directory: destination, identity, transfer },
    {
      directory: destination,
      identity,
      transfer: { ...transfer, files: [{ ...transfer.files[0], hash: 'x' }] },
    },
    { directory: destination, identity, transfer, extra: true },
  ]) {
    await writeFile(bootstrap, JSON.stringify(config))
    await assert.rejects(createDataLocation(source), /storageConfig/)
    assert.equal(await readFile(bootstrap, 'utf8'), JSON.stringify(config))
    for (const directory of [source, destination])
      for (const { name, data } of files)
        assert.equal(await readFile(path.join(directory, name), 'utf8'), data)
  }
  assert.deepEqual((await readdir(source)).sort(), [
    '.nesso-data-id',
    'data-location.json',
    'document.json',
  ])
})
