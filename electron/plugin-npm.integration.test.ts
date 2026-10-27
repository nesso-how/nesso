import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { createServer, type RequestListener } from 'node:http'
import { Agent } from 'node:https'
import { connect } from 'node:net'
import { once } from 'node:events'
import { createHash } from 'node:crypto'
import { createGzip, gunzipSync, gzipSync } from 'node:zlib'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import registryFetch from 'npm-registry-fetch'
import { Header, type HeaderData } from 'tar'
import { acquireNpmPlugin, latestNpmPlugin, searchNpmPlugins } from './plugin-npm.ts'
import { preparePluginPackage } from '../packages/plugin/src/package.ts'
import themeFixture from '../packages/plugin/test/theme.json' with { type: 'json' }

const manifest = { name: '@nesso/test', version: '1.0.0-alpha.1+build.1', author: { name: 'Test Author', email: 'private@example.test' }, repository: { type: 'git', url: 'git+https://github.com/example/plugin.git' }, scripts: { install: 'never run' }, dependencies: { anything: '*' }, nesso: { apiVersion: 1, kind: 'actions', entry: 'dist/index.js', writes: [], capabilities: [] }, i18n: { metadata: { name: { en: 'Test' }, description: { en: 'Test' }, documentation: { en: 'Test' } } } }
const code = 'throw new Error("Never run in the host")'
const spec = { name: manifest.name, version: manifest.version }
const url = 'https://registry.npmjs.org/test/-/test.tgz'
type Entry = HeaderData & { data?: string | Buffer }
const archive = (entries: Entry[]) => gzipSync(Buffer.concat([...entries.flatMap(({ data = '', ...fields }) => {
  const bytes = Buffer.from(data)
  const header = new Header({ type: 'File', size: bytes.length, ...fields })
  header.encode()
  return [header.block!, bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]
}), Buffer.alloc(1024)]))
const entries: Entry[] = [{ path: 'package/dist/index.js', data: code }, { path: 'package/package.json', data: JSON.stringify(manifest) }, { path: 'package/README.md', data: 'Not installed or executed' }]
const metadata = (bytes: Buffer) => ({ ...manifest, dist: { tarball: url, integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` } })

async function registry(t: TestContext, listener: RequestListener) {
  const server = createServer(listener)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  t.after(() => { server.closeAllConnections(); server.close() })
  const request: NonNullable<Parameters<typeof acquireNpmPlugin>[2]> = (url, options) => {
    assert.ok(options.agent instanceof Agent)
    options.agent.createConnection = () => connect(address.port, '127.0.0.1')
    return registryFetch(url, options)
  }
  return request
}

test('latest metadata admits all supported kinds and rejects deprecated versions, prereleases, mismatched identities and APIs', async (t) => {
  let document = { ...manifest, version: '1.2.0' }
  let requests = 0
  const request = await registry(t, (_req, res) => { requests++; res.end(JSON.stringify(document)) })
  for (const name of [null, 42, '', 'has spaces', 'a'.repeat(215), 'https://example.com/plugin']) {
    await assert.rejects(latestNpmPlugin(name, new AbortController().signal, request), { code: 'invalid-input' })
  }
  assert.equal(requests, 0)
  for (const kind of ['actions', 'theme', 'vocab']) {
    document = { ...document, nesso: { ...manifest.nesso, kind, entry: kind === 'actions' ? 'index.js' : 'definition.json' } }
    const plugin = await latestNpmPlugin(manifest.name, new AbortController().signal, request)
    assert.equal(plugin.name, manifest.name)
    assert.equal(plugin.version, '1.2.0')
    assert.equal(plugin.nesso.kind, kind)
    assert.equal(plugin.author, 'Test Author')
    assert.equal(plugin.repository, 'https://github.com/example/plugin')
  }
  for (const invalid of [{ ...manifest, version: '1.2.0', deprecated: 'Temporary test package' }, { ...manifest, version: '1.3.0-beta.1' }, { ...manifest, name: 'other-package' }, { ...manifest, nesso: { ...manifest.nesso, apiVersion: 2 } }]) {
    document = invalid
    await assert.rejects(latestNpmPlugin(manifest.name, new AbortController().signal, request))
  }
})

test('discovery enforces the exact keyword, excludes deprecated plugins, filters names rather than descriptions, and preserves pagination', async (t) => {
  const requested: URL[] = []
  let offline = false
  const request = await registry(t, (req, res) => {
    const url = new URL(req.url!, 'https://registry.npmjs.org')
    requested.push(url)
    if (url.pathname === '/-/v1/search') {
      res.end(JSON.stringify({ total: 30, objects: [
        { package: { name: manifest.name, keywords: ['nesso-plugin'] } },
        { package: { name: 'untagged', keywords: ['nesso-plugin-other'] } },
        { package: { name: 'future', keywords: ['nesso-plugin'] } },
        { package: { name: 'deprecated', keywords: ['nesso-plugin'] } },
      ] }))
    } else {
      if (offline) { res.writeHead(503).end(); return }
      const name = decodeURIComponent(url.pathname.split('/')[1])
      res.end(JSON.stringify({ ...manifest, name, version: '1.2.0', deprecated: name === 'deprecated' ? 'Temporary test package' : undefined, description: 'Description-only match', i18n: { metadata: { ...manifest.i18n.metadata, name: { en: 'Visible display name' } } }, nesso: { ...manifest.nesso, apiVersion: name === 'future' ? 2 : 1 } }))
    }
  })
  const found = await searchNpmPlugins({ query: 'Visible display', offset: 10 }, new AbortController().signal, request)
  assert.deepEqual(found.packages.map(({ name }) => name), [manifest.name])
  assert.equal(found.next, 14)
  assert.equal(requested[0].searchParams.get('from'), '10')
  assert.equal(requested[0].searchParams.get('text'), 'keywords:nesso-plugin')
  assert.equal(requested.some(({ pathname }) => pathname.includes('untagged')), false)
  const descriptions = await searchNpmPlugins({ query: 'Description-only' }, new AbortController().signal, request)
  assert.equal(descriptions.packages.length, 0)
  offline = true
  await assert.rejects(searchNpmPlugins({ query: '' }, new AbortController().signal, request))
  await assert.rejects(searchNpmPlugins({ query: 'x'.repeat(129) }, new AbortController().signal, request))
  await assert.rejects(searchNpmPlugins({ query: '', offset: -1 }, new AbortController().signal, request))
})

test('npm acquisition streams real registry-fetch responses, verifies SHA-512, and admits only the declared entry without executing scripts', async (t) => {
  const bytes = archive(entries)
  const requested: string[] = []
  const request = await registry(t, (req, res) => {
    assert.equal(req.headers.authorization, undefined)
    assert.equal(req.headers['accept-encoding'], 'identity')
    assert.equal(req.headers['cache-control'], 'no-store')
    requested.push(req.url!)
    if (requested.length === 1) { res.writeHead(302, { location: '/metadata' }); res.end(); return }
    res.end(req.url === '/metadata' ? JSON.stringify(metadata(bytes)) : bytes)
  })
  assert.deepEqual(await acquireNpmPlugin(spec, new AbortController().signal, request), { ...await preparePluginPackage({ manifest, files: [{ path: manifest.nesso.entry, bytes: Buffer.from(code) }] }), npmIntegrity: metadata(bytes).dist.integrity })
  assert.deepEqual(requested, ['/%40nesso%2Ftest/1.0.0-alpha.1%2Bbuild.1', '/metadata', '/test/-/test.tgz'])
})

test('npm definition acquisition shares validation and binds only local WOFF2 theme assets', async (t) => {
  let received = manifest
  let bytes = archive(entries)
  const request = await registry(t, (req, res) => res.end(req.url?.endsWith('.tgz') ? bytes : JSON.stringify({ ...metadata(bytes), ...received })))
  const vocab = { id: 'test-vocab', relationTypes: [{ id: 'urn:nesso:test', label: 'Test' }], defaultTypeId: 'urn:nesso:test' }
  const theme = { ...themeFixture, id: 'test-theme' }
  for (const kind of ['vocab', 'theme']) {
    const definition = kind === 'theme' ? theme : vocab
    received = { ...manifest, nesso: { ...manifest.nesso, kind, entry: 'definition.json' } }
    const definitionFile = { path: 'package/definition.json', data: JSON.stringify(definition) }
    const fonts = kind === 'theme' ? [{ path: 'fonts/sans.woff2', bytes: Buffer.from('wOF2font') }] : []
    bytes = archive([{ path: 'package/package.json', data: JSON.stringify(received) }, definitionFile, ...fonts.map(({ path, bytes }) => ({ path: `package/${path}`, data: bytes }))])
    const prepared = await acquireNpmPlugin(spec, new AbortController().signal, request)
    assert.deepEqual(prepared, { ...await preparePluginPackage({ manifest: received, files: [{ path: 'definition.json', bytes: Buffer.from(definitionFile.data) }, ...fonts] }), npmIntegrity: metadata(bytes).dist.integrity })
  }
  bytes = archive([{ path: 'package/package.json', data: JSON.stringify(received) }, { path: 'package/definition.json', data: JSON.stringify(theme) }, { path: 'package/fonts/bad.woff2', data: 'invalid' }])
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
})

test('npm acquisition rejects inexact identities, untrusted URLs and redirects, malformed metadata, integrity mismatches and cancelled requests', async (t) => {
  const bytes = archive(entries)
  let document: unknown = metadata(bytes)
  let redirect: string | undefined
  let tarball = bytes
  let hold = false
  let waiting: (() => void) | undefined
  let requests = 0
  const request = await registry(t, (req, res) => {
    requests++
    if (hold) { waiting?.(); return }
    if (redirect) { res.writeHead(302, { location: redirect }); res.end(); return }
    res.end(req.url?.endsWith('.tgz') ? tarball : JSON.stringify(document))
  })
  for (const input of [{ ...spec, version: 'latest' }, { ...spec, version: '^1.0.0' }, { ...spec, name: 'https://example.com/test' }]) await assert.rejects(acquireNpmPlugin(input, new AbortController().signal, request))
  assert.equal(requests, 0)
  for (const tarball of ['http://registry.npmjs.org/test.tgz', 'https://evil.example/test.tgz', 'https://user:pass@registry.npmjs.org/test.tgz', 'https://registry.npmjs.org:444/test.tgz']) {
    document = { ...metadata(bytes), dist: { ...metadata(bytes).dist, tarball } }
    await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  }
  for (const location of ['https://evil.example/test', 'http://registry.npmjs.org/test', 'https://user:pass@registry.npmjs.org/test', '/loop']) {
    document = metadata(bytes)
    redirect = location
    const before: number = requests
    await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
    assert.equal(requests - before, location === '/loop' ? 6 : 1)
  }
  redirect = undefined
  for (const bad of [null, { ...metadata(bytes), name: 'another-package' }, { ...metadata(bytes), version: '1.0.1' }, { ...manifest, dist: { tarball: url } }, { ...manifest, dist: { tarball: url, integrity: 'invalid' } }]) {
    document = bad
    await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  }
  document = metadata(bytes)
  tarball = archive([...entries, { path: 'package/tampered', data: 'tampered' }])
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  hold = true
  const controller = new AbortController()
  const started = new Promise<void>((resolve) => { waiting = resolve })
  const pending = acquireNpmPlugin(spec, controller.signal, request)
  await started
  controller.abort()
  await assert.rejects(pending)
})

test('npm archive admission rejects traversal, duplicates, links, special entries, missing or mismatched manifests and oversized files', async (t) => {
  let bytes = archive(entries)
  const request = await registry(t, (req, res) => res.end(req.url?.endsWith('.tgz') ? bytes : JSON.stringify(metadata(bytes))))
  const invalid: Entry[][] = [
    [...entries, { path: 'package/../escape', data: 'bad' }],
    [...entries, { path: '/package/escape', data: 'bad' }],
    [...entries, { path: 'package/a\\b', data: 'bad' }],
    [...entries, { path: 'package/%2e%2e/escape', data: 'bad' }],
    [...entries, { path: 'package/a//b', data: 'bad' }],
    [...entries, { path: 'package/index.js?query', data: 'bad' }],
    [...entries, { path: 'package/index.js#fragment', data: 'bad' }],
    [...entries, { path: 'package/dist/index.js', data: 'duplicate' }],
    [...entries, { path: 'package/link', type: 'SymbolicLink', linkpath: 'dist/index.js' }],
    [...entries, { path: 'package/link', type: 'Link', linkpath: 'package/dist/index.js' }],
    [...entries, { path: 'package/pipe', type: 'FIFO' }],
    [...entries, { path: 'package/device', type: 'CharacterDevice' }],
    [...entries, { path: 'package/large', size: 17 * 1024 * 1024 }],
    [entries[0]],
    [entries[1]],
    [{ ...entries[1], data: JSON.stringify({ ...manifest, name: 'another-package' }) }, entries[0]],
    [{ ...entries[1], data: Buffer.from([0xff]) }, entries[0]],
  ]
  for (const input of invalid) {
    bytes = archive(input)
    await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request), { name: 'ElectronError' })
  }
})

test('npm network budgets reject large, compressed HTTP, and error responses before buffering bodies', async (t) => {
  let status = 200
  let headers: Record<string, string> = {}
  let body = Buffer.alloc(65 * 1024, 32)
  const request = await registry(t, (_req, res) => { res.writeHead(status, headers); res.end(body) })
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  headers = { 'content-length': String(100 * 1024 * 1024) }
  body = Buffer.from('small')
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  headers = { 'content-encoding': 'gzip' }
  body = gzipSync(Buffer.alloc(100 * 1024 * 1024))
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  status = 404
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  status = 302
  headers = { location: 'https://evil.example/test', 'content-length': String(100 * 1024 * 1024) }
  body = Buffer.from('small')
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
})

test('npm archive budgets reject excessive entry counts, expansion, truncation, nested compression and oversized download headers', { timeout: 10_000 }, async (t) => {
  let bytes = archive(entries)
  let oversized = false
  const request = await registry(t, (req, res) => {
    if (req.url?.endsWith('.tgz')) {
      if (oversized) res.setHeader('content-length', 33 * 1024 * 1024)
      res.end(bytes)
    } else res.end(JSON.stringify(metadata(bytes)))
  })
  for (const invalid of [archive([...entries, ...Array.from({ length: 1024 }, (_, i) => ({ path: `package/file-${i}` }))]), gzipSync(archive(entries)), gzipSync(gunzipSync(archive(entries)).subarray(0, -1024)), Buffer.from('invalid gzip')]) {
    bytes = invalid
    await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  }
  bytes = archive(entries)
  oversized = true
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
  oversized = false
  const compressed: Buffer[] = []
  await pipeline(Readable.from((function* () {
    yield gunzipSync(archive(entries))
    const padding = Buffer.alloc(1024 * 1024)
    for (let i = 0; i < 129; i++) yield padding
  })()), createGzip(), async (source) => { for await (const chunk of source) compressed.push(chunk) })
  bytes = Buffer.concat(compressed)
  await assert.rejects(acquireNpmPlugin(spec, new AbortController().signal, request))
})
