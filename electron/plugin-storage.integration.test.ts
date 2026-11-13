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
import { packageLimits, preparePluginPackage } from '@nesso-how/plugin/package'
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
    nesso: { apiVersion: 4, kind: 'actions', entry: 'dist/index.js', writes: [], capabilities: [] },
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
  assert.deepEqual(await storage.list(), { packages: [], incompatible: [], issues: [] })
  for (const name of ['@nesso-how/review', '@nesso-how/notes']) {
    const bundled = await preparePluginPackage({
      manifest: { ...manifest, name },
      files: [
        { path: 'dist/index.js', bytes: new TextEncoder().encode('export const create=()=>[]') },
      ],
    })
    await assert.rejects(storage.check(bundled), /reserved/)
  }
  await storage.check(prepared)
  await storage.install(prepared, () => true)
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [{ ...prepared, enabled: true }],
    incompatible: [],
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
    incompatible: [],
    issues: [
      { path: recordName, message: 'Could not read installed package record', name: manifest.name },
    ],
  })
  await assert.rejects(storage.install(other, () => true))
  await writeFile(file, previous)
  await storage.install(other, () => true)
  await storage.remove(prepared.contentId)
  assert.deepEqual(await storage.list(), {
    packages: [{ ...other, enabled: true }],
    incompatible: [],
    issues: [],
  })
})

test('manual updates atomically replace one exact package, preserve disabled state, and leave the previous record intact on failure', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-package-updates-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const manifest = {
    name: 'nesso-plugin-test',
    version: '1.0.0',
    nesso: { apiVersion: 4, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] },
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
    incompatible: [],
    issues: [],
  })
  const [recordName] = await readdir(directory)
  const file = path.join(directory, recordName)
  const bytes = await readFile(file, 'utf8')
  await writeFile(file, bytes.replace('"enabled":false', '"enabled":"false"'))
  assert.deepEqual(await storage.list(), {
    packages: [],
    incompatible: [],
    issues: [
      { path: recordName, message: 'Could not read installed package record', name: manifest.name },
    ],
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
  const npmIntegrity = `sha512-${Buffer.alloc(64).toString('base64')}`
  await assert.rejects(
    storage.install({ ...next, npmIntegrity }, () => true, previous.contentId),
    /provenance/,
  )
  assert.equal(await readFile(file, 'utf8'), bytes)
  await storage.install(next, () => true, previous.contentId)
  assert.deepEqual(await readdir(directory), [recordName])
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [{ ...next, enabled: false }],
    incompatible: [],
    issues: [],
  })
  await storage.setEnabled(next.contentId, true)
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [{ ...next, enabled: true }],
    incompatible: [],
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
    incompatible: [],
    issues: [],
  })
  const published = { ...unrelated, npmIntegrity }
  await storage.install(published, () => true)
  const local = await preparePluginPackage({
    manifest: { ...manifest, name: 'nesso-plugin-other', version: '1.1.0' },
    files: [{ path: 'index.js', bytes: new TextEncoder().encode('export const create=()=>[1]') }],
  })
  await assert.rejects(
    storage.install(local, () => true, published.contentId),
    /provenance/,
  )
  assert.deepEqual(
    new Set((await createPluginStorage(directory).list()).packages),
    new Set([
      { ...previous, enabled: true },
      { ...published, enabled: true },
    ]),
  )
})

test('definition records restore offline and reject tampered updates without replacing providers', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-definition-records-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  for (const kind of ['vocab', 'theme']) {
    const manifest = {
      name: `nesso-test-${kind}`,
      version: '1.0.0',
      nesso: { apiVersion: 4, kind, entry: 'definition.json', writes: [], capabilities: [] },
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
            code: `${prepared.code}\n`,
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
        nesso: { apiVersion: 4, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] },
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
  for (const [bytes, name] of [
    [Buffer.from('{')],
    [Buffer.from([0xff])],
    [Buffer.from(JSON.stringify({ ...bad, enabled: 'true' })), bad.name],
    [Buffer.from(JSON.stringify({ ...bad, npmIntegrity: 'invalid' })), bad.name],
    [Buffer.from(JSON.stringify({ ...bad, code: 'tampered' })), bad.name],
    [Buffer.from(JSON.stringify(valid))],
  ] as const) {
    await writeFile(file, bytes)
    const listing = await createPluginStorage(directory).list()
    assert.deepEqual(
      listing.packages.sort((a, b) => a.name.localeCompare(b.name)),
      [{ ...disabled, enabled: false }, valid],
    )
    assert.deepEqual(listing.issues, [
      {
        path: recordName,
        message: 'Could not read installed package record',
        ...(name ? { name } : {}),
      },
    ])
    await assert.rejects(storage.check(fresh))
    await assert.rejects(storage.install(fresh, () => true))
    await assert.rejects(storage.install(next, () => true, valid.contentId))
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

test('a verified package replaces its own unreadable record and preserves neighboring packages', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-stale-packages-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const prepare = (name: string, version = '1.0.0') =>
    preparePluginPackage({
      manifest: {
        name,
        version,
        nesso: { apiVersion: 4, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] },
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
  const stale = await prepare('nesso-stale')
  const neighbor = await storage.install(await prepare('nesso-neighbor'), () => true)
  await storage.install(stale, () => true)
  const recordName = `${createHash('sha256').update(stale.name).digest('hex')}.json`
  const file = path.join(directory, recordName)
  const stored = await readFile(file, 'utf8')
  await writeFile(file, stored.replace('"enabled":true', '"enabled":"true"'))
  assert.deepEqual(await storage.list(), {
    packages: [neighbor],
    incompatible: [],
    issues: [
      { path: recordName, message: 'Could not read installed package record', name: stale.name },
    ],
  })
  await assert.rejects(
    storage.install(await prepare('nesso-fresh'), () => true),
    /Unreadable installed package records block changes: nesso-stale\./,
  )
  const healed = await storage.install(await prepare('nesso-stale', '1.1.0'), () => true)
  assert.equal(healed.version, '1.1.0')
  const listing = await storage.list()
  assert.deepEqual(
    listing.packages.sort((a, b) => a.name.localeCompare(b.name)),
    [healed, neighbor].sort((a, b) => a.name.localeCompare(b.name)),
  )
  assert.deepEqual(listing.issues, [])
})

test('records for another plugin API are retained without loading, blocking changes, or escaping budgets', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-incompatible-packages-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const npmIntegrity = `sha512-${Buffer.alloc(64).toString('base64')}`
  const prepare = (name: string, version = '1.0.0') =>
    preparePluginPackage({
      manifest: {
        name,
        version,
        nesso: { apiVersion: 4, kind: 'actions', entry: 'index.js', writes: [], capabilities: [] },
        i18n: {
          metadata: {
            name: { en: name },
            description: { en: 'Test' },
            documentation: { en: 'Test' },
          },
        },
      },
      files: [{ path: 'index.js', bytes: new TextEncoder().encode(`export const v='${version}'`) }],
    })
  const downgrade = async (name: string) => {
    const file = path.join(directory, `${createHash('sha256').update(name).digest('hex')}.json`)
    await writeFile(
      file,
      (await readFile(file, 'utf8')).replace('"apiVersion":4', '"apiVersion":3'),
    )
  }
  const legacy = await storage.install(
    { ...(await prepare('nesso-legacy')), npmIntegrity },
    () => true,
  )
  await storage.setEnabled(legacy.contentId, false)
  await downgrade(legacy.name)
  const retained = {
    name: legacy.name,
    version: legacy.version,
    author: undefined,
    repository: undefined,
    i18n: legacy.i18n,
    contentId: legacy.contentId,
    enabled: false,
    kind: 'actions',
    apiVersion: 3,
    npmIntegrity,
  }
  assert.deepEqual(await createPluginStorage(directory).list(), {
    packages: [],
    incompatible: [retained],
    issues: [],
  })
  const unrelated = await storage.install(await prepare('nesso-unrelated'), () => true)
  const next = { ...(await prepare(legacy.name, '1.1.0')), npmIntegrity }
  await assert.rejects(
    storage.install(next, () => true),
    /already installed/,
  )
  await assert.rejects(storage.setEnabled(legacy.contentId, true))
  const updated = await storage.install(next, () => true, legacy.contentId)
  const listing = await createPluginStorage(directory).list()
  assert.deepEqual(
    listing.packages.sort((a, b) => a.name.localeCompare(b.name)),
    [updated, unrelated].sort((a, b) => a.name.localeCompare(b.name)),
  )
  assert.deepEqual([listing.incompatible, listing.issues], [[], []])
  await downgrade(unrelated.name)
  await storage.remove(unrelated.contentId)
  assert.deepEqual(await storage.list(), { packages: [updated], incompatible: [], issues: [] })
  for (let index = 1; index < packageLimits.installed; index++)
    await storage.install(await prepare(`nesso-filler-${index}`), () => true)
  await downgrade('nesso-filler-1')
  await assert.rejects(
    storage.install(await prepare('nesso-overflow'), () => true),
    /Installed package budget exceeded/,
  )
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
    incompatible: [],
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
