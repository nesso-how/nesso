import assert from 'node:assert/strict'
import test from 'node:test'
import { createAiConnections } from './ai-connections.ts'
import { aiProviders, type AiConnectionInput, type AiProvider } from '@nesso/ai/providers'
import { ElectronError } from './errors.ts'

const input: AiConnectionInput = { name: 'Local', provider: 'custom', endpoint: 'http://localhost:11434/v1/', model: 'local-model' }
const fixture = (request?: typeof fetch) => {
  let raw: string | null = null
  const storage = { read: () => raw, write: (value: string) => { raw = value } }
  return { storage, connections: createAiConnections(storage, request) }
}

test('connections persist activation and edits without exposing or transferring stored credentials', () => {
  const { connections, storage } = fixture()
  const first = connections.save({ ...input, apiKey: 'secret' }).connections[0]
  assert.equal(first.endpoint, 'http://localhost:11434/v1')
  assert.equal(first.hasKey, true)
  assert.equal(JSON.stringify(first).includes('secret'), false)
  const second = connections.save({ ...input, name: 'Other' }).connections[1]
  assert.equal(connections.activate(second.id).activeId, second.id)
  connections.save({ ...first, apiKey: '', model: 'changed' })
  assert.equal(JSON.parse(storage.read()!).connections[0].apiKey, 'secret')
  connections.save({ ...first, endpoint: 'https://other.example/v1', apiKey: '' })
  assert.equal(JSON.parse(storage.read()!).connections[0].apiKey, '')
  assert.deepEqual(createAiConnections(storage).list(), connections.list())
  assert.equal(connections.remove(second.id).activeId, first.id)
  assert.deepEqual(connections.remove(first.id), { connections: [], activeId: null })
})

test('connection schemas reject invalid fields, unsafe endpoints and unknown IDs without saving', () => {
  const { connections, storage } = fixture()
  for (const endpoint of ['not a URL', 'http://remote.example/v1', 'file:///etc/passwd', 'https://user:pass@example.com', 'https://example.com?key=secret', 'https://example.com#fragment']) {
    assert.throws(() => connections.save({ ...input, endpoint }), ElectronError)
  }
  for (const [field, value] of Object.entries({ id: '', name: ' ', provider: 'unsupported', model: '', apiKey: 123 })) {
    assert.throws(() => connections.save({ ...input, [field]: value }), (error) => error instanceof ElectronError && error.issues.some(({ path }) => path === field))
  }
  for (const [field, max] of Object.entries({ id: 256, name: 80, model: 256, apiKey: 8192 })) {
    assert.throws(() => connections.save({ ...input, [field]: 'x'.repeat(max + 1) }), ElectronError)
  }
  assert.throws(() => connections.save(null), ElectronError)
  assert.throws(() => connections.save({ ...input, provider: 'openai' }), ElectronError)
  assert.throws(() => connections.save({ ...input, id: 'missing' }), ElectronError)
  assert.equal(storage.read(), null)
  for (const endpoint of ['http://localhost/v1/', 'http://127.0.0.1/v1/', 'http://[::1]/v1/', 'https://remote.example/v1/']) {
    assert.equal(connections.save({ ...input, endpoint }).connections.at(-1)?.endpoint, endpoint.slice(0, -1))
  }
})

test('unreadable storage and failed durable writes never overwrite existing connections', () => {
  let writes = 0
  const broken = createAiConnections({ read: () => '{broken', write: () => { writes++ } })
  assert.throws(() => broken.list(), ElectronError)
  assert.throws(() => broken.save(input), ElectronError)
  assert.equal(writes, 0)
  const { connections, storage } = fixture()
  connections.save(input)
  const before = storage.read()
  const record = JSON.parse(before!)
  for (const invalid of [
    { ...record, connections: [...record.connections, ...record.connections] },
    { ...record, activeId: 'missing' },
    ...[
      { id: undefined }, { apiKey: undefined }, { model: '' }, { endpoint: 'http://remote.example' },
    ].map((change) => ({ ...record, connections: [{ ...record.connections[0], ...change }] })),
  ]) {
    const raw = JSON.stringify(invalid)
    const protectedConnections = createAiConnections({ read: () => raw, write: () => { writes++ } })
    assert.throws(() => protectedConnections.list(), ElectronError)
    assert.throws(() => protectedConnections.save(input), ElectronError)
  }
  assert.equal(writes, 0)
  const unavailable = createAiConnections({ read: storage.read, write: () => { throw new Error('Keychain unavailable') } })
  assert.throws(() => unavailable.save(input), ElectronError)
  assert.equal(storage.read(), before)
})

test('verification uses provider authentication, blocks redirects and never performs inference or leaks provider errors', async () => {
  for (const provider of Object.keys(aiProviders) as AiProvider[]) {
    const request: typeof fetch = async (url, options) => {
      assert.equal(url, `${aiProviders[provider].endpoint}/models`)
      assert.equal(options?.redirect, 'error')
      assert.equal(options?.method, undefined)
      const headers = options?.headers as { [key: string]: string }
      assert.equal(headers[provider === 'anthropic' ? 'x-api-key' : provider === 'gemini' ? 'x-goog-api-key' : 'Authorization'], provider === 'anthropic' || provider === 'gemini' ? 'secret' : 'Bearer secret')
      return Response.json(provider === 'gemini' ? { models: [{ name: 'models/local-model' }] } : { data: [{ id: 'local-model' }] })
    }
    const { connections } = fixture(request)
    assert.equal(await connections.verify({ ...input, provider, endpoint: aiProviders[provider].endpoint, apiKey: 'secret' }), true)
  }
  const { connections } = fixture(async () => new Response('secret provider detail', { status: 401 }))
  await assert.rejects(connections.verify(input), { message: 'endpoint: Provider returned HTTP 401' })
})

test('model discovery works before choosing a model, follows pagination and leaves unsupported endpoints editable', async () => {
  for (const provider of ['anthropic', 'gemini'] as const) {
    const { connections } = fixture(async (url) => {
      const next = String(url).includes('?')
      return Response.json(provider === 'gemini'
        ? { models: [{ name: next ? 'models/a-model' : 'models/z-model' }], ...(!next && { nextPageToken: 'page 2' }) }
        : { data: [{ id: next ? 'a-model' : 'z-model' }], has_more: !next, last_id: 'z-model' })
    })
    assert.deepEqual(await connections.models({ ...input, provider, endpoint: aiProviders[provider].endpoint, model: '', apiKey: 'secret' }), ['a-model', 'z-model'])
    assert.deepEqual(connections.list(), { connections: [], activeId: null })
  }
  const { connections } = fixture(async () => new Response(null, { status: 404 }))
  await assert.rejects(connections.models({ ...input, model: '' }), ElectronError)
  assert.equal(connections.save(input).connections[0].model, input.model)
  for (const [provider, body] of [
    ['custom', { data: [{ id: 123 }] }],
    ['custom', { data: 'invalid' }],
    ['anthropic', { data: [], has_more: true }],
    ['gemini', { models: [], nextPageToken: ' ' }],
  ] as const) {
    const invalid = fixture(async () => Response.json(body))
    await assert.rejects(invalid.connections.models({ ...input, provider, apiKey: 'secret' }), ElectronError)
    assert.equal(invalid.storage.read(), null)
  }
})
