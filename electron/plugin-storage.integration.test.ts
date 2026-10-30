import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  readdir,
  symlink,
  truncate,
} from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { packageLimits, preparePluginPackage } from '../packages/plugin/src/package.ts'
import { createPluginStorage } from './plugin-storage.ts'
import themeFixture from '../packages/plugin/test/theme.json' with { type: 'json' }

test('installed actions restore verified bytes offline, reject conflicts and cancellation, and preserve valid records on failure or removal', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-packages-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const manifest = {
    name: 'nesso-plugin-test',
    version: '1.0.0',
    author: 'Test Author <private@example.test>',
    repository: 'github:example/plugin',
    nesso: { apiVersion: 1, kind: 'actions', entry: 'dist/index.js', writes: [], capabilities: [] },
    i18n: {
      metadata: {
        name: { en: 'Test' },
        description: { en: 'Test' },
        documentation: { en: 'Test' },
      },
    },
  }
  const prepared = await preparePluginPackage({
    manifest,
    files: [
      {
        path: 'dist/index.js',
        bytes: new TextEncoder().encode('throw new Error("Never execute in main")'),
      },
    ],
  })
  await assert.rejects(storage.install(prepared, () => false))
  assert.deepEqual(await storage.list(), { packages: [], issues: [] })
  await storage.check(prepared)
  await storage.install(prepared, () => true)
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [{ ...prepared, enabled: true }],
    issues: [],
  })
  const [recordName] = await readdir(directory)
  const file = path.join(directory, recordName)
  const previous = await readFile(file, 'utf8')
  await assert.rejects(storage.check(prepared))
  await assert.rejects(storage.install(prepared, () => true))
  await assert.rejects(storage.install({ ...prepared, code: 'changed' }, () => true))
  assert.equal(await readFile(file, 'utf8'), previous)
  const other = await preparePluginPackage({
    manifest: { ...manifest, name: 'nesso-plugin-other' },
    files: [
      { path: 'dist/index.js', bytes: new TextEncoder().encode('export const create=()=>[]') },
    ],
  })
  let checks = 0
  await assert.rejects(storage.install(other, () => ++checks === 1))
  assert.deepEqual(await readdir(directory), [recordName])
  await writeFile(file, previous.replace('Never execute in main', 'Tampered entry bytes'))
  assert.deepEqual(await storage.list(), {
    packages: [],
    issues: [{ path: recordName, message: 'Could not read installed package record' }],
  })
  await assert.rejects(storage.install(other, () => true))
  await writeFile(file, previous)
  await storage.install(other, () => true)
  await storage.remove(prepared.contentId)
  assert.deepEqual(await storage.list(), { packages: [{ ...other, enabled: true }], issues: [] })
})

test('manual updates atomically replace one exact package, preserve disabled state, and leave the previous record intact on failure', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-package-updates-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const manifest = {
    name: 'nesso-plugin-test',
    version: '1.0.0',
    nesso: { apiVersion: 1, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] },
    i18n: {
      metadata: {
        name: { en: 'Test' },
        description: { en: 'Test' },
        documentation: { en: 'Test' },
      },
    },
  }
  const prepare = (version: string) =>
    preparePluginPackage({
      manifest: { ...manifest, version },
      files: [
        { path: 'index.js', bytes: new TextEncoder().encode(`throw new Error('${version}')`) },
      ],
    })
  const previous = await prepare('1.0.0')
  const next = await prepare('1.1.0')
  await storage.install(previous, () => true)
  await storage.setEnabled(previous.contentId, false)
  const disabled = { ...previous, enabled: false }
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [disabled],
    issues: [],
  })
  const [recordName] = await readdir(directory)
  const file = path.join(directory, recordName)
  const bytes = await readFile(file, 'utf8')
  await writeFile(file, bytes.replace('"enabled":false', '"enabled":"false"'))
  assert.deepEqual(await storage.list(), {
    packages: [],
    issues: [{ path: recordName, message: 'Could not read installed package record' }],
  })
  await writeFile(file, bytes)
  await assert.rejects(storage.install(next, () => true))
  await assert.rejects(storage.install(next, () => true, next.contentId))
  const unrelated = await preparePluginPackage({
    manifest: { ...manifest, name: 'nesso-plugin-other' },
    files: [{ path: 'index.js', bytes: new TextEncoder().encode('export const create=()=>[]') }],
  })
  await assert.rejects(storage.install(unrelated, () => true, previous.contentId))
  await assert.rejects(
    storage.install({ ...next, code: 'tampered' }, () => true, previous.contentId),
  )
  await assert.rejects(
    storage.install({ ...next, npmIntegrity: 'invalid' }, () => true, previous.contentId),
  )
  await assert.rejects(storage.install(previous, () => true, previous.contentId))
  let checks = 0
  await assert.rejects(storage.install(next, () => ++checks === 1, previous.contentId))
  assert.equal(await readFile(file, 'utf8'), bytes)
  assert.deepEqual(await readdir(directory), [recordName])
  assert.equal((await storage.check(next, previous.contentId)).enabled, false)
  const acquired = { ...next, npmIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}` }
  await storage.install(acquired, () => true, previous.contentId)
  assert.deepEqual(await readdir(directory), [recordName])
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [{ ...acquired, enabled: false }],
    issues: [],
  })
  await storage.setEnabled(next.contentId, true)
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [{ ...acquired, enabled: true }],
    issues: [],
  })
  await assert.rejects(storage.setEnabled(previous.contentId, true))
  await assert.rejects(storage.remove(previous.contentId))
  await assert.rejects(storage.install(previous, () => true, previous.contentId))
  const replies = await Promise.allSettled([
    storage.install(previous, () => true, next.contentId),
    storage.install(previous, () => true, next.contentId),
  ])
  assert.deepEqual(
    replies.map(({ status }) => status),
    ['fulfilled', 'rejected'],
  )
  await storage.setEnabled(previous.contentId, true)
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [{ ...previous, enabled: true }],
    issues: [],
  })
})

test('definition records restore offline with exact font bytes and reject tampered updates without replacing providers', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-definition-records-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  for (const kind of ['vocab', 'theme']) {
    const manifest = {
      name: `nesso-test-${kind}`,
      version: '1.0.0',
      nesso: { apiVersion: 1, kind, entry: 'definition.json', writes: [], capabilities: [] },
      i18n: {
        metadata: {
          name: { en: 'Test' },
          description: { en: 'Test' },
          documentation: { en: 'Test' },
        },
      },
    }
    const definition =
      kind === 'theme'
        ? { ...themeFixture, id: 'test-theme' }
        : {
            id: 'test-vocab',
            relationTypes: [{ id: 'urn:nesso:test', label: 'Test' }],
            defaultTypeId: 'urn:nesso:test',
          }
    const files = [
      { path: 'definition.json', bytes: new TextEncoder().encode(JSON.stringify(definition)) },
      ...(kind === 'theme'
        ? [{ path: 'fonts/sans.woff2', bytes: new TextEncoder().encode('wOF2font') }]
        : []),
    ]
    const prepared = await preparePluginPackage({ manifest, files })
    await storage.install(prepared, () => true)
    await storage.setEnabled(prepared.contentId, false)
    const restored = (await createPluginStorage(directory).list()).packages.find(
      ({ name }) => name === prepared.name,
    )
    assert.deepEqual(restored, { ...prepared, enabled: false })
    if (kind === 'theme')
      await assert.rejects(
        storage.install(
          {
            ...prepared,
            version: '1.1.0',
            fonts: [{ path: 'fonts/sans.woff2', data: btoa('wOF2tampered') }],
          },
          () => true,
          prepared.contentId,
        ),
      )
    assert.deepEqual(
      (await storage.list()).packages.find(({ name }) => name === prepared.name),
      restored,
    )
  }
})

test('unreadable records are isolated without losing valid packages or permitting storage mutations', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-corrupt-packages-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const prepare = (name: string, version = '1.0.0') =>
    preparePluginPackage({
      manifest: {
        name,
        version,
        nesso: { apiVersion: 1, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] },
        i18n: {
          metadata: {
            name: { en: name },
            description: { en: 'Test' },
            documentation: { en: 'Test' },
          },
        },
      },
      files: [{ path: 'index.js', bytes: new TextEncoder().encode('export const create=()=>[]') }],
    })
  const valid = await storage.install(await prepare('nesso-valid'), () => true)
  const disabled = await storage.install(await prepare('nesso-disabled'), () => true)
  const bad = await storage.install(await prepare('nesso-corrupt'), () => true)
  await storage.setEnabled(disabled.contentId, false)
  const next = await prepare(valid.name, '1.1.0')
  const fresh = await prepare('nesso-fresh')
  const recordName = `${createHash('sha256').update(bad.name).digest('hex')}.json`
  const file = path.join(directory, recordName)
  const original = await readFile(file)
  const document = path.join(directory, 'document.bin')
  await writeFile(document, 'Unrelated document data')
  const records = new Map(
    await Promise.all(
      (await readdir(directory))
        .filter((name) => name !== recordName)
        .map(async (name) => [name, await readFile(path.join(directory, name))] as const),
    ),
  )
  for (const bytes of [
    Buffer.from('{'),
    Buffer.from([0xff]),
    Buffer.from(JSON.stringify({ ...bad, enabled: 'true' })),
    Buffer.from(JSON.stringify({ ...bad, npmIntegrity: 'invalid' })),
    Buffer.from(JSON.stringify({ ...bad, code: 'tampered' })),
    Buffer.from(JSON.stringify(valid)),
  ]) {
    await writeFile(file, bytes)
    const listing = await createPluginStorage(directory).list()
    assert.deepEqual(
      listing.packages.sort((a, b) => a.name.localeCompare(b.name)),
      [{ ...disabled, enabled: false }, valid],
    )
    assert.deepEqual(listing.issues, [
      { path: recordName, message: 'Could not read installed package record' },
    ])
    await assert.rejects(storage.check(fresh))
    await assert.rejects(storage.install(fresh, () => true))
    await assert.rejects(storage.install(next, () => true, valid.contentId))
    await assert.rejects(storage.install(bad, () => true))
    await assert.rejects(storage.setEnabled(valid.contentId, false))
    await assert.rejects(storage.remove(valid.contentId))
    assert.deepEqual(await readFile(file), bytes)
    for (const [name, content] of records)
      assert.deepEqual(await readFile(path.join(directory, name)), content)
  }
  await writeFile(file, original)
  assert.equal((await storage.list()).issues.length, 0)
  await storage.install(next, () => true, valid.contentId)
})

test('invalid file entries are isolated without following links or altering files', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-invalid-package-files-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const target = path.join(directory, 'target')
  await writeFile(target, 'Do not follow or overwrite')
  const link = `${'a'.repeat(64)}.json`
  const folder = `${'b'.repeat(64)}.json`
  await symlink(target, path.join(directory, link))
  await mkdir(path.join(directory, folder))
  await writeFile(path.join(directory, 'invalid.json'), '{}')
  const storage = createPluginStorage(directory)
  const listing = await storage.list()
  assert.deepEqual(listing.packages, [])
  assert.deepEqual(listing.issues.map(({ path }) => path).sort(), [link, folder, 'invalid.json'])
  assert.equal(await readFile(target, 'utf8'), 'Do not follow or overwrite')
  assert.deepEqual((await readdir(directory)).sort(), [link, folder, 'invalid.json', 'target'])
})

test('corrupt records still consume record, count, and aggregate scan budgets', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-package-budgets-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const files = Array.from({ length: packageLimits.installed + 1 }, (_, index) =>
    path.join(directory, `${index.toString(16).padStart(64, '0')}.json`),
  )
  await writeFile(files[0], '')
  await truncate(files[0], packageLimits.record + 1)
  assert.deepEqual(await storage.list(), {
    packages: [],
    issues: [{ path: path.basename(files[0]), message: 'Could not read installed package record' }],
  })
  await truncate(files[0], packageLimits.record)
  for (const file of files.slice(1, 4)) {
    await writeFile(file, '')
    await truncate(file, packageLimits.record)
  }
  await writeFile(files[4], '{')
  await assert.rejects(storage.list(), /Installed package budget exceeded/)
  for (const file of files) await writeFile(file, '{')
  await assert.rejects(storage.list(), /Installed package budget exceeded/)
})
