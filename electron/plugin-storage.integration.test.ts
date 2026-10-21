import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { preparePluginPackage } from '../packages/plugin/src/package.ts'
import { createPluginStorage } from './plugin-storage.ts'
import themeFixture from '../packages/plugin/test/theme.json' with { type: 'json' }

test('installed actions restore verified bytes offline, reject conflicts and cancellation, and preserve valid records on failure or removal', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-packages-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const manifest = { name: 'nesso-plugin-test', version: '1.0.0', nesso: { apiVersion: 1, kind: 'actions', entry: 'dist/index.js', styles: [], writes: [], capabilities: [] }, i18n: { metadata: { name: { en: 'Test' }, description: { en: 'Test' }, documentation: { en: 'Test' } } } }
  const prepared = await preparePluginPackage({ manifest, files: [{ path: 'dist/index.js', bytes: new TextEncoder().encode('throw new Error("Never execute in main")') }] })
  await assert.rejects(storage.install(prepared, () => false))
  assert.deepEqual(await storage.list(), [])
  await storage.check(prepared)
  await storage.install(prepared, () => true)
  assert.deepEqual(await createPluginStorage(directory).list(), [{ ...prepared, enabled: true }])
  const [recordName] = await readdir(directory)
  const file = path.join(directory, recordName)
  const previous = await readFile(file, 'utf8')
  await assert.rejects(storage.check(prepared))
  await assert.rejects(storage.install(prepared, () => true))
  await assert.rejects(storage.install({ ...prepared, code: 'changed' }, () => true))
  assert.equal(await readFile(file, 'utf8'), previous)
  const other = await preparePluginPackage({ manifest: { ...manifest, name: 'nesso-plugin-other' }, files: [{ path: 'dist/index.js', bytes: new TextEncoder().encode('export const create=()=>[]') }] })
  let checks = 0
  await assert.rejects(storage.install(other, () => ++checks === 1))
  assert.deepEqual(await readdir(directory), [recordName])
  await writeFile(file, previous.replace('Never execute in main', 'Tampered entry bytes'))
  await assert.rejects(storage.list(), { code: 'denied' })
  await assert.rejects(storage.install(other, () => true))
  await writeFile(file, previous)
  await storage.install(other, () => true)
  await storage.remove(prepared.contentId)
  assert.deepEqual(await storage.list(), [{ ...other, enabled: true }])
})

test('manual updates atomically replace one exact package, preserve disabled state, and leave the previous record intact on failure', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-package-updates-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  const manifest = { name: 'nesso-plugin-test', version: '1.0.0', nesso: { apiVersion: 1, kind: 'actions', entry: 'index.js', styles: [], writes: [], capabilities: [] }, i18n: { metadata: { name: { en: 'Test' }, description: { en: 'Test' }, documentation: { en: 'Test' } } } }
  const prepare = (version: string) => preparePluginPackage({ manifest: { ...manifest, version }, files: [{ path: 'index.js', bytes: new TextEncoder().encode(`throw new Error('${version}')`) }] })
  const previous = await prepare('1.0.0')
  const next = await prepare('1.1.0')
  await storage.install(previous, () => true)
  await storage.setEnabled(previous.contentId, false)
  const disabled = { ...previous, enabled: false }
  assert.deepEqual(await createPluginStorage(directory).list(), [disabled])
  const [recordName] = await readdir(directory)
  const file = path.join(directory, recordName)
  const bytes = await readFile(file, 'utf8')
  await writeFile(file, bytes.replace('"enabled":false', '"enabled":"false"'))
  await assert.rejects(storage.list())
  await writeFile(file, bytes)
  await assert.rejects(storage.install(next, () => true))
  await assert.rejects(storage.install(next, () => true, next.contentId))
  const unrelated = await preparePluginPackage({ manifest: { ...manifest, name: 'nesso-plugin-other' }, files: [{ path: 'index.js', bytes: new TextEncoder().encode('export const create=()=>[]') }] })
  await assert.rejects(storage.install(unrelated, () => true, previous.contentId))
  await assert.rejects(storage.install({ ...next, code: 'tampered' }, () => true, previous.contentId))
  await assert.rejects(storage.install({ ...next, npmIntegrity: 'invalid' }, () => true, previous.contentId))
  await assert.rejects(storage.install(previous, () => true, previous.contentId))
  let checks = 0
  await assert.rejects(storage.install(next, () => ++checks === 1, previous.contentId))
  assert.equal(await readFile(file, 'utf8'), bytes)
  assert.deepEqual(await readdir(directory), [recordName])
  assert.equal((await storage.check(next, previous.contentId)).enabled, false)
  const acquired = { ...next, npmIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}` }
  await storage.install(acquired, () => true, previous.contentId)
  assert.deepEqual(await readdir(directory), [recordName])
  assert.deepEqual(await createPluginStorage(directory).list(), [{ ...acquired, enabled: false }])
  await storage.setEnabled(next.contentId, true)
  assert.deepEqual(await createPluginStorage(directory).list(), [{ ...acquired, enabled: true }])
  await assert.rejects(storage.setEnabled(previous.contentId, true))
  await assert.rejects(storage.remove(previous.contentId))
  await assert.rejects(storage.install(previous, () => true, previous.contentId))
  const replies = await Promise.allSettled([storage.install(previous, () => true, next.contentId), storage.install(previous, () => true, next.contentId)])
  assert.deepEqual(replies.map(({ status }) => status), ['fulfilled', 'rejected'])
  await storage.setEnabled(previous.contentId, true)
  assert.deepEqual(await createPluginStorage(directory).list(), [{ ...previous, enabled: true }])
})

test('definition records restore offline with exact font bytes and reject tampered updates without replacing providers', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nesso-definition-records-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const storage = createPluginStorage(directory)
  for (const kind of ['vocab', 'theme']) {
    const manifest = { name: `nesso-test-${kind}`, version: '1.0.0', nesso: { apiVersion: 1, kind, entry: 'definition.json', styles: [], writes: [], capabilities: [] }, i18n: { metadata: { name: { en: 'Test' }, description: { en: 'Test' }, documentation: { en: 'Test' } } } }
    const definition = kind === 'theme'
      ? { ...themeFixture, id: 'test-theme' }
      : { id: 'test-vocab', relationTypes: [{ id: 'urn:nesso:test', label: 'Test' }], defaultTypeId: 'urn:nesso:test' }
    const files = [{ path: 'definition.json', bytes: new TextEncoder().encode(JSON.stringify(definition)) }, ...(kind === 'theme' ? [{ path: 'fonts/sans.woff2', bytes: new TextEncoder().encode('wOF2font') }] : [])]
    const prepared = await preparePluginPackage({ manifest, files })
    await storage.install(prepared, () => true)
    await storage.setEnabled(prepared.contentId, false)
    const restored = (await createPluginStorage(directory).list()).find(({ name }) => name === prepared.name)
    assert.deepEqual(restored, { ...prepared, enabled: false })
    if (kind === 'theme') await assert.rejects(storage.install({ ...prepared, version: '1.1.0', fonts: [{ path: 'fonts/sans.woff2', data: btoa('wOF2tampered') }] }, () => true, prepared.contentId))
    assert.deepEqual((await storage.list()).find(({ name }) => name === prepared.name), restored)
  }
})
