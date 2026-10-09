import assert from 'node:assert/strict'
import test from 'node:test'
import { createAiConnections } from './ai-connections.ts'
import { aiProviders, type AiConnectionInput, type AiProvider } from '@nesso/ai/providers'
import { ElectronError } from './errors.ts'
import type { createChatGptAuth } from './ai-oauth.ts'

const input: AiConnectionInput = { name: 'Local', provider: 'custom', endpoint: 'http://localhost:11434/v1/', model: 'local-model' }
const fixture = (request?: typeof fetch, auth?: ReturnType<typeof createChatGptAuth>) => {
  let raw: string | null = null
  const storage = { read: () => raw, write: (value: string) => { raw = value } }
  return { storage, connections: createAiConnections(storage, request, auth) }
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
  assert.deepEqual(connections.remove(first.id), { connections: [], activeId: null, accounts: [] })
})

const account = {
  id: '11111111-1111-4111-8111-111111111111', clientId: 'oaiapp_test', subject: 'test-user', email: 'user@example.com',
  session: { accessToken: 'access-secret', refreshToken: 'refresh-secret', idToken: 'identity-secret', expiresAt: Date.now() + 3600_000, scopes: ['chatgpt.tokens.use.direct'] },
}
const chatGptInput: AiConnectionInput = { name: 'ChatGPT', provider: 'openai', endpoint: aiProviders.openai.endpoint, model: 'model', authentication: 'chatgpt', accountId: account.id }

test('a single ChatGPT connection keeps credentials private and can be edited, disconnected or replaced without changing API keys', async () => {
  const hostIds: string[] = []
  let loginAccount = account
  let finishRevocation!: () => void
  const revocation = new Promise<void>((resolve) => { finishRevocation = resolve })
  const auth: ReturnType<typeof createChatGptAuth> = {
    signIn: async (hostId, previous) => { hostIds.push(hostId); return { ...loginAccount, id: previous?.id ?? loginAccount.id } },
    refresh: async (entry) => entry,
    revoke: async () => { await revocation; return true },
  }
  const { connections, storage } = fixture(async (_url, options) => {
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer access-secret')
    return Response.json({ models: [{ slug: 'model', visibility: 'list' }, { slug: 'hidden', visibility: 'hide' }] })
  }, auth)
  assert.throws(() => connections.save(chatGptInput), ElectronError)
  const login = await connections.signIn()
  assert.deepEqual(login.state.accounts, [{ id: account.id, email: account.email, signedIn: true }])
  const saved = connections.save(chatGptInput)
  const beforeDuplicate = storage.read()
  assert.throws(() => connections.save({ ...chatGptInput, model: 'another-model' }), ElectronError)
  await assert.rejects(connections.signIn(), ElectronError)
  assert.equal(storage.read(), beforeDuplicate)
  assert.equal(hostIds.length, 1)
  assert.equal(saved.connections[0].hasKey, false)
  assert.equal(JSON.stringify(saved).includes('secret'), false)
  assert.equal((await connections.active()).apiKey, 'access-secret')
  assert.deepEqual(await connections.models({ ...chatGptInput, model: '' }), ['model'])
  assert.equal(await connections.verify(chatGptInput), true)
  const api = connections.save({ ...input, apiKey: 'api-secret' }).connections[1]
  connections.activate(api.id)
  assert.equal(connections.save({ ...chatGptInput, id: saved.connections[0].id, model: 'another-model' }).activeId, api.id)
  connections.activate(saved.connections[0].id)
  for (const change of [{ endpoint: 'https://other.example/v1' }, { provider: 'custom' }, { accountId: '22222222-2222-4222-8222-222222222222' }]) {
    assert.throws(() => connections.save({ ...chatGptInput, ...change }), ElectronError)
  }
  connections.save({ ...chatGptInput, id: saved.connections[0].id, authentication: 'api-key', apiKey: 'api-secret' })
  assert.equal(JSON.parse(storage.read()!).connections[0].accountId, undefined)
  connections.save({ ...chatGptInput, id: saved.connections[0].id })
  const signingOut = connections.signOut(account.id)
  await assert.rejects(connections.active(), ElectronError)
  await assert.rejects(connections.signIn(account.id), ElectronError)
  finishRevocation()
  const signedOut = await signingOut
  assert.equal(signedOut.revoked, true)
  assert.equal(signedOut.state.accounts[0].signedIn, false)
  assert.equal(JSON.parse(storage.read()!).accounts[0].session, undefined)
  assert.equal(JSON.parse(storage.read()!).accounts[0].clientId, account.clientId)
  assert.equal(JSON.parse(storage.read()!).connections[1].apiKey, 'api-secret')
  await assert.rejects(connections.active(), ElectronError)
  await connections.signIn(account.id)
  assert.equal(hostIds[0], hostIds[1])
  assert.equal((await connections.active()).apiKey, 'access-secret')
  await connections.signOut(account.id)
  loginAccount = { ...account, id: '22222222-2222-4222-8222-222222222222', subject: 'another-user', email: 'another@example.com' }
  const replacement = await connections.signIn()
  assert.equal(replacement.state.accounts.length, 1)
  assert.equal(replacement.state.accounts[0].email, loginAccount.email)
  assert.equal(replacement.state.connections[0].accountId, loginAccount.id)
  assert.equal(JSON.parse(storage.read()!).connections[1].apiKey, 'api-secret')
  connections.remove(saved.connections[0].id)
  assert.equal(connections.list().accounts.length, 1)
  assert.equal(connections.save({ ...chatGptInput, accountId: loginAccount.id }).connections[1].authentication, 'chatgpt')
})

test('ChatGPT refresh is serialized, rotates tokens atomically and preserves credentials on failure', async () => {
  let refreshes = 0
  let rejectRefresh = false
  let resolve!: () => void
  const gate = new Promise<void>((done) => { resolve = done })
  const auth: ReturnType<typeof createChatGptAuth> = {
    signIn: async () => ({ ...account, session: { ...account.session, expiresAt: Date.now() - 1 } }),
    refresh: async (entry) => {
      refreshes++
      if (rejectRefresh) throw new ElectronError([{ path: 'oauth', message: 'Session revoked' }])
      await gate
      return { ...entry, session: { ...account.session, accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: Date.now() + 3600_000 } }
    },
    revoke: async () => false,
  }
  const { connections, storage } = fixture(async () => Response.json({ models: [{ slug: 'model', visibility: 'list' }] }), auth)
  await connections.signIn()
  connections.save(chatGptInput)
  const active = connections.active()
  const models = connections.models(chatGptInput)
  connections.save(input)
  resolve()
  assert.equal((await active).apiKey, 'new-access')
  await models
  assert.equal(refreshes, 1)
  const record = JSON.parse(storage.read()!)
  assert.equal(record.accounts[0].session.refreshToken, 'new-refresh')
  assert.equal(record.connections.length, 2)
  record.accounts[0].session.expiresAt = Date.now() - 1
  storage.write(JSON.stringify(record))
  const before = storage.read()
  rejectRefresh = true
  await assert.rejects(connections.active(), ElectronError)
  assert.equal(storage.read(), before)
  const signedOut = await connections.signOut(account.id)
  assert.equal(signedOut.revoked, false)
  assert.equal(signedOut.state.accounts[0].signedIn, false)
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
    assert.deepEqual(connections.list(), { connections: [], activeId: null, accounts: [] })
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
