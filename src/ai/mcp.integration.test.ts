import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { aiTools, type AiDocumentation, type AiResult } from '@nesso-how/ai'
import type { McpBridge, McpEvent } from '../../electron/mcp-bridge.ts'
import { createNessoStore } from '../store/create.ts'
import type { PluginPackageInput } from '@nesso-how/plugin/package'
import { NessoError } from '@nesso-how/errors'
import { connectMcpHost, setMcpEnabled } from './mcp.ts'
import type { AiPlugins } from './plugins.ts'

const fixture = (enabled = false, failure?: 'result' | 'reject') => {
  const host = createNessoStore({
    concepts: [{ id: 'urn:one', label: 'One' }],
    relations: [],
    relationTypes: [],
  })
  if (enabled) host.store.applyOperations([{ kind: 'preferences.mcpEnabled', value: true }])
  let listener: (event: McpEvent) => void = () => {}
  let busy = false
  const replies = new Map<string, AiResult<unknown>>()
  const attempts: boolean[] = []
  const errors: string[] = []
  let disconnected = false
  const state = { url: 'http://127.0.0.1:3210/mcp', token: '0'.repeat(64), changing: false }
  const bridge: McpBridge = {
    getState: async () => ({
      value: { ...state, running: false },
    }),
    setEnabled: async (enabled) => {
      attempts.push(enabled)
      if (failure === 'reject') throw new Error('Disconnected')
      if (failure === 'result') return { issues: [{ path: 'mcp', message: 'Port unavailable' }] }
      return { value: { ...state, running: enabled } }
    },
    copyUrl: async () => ({ value: true }),
    copyToken: async () => ({ value: true }),
    regenerateAccess: async () => ({
      value: { ...state, running: false },
    }),
    subscribeState: () => () => {},
    subscribeTools: (next) => {
      listener = next
      return () => {
        listener = () => {}
      }
    },
    disconnect: () => {
      disconnected = true
    },
    reply: (id, result) => {
      replies.set(id, result)
    },
  }
  let approval: ReturnType<typeof Promise.withResolvers<boolean>> | undefined
  const approve = (_input: unknown, signal: AbortSignal) => {
    const pending = Promise.withResolvers<boolean>()
    approval = pending
    signal.addEventListener('abort', () => pending.resolve(false), { once: true })
    return pending.promise
  }
  const documentation = Object.fromEntries(
    aiTools.read_docs.inputSchema.shape.topic.options.map((topic) => [topic, `# ${topic}`]),
  ) as AiDocumentation
  const proposals: { input: PluginPackageInput; replacing?: string; signal: AbortSignal }[] = []
  let proposal: ReturnType<typeof Promise.withResolvers<{ contentId: string } | null>> | undefined
  const plugins: AiPlugins = {
    list: () => [],
    propose: (input, replacing, signal) => {
      proposals.push({ input, replacing, signal })
      proposal = Promise.withResolvers()
      return proposal.promise.then(
        (installed) => installed && { name: 'nesso-plugin-local', version: '1.1.0', ...installed },
      )
    },
  }
  const dispose = connectMcpHost(
    bridge,
    host,
    approve,
    approve,
    () => busy,
    documentation,
    (message) => {
      errors.push(message)
    },
    plugins,
  )
  const decide = (approved: boolean) => {
    assert.ok(approval)
    approval.resolve(approved)
    approval = undefined
  }
  return {
    host,
    bridge,
    attempts,
    errors,
    disconnected: () => disconnected,
    replies,
    dispose,
    decide,
    awaitingApproval: () => !!approval,
    emit: (event: McpEvent) => listener(event),
    proposals,
    settle: (installed: { contentId: string } | null | Error) => {
      assert.ok(proposal)
      if (installed instanceof Error) proposal.reject(installed)
      else proposal.resolve(installed)
    },
    setBusy: () => {
      busy = true
    },
  }
}

test('MCP restores the desired state, and disconnecting never disables automatic startup', async () => {
  for (const enabled of [false, true]) {
    const f = fixture(enabled)
    await setImmediate()
    assert.deepEqual(f.attempts, enabled ? [true] : [])
    const before = f.host.store.getState()
    f.dispose()
    assert.equal(f.disconnected(), true)
    assert.equal(f.host.store.getState(), before)
  }
})

test('MCP startup failures are reported without clearing the preference, and can be retried or disabled', async () => {
  for (const failure of ['result', 'reject'] as const) {
    const f = fixture(true, failure)
    await setImmediate()
    assert.equal(f.errors.length, 1)
    assert.equal(f.host.store.getState().preferences.mcpEnabled, true)
    await setMcpEnabled(f.bridge, f.host.store, true).catch(() => {})
    assert.equal(f.host.store.getState().preferences.mcpEnabled, true)
    await setMcpEnabled(f.bridge, f.host.store, false).catch(() => {})
    assert.equal(f.host.store.getState().preferences.mcpEnabled, false)
    assert.deepEqual(f.attempts, [true, true, false])
    f.dispose()

    const disconnected = fixture(true, failure)
    disconnected.dispose()
    await setImmediate()
    assert.deepEqual(disconnected.errors, [])
  }
})

test('MCP reads are immediate; edits and shared history require consent and reject concurrent requests', async () => {
  const f = fixture()
  const before = f.host.store.getState()
  await f.emit({ type: 'tool', id: 'read', name: 'concepts', input: {} })
  assert.deepEqual(f.replies.get('read'), {
    value: { items: before.graph.concepts, total: 1, nextOffset: null },
  })
  const topics = aiTools.read_docs.inputSchema.shape.topic.options
  assert.deepEqual(topics, [
    'nesso',
    'ai',
    'plugin',
    'plugin-example',
    'schema',
    'concept-map',
    'knowledge-graph',
    'ui',
  ])
  for (const topic of topics) {
    await f.emit({ type: 'tool', id: 'docs', name: 'read_docs', input: { topic } })
    assert.deepEqual(f.replies.get('docs'), { value: { topic, content: `# ${topic}` } })
  }
  for (const input of [
    { topic: 'unknown' },
    { topic: '../README.md' },
    { topic: 'nesso', path: 'README.md' },
  ]) {
    await f.emit({ type: 'tool', id: 'invalid-docs', name: 'read_docs', input })
    assert.ok('issues' in f.replies.get('invalid-docs')!)
  }
  assert.equal(f.host.store.getState(), before)
  assert.equal(f.awaitingApproval(), false)
  const pending = f.emit({
    type: 'tool',
    id: 'edit',
    name: 'edit',
    input: { operations: [{ kind: 'concept.label', id: 'urn:one', value: 'Renamed' }] },
  })
  assert.equal(f.host.store.getState(), before)
  assert.equal(f.replies.has('edit'), false)
  await f.emit({ type: 'tool', id: 'concurrent', name: 'context', input: {} })
  assert.ok('issues' in f.replies.get('concurrent')!)
  f.decide(true)
  await pending
  assert.equal((f.replies.get('edit') as { value: { status: string } }).value.status, 'applied')
  assert.equal(f.host.store.getState().graph.concepts[0].label, 'Renamed')
  assert.equal(f.host.store.getState().conversation, before.conversation)
  const undo = f.emit({ type: 'tool', id: 'undo', name: 'history', input: { action: 'undo' } })
  f.decide(true)
  await undo
  assert.deepEqual(f.host.store.getState().graph, before.graph)
  const emptyUndo = f.emit({
    type: 'tool',
    id: 'empty',
    name: 'history',
    input: { action: 'undo' },
  })
  f.decide(true)
  await emptyUndo
  assert.equal((f.replies.get('empty') as { value: { status: string } }).value.status, 'unchanged')
  f.setBusy()
  await f.emit({ type: 'tool', id: 'chat', name: 'context', input: {} })
  assert.ok('issues' in f.replies.get('chat')!)
  f.dispose()
})

test('MCP lists plugins and reports local proposals as installed, cancelled or failed without touching the document', async () => {
  const f = fixture()
  const before = f.host.store.getState()
  await f.emit({ type: 'tool', id: 'list', name: 'plugins', input: {} })
  assert.deepEqual(f.replies.get('list'), { value: { items: [] } })
  const received = {
    manifest: { name: 'nesso-plugin-local', version: '1.1.0' },
    files: [{ path: 'dist/index.js', bytes: new TextEncoder().encode('export const create') }],
  }
  const issues = [{ path: 'manifest.nesso', message: 'Invalid manifest' }]
  const contentId = 'b'.repeat(64)
  for (const [outcome, expected] of [
    [
      { contentId },
      { status: 'installed', name: 'nesso-plugin-local', version: '1.1.0', contentId },
    ],
    [null, { status: 'cancelled' }],
    [new NessoError(issues), { status: 'failed', issues }],
    ['cancel', { status: 'cancelled' }],
  ] as const) {
    const pending = f.emit({
      type: 'tool',
      id: 'propose',
      name: 'propose_plugin',
      input: { package: received, replacing: 'a'.repeat(64) },
    })
    const request = f.proposals.at(-1)!
    if (outcome === 'cancel') {
      await f.emit({ type: 'cancel', id: 'propose' })
      assert.equal(request.signal.aborted, true)
      f.settle(new Error('Cancelled'))
    } else f.settle(outcome)
    await pending
    assert.deepEqual(f.replies.get('propose'), { value: expected })
  }
  assert.deepEqual(
    f.proposals.map(({ input, replacing }) => [input, replacing]),
    Array(4).fill([received, 'a'.repeat(64)]),
  )
  assert.equal(f.host.store.getState(), before)
  f.dispose()
})

test(
  'MCP rejection, cancellation, disconnect and stale approvals cannot apply staged writes',
  { timeout: 5000 },
  async () => {
    for (const action of ['reject', 'cancel', 'dispose', 'stale']) {
      const f = fixture()
      const before = f.host.store.getState()
      const pending = f.emit({
        type: 'tool',
        id: 'edit',
        name: 'edit',
        input: { operations: [{ kind: 'concept.label', id: 'urn:one', value: 'Staged' }] },
      })
      if (action === 'reject') f.decide(false)
      else if (action === 'cancel') await f.emit({ type: 'cancel', id: 'edit' })
      else if (action === 'dispose') f.dispose()
      else {
        f.host.store.setConceptLabel('urn:one', 'Manual')
        f.decide(true)
      }
      await pending
      if (action === 'stale') {
        assert.ok('issues' in f.replies.get('edit')!)
        assert.equal(f.host.store.getState().graph.concepts[0].label, 'Manual')
      } else assert.equal(f.host.store.getState(), before)
      f.dispose()
    }
  },
)
