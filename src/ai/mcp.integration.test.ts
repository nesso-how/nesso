import assert from 'node:assert/strict'
import test from 'node:test'
import type { AiResult } from '@nesso/ai'
import type { McpBridge, McpEvent } from '../../electron/mcp-bridge.ts'
import { createNessoStore } from '../store/create.ts'
import { connectMcpHost } from './mcp.ts'

const fixture = () => {
  const host = createNessoStore({
    concepts: [{ id: 'urn:one', label: 'One', position: { x: 0, y: 0 } }], relations: [], relationTypes: [],
  })
  let listener: (event: McpEvent) => void = () => {}
  let busy = false
  const replies = new Map<string, AiResult<unknown>>()
  const bridge: McpBridge = {
    getState: async () => ({ value: { url: 'http://127.0.0.1:3210/mcp', token: '0'.repeat(64), running: false } }),
    setEnabled: async (enabled) => ({ value: { url: 'http://127.0.0.1:3210/mcp', token: '0'.repeat(64), running: enabled } }),
    copyUrl: async () => ({ value: true }),
    copyToken: async () => ({ value: true }),
    regenerateAccess: async () => ({ value: { url: 'http://127.0.0.1:3210/mcp', token: '0'.repeat(64), running: false } }),
    subscribeState: () => () => {},
    subscribeTools: (next) => { listener = next; return () => { listener = () => {} } },
    disconnect: () => {},
    reply: (id, result) => { replies.set(id, result) },
  }
  let approval: ReturnType<typeof Promise.withResolvers<boolean>> | undefined
  const approve = (_input: unknown, signal: AbortSignal) => {
    const pending = Promise.withResolvers<boolean>()
    approval = pending
    signal.addEventListener('abort', () => pending.resolve(false), { once: true })
    return pending.promise
  }
  const dispose = connectMcpHost(bridge, host, approve, approve, () => busy)
  const decide = (approved: boolean) => {
    assert.ok(approval)
    approval.resolve(approved)
    approval = undefined
  }
  return { host, replies, dispose, decide, awaitingApproval: () => !!approval, emit: (event: McpEvent) => listener(event), setBusy: () => { busy = true } }
}

test('MCP reads are immediate; edits and shared history require consent and reject concurrent requests', async () => {
  const f = fixture()
  const before = f.host.store.getState()
  await f.emit({ type: 'tool', id: 'read', name: 'concepts', input: {} })
  assert.deepEqual(f.replies.get('read'), { value: { items: before.graph.concepts, total: 1, nextOffset: null } })
  assert.equal(f.awaitingApproval(), false)
  const pending = f.emit({ type: 'tool', id: 'edit', name: 'edit', input: { operations: [{ kind: 'concept.label', id: 'urn:one', value: 'Renamed' }] } })
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
  const emptyUndo = f.emit({ type: 'tool', id: 'empty', name: 'history', input: { action: 'undo' } })
  f.decide(true)
  await emptyUndo
  assert.equal((f.replies.get('empty') as { value: { status: string } }).value.status, 'unchanged')
  f.setBusy()
  await f.emit({ type: 'tool', id: 'chat', name: 'context', input: {} })
  assert.ok('issues' in f.replies.get('chat')!)
  f.dispose()
})

test('MCP rejection, cancellation, disconnect and stale approvals cannot apply staged writes', { timeout: 5000 }, async () => {
  for (const action of ['reject', 'cancel', 'dispose', 'stale']) {
    const f = fixture()
    const before = f.host.store.getState()
    const pending = f.emit({ type: 'tool', id: 'edit', name: 'edit', input: { operations: [{ kind: 'concept.label', id: 'urn:one', value: 'Staged' }] } })
    if (action === 'reject') f.decide(false)
    else if (action === 'cancel') await f.emit({ type: 'cancel', id: 'edit' })
    else if (action === 'dispose') f.dispose()
    else { f.host.store.setConceptLabel('urn:one', 'Manual'); f.decide(true) }
    await pending
    if (action === 'stale') {
      assert.ok('issues' in f.replies.get('edit')!)
      assert.equal(f.host.store.getState().graph.concepts[0].label, 'Manual')
    } else assert.equal(f.host.store.getState(), before)
    f.dispose()
  }
})
