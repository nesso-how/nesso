import assert from 'node:assert/strict'
import test from 'node:test'
import { packageFonts, preparePluginPackage, verifyPluginPackage } from '../src/package.ts'
import themeFixture from './theme.json' with { type: 'json' }

const manifest = { name: 'nesso-plugin-test', version: '1.0.0', nesso: { apiVersion: 1, kind: 'actions', entry: 'index.js', writes: ['concept.label'], capabilities: [] }, i18n: { metadata: { name: { en: 'Test' }, description: { en: 'Test' }, documentation: { en: 'Test' } }, action: { en: 'Test action' } } }
const code = 'export const create=()=>[]'
const files = [{ path: 'index.js', bytes: new TextEncoder().encode(code) }]

test('package identity binds normalized metadata, declarations, paths and exact entry bytes without executing code', async () => {
  const prepared = await preparePluginPackage({ manifest: { ...manifest, scripts: { install: 'must not run' }, dependencies: { anything: '*' } }, files })
  assert.match(prepared.contentId, /^[a-f0-9]{64}$/)
  assert.deepEqual(await verifyPluginPackage(prepared), prepared)
  if (prepared.nesso.kind !== 'actions') assert.fail('Expected actions')
  assert.equal((await preparePluginPackage({ manifest: { i18n: manifest.i18n, nesso: manifest.nesso, version: '1.0.0', name: manifest.name }, files })).contentId, prepared.contentId)
  assert.equal((await preparePluginPackage({ manifest: { ...manifest, i18n: { ...manifest.i18n, action: { ...manifest.i18n.action, it: undefined } } }, files })).contentId, prepared.contentId)
  for (const changed of [
    { ...prepared, code: `${code}\n` }, { ...prepared, version: '1.0.1' },
    { ...prepared, nesso: { ...prepared.nesso, capabilities: ['files.open'] as const } },
    { ...prepared, nesso: { ...prepared.nesso, capabilities: ['notifications.notify'] as const } },
    { ...prepared, nesso: { ...prepared.nesso, writes: ['concept.add'] as const } },
    { ...prepared, i18n: { ...manifest.i18n, metadata: { ...manifest.i18n.metadata, name: { en: 'Changed' } } } },
    { ...prepared, i18n: { ...manifest.i18n, action: { en: 'Changed action' } } },
  ]) await assert.rejects(verifyPluginPackage(changed), { code: 'denied' })
  assert.deepEqual(prepared.i18n, manifest.i18n)
})

test('action packages reject unsafe paths, extra assets, unsupported authority, non-UTF-8 code and inexact identities', async () => {
  for (const entry of ['../index.js', '/index.js', 'a//index.js', 'a\\index.js', 'index.js?q', 'index.ts', 'a/%2e/index.js']) await assert.rejects(preparePluginPackage({ manifest: { ...manifest, nesso: { ...manifest.nesso, entry } }, files }))
  for (const version of ['^1.0.0', '1.0.0-01', 'latest', 'v1.0.0', '=1.0.0', ' 1.0.0', '1.0.0 ', '1.0', '9007199254740992.0.0']) await assert.rejects(preparePluginPackage({ manifest: { ...manifest, version }, files }))
  for (const name of ['../private', '@nesso', 'node_modules', 'favicon.ico', 'http', 'Uppercase', '-private', '@nesso/../private', 'plugin?query']) await assert.rejects(preparePluginPackage({ manifest: { ...manifest, name }, files }))
  for (const version of ['1.0.0', '1.0.0-alpha.1', '1.0.0+build.1', '1.0.0-alpha.1+build.1']) assert.equal((await preparePluginPackage({ manifest: { ...manifest, name: '@nesso/test', version }, files })).version, version)
  await assert.rejects(preparePluginPackage({ manifest: { ...manifest, nesso: { ...manifest.nesso, writes: ['document.reset'] } }, files }))
  for (const entries of [[], [...files, ...files], [{ path: 'different.js', bytes: files[0].bytes }], [{ path: 'index.js', bytes: new Uint8Array([0xff]) }]]) await assert.rejects(preparePluginPackage({ manifest, files: entries }))
})

test('definition packages bind local font bytes and sorted paths to approval without executing definitions', async () => {
  const font = { path: 'fonts/sans.woff2', bytes: new TextEncoder().encode('wOF2font') }
  const vocab = { id: 'test-vocab', relationTypes: [{ id: 'urn:nesso:test', label: 'Test' }], defaultTypeId: 'urn:nesso:test' }
  for (const kind of ['vocab', 'theme'] as const) {
    const source = { ...manifest, nesso: { ...manifest.nesso, kind, entry: 'definition.json', writes: [], capabilities: [] } }
    const definition = kind === 'theme' ? { ...themeFixture, id: 'test-theme' } : vocab
    const entry = { path: 'definition.json', bytes: new TextEncoder().encode(JSON.stringify(definition)) }
    const prepared = await preparePluginPackage({ manifest: source, files: kind === 'theme' ? [entry, font] : [entry] })
    assert.deepEqual(await verifyPluginPackage(prepared), prepared)
    await assert.rejects(preparePluginPackage({ manifest: source, files: [{ path: 'definition.json', bytes: new TextEncoder().encode('{invalid') }] }))
    await assert.rejects(preparePluginPackage({ manifest: source, files: [{ path: 'definition.json', bytes: new TextEncoder().encode(JSON.stringify({ ...definition, id: 42 })) }] }))
    if (kind === 'vocab') {
      await assert.rejects(preparePluginPackage({ manifest: source, files: [entry, font] }))
      continue
    }
    assert.deepEqual(packageFonts(prepared).get(font.path), font.bytes)
    assert.equal((await preparePluginPackage({ manifest: source, files: [font, entry] })).contentId, prepared.contentId)
    await assert.rejects(verifyPluginPackage({ ...prepared, fonts: [{ ...prepared.fonts[0], data: btoa('wOF2changed') }] }), { code: 'denied' })
    await assert.rejects(verifyPluginPackage({ ...prepared, fonts: [...prepared.fonts, ...prepared.fonts] }))
    for (const path of ['../font.woff2', 'fonts/a.woff', 'fonts/a.woff2?x', 'fonts//a.woff2']) await assert.rejects(preparePluginPackage({ manifest: source, files: [entry, { ...font, path }] }))
    for (const bytes of [new TextEncoder().encode('invalid'), new Uint8Array(4 * 1024 * 1024 + 1)]) await assert.rejects(preparePluginPackage({ manifest: source, files: [entry, { ...font, bytes }] }))
  }
})
