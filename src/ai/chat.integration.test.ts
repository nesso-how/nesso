import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aiTools,
  aiChatLimits,
  type AiChatEvent,
  type AiChatRequest,
  type AiChatResult,
  type AiDocumentation,
  type AiEffects,
  type AiResult,
  type AiToolReply,
} from '@nesso-how/ai'
import type { AiBridge } from '../../electron/ai-bridge.ts'
import { createNessoStore } from '../store/create.ts'
import { createAiChat } from './chat.ts'

const fixture = () => {
  const listeners = new Set<(event: AiChatEvent) => void>()
  const receive = (event: AiChatEvent) => {
    for (const listener of listeners) listener(event)
  }
  let finish: (result: AiResult<AiChatResult>) => void = () => {}
  let input: AiChatRequest
  const replies: AiToolReply[] = []
  const bridge: Pick<AiBridge, 'chat' | 'stop' | 'reply' | 'subscribeChat'> = {
    chat: (value) => {
      input = value
      return new Promise((resolve) => {
        finish = resolve
      })
    },
    stop: () => finish({ issues: [{ path: 'chat', message: 'Stopped' }] }),
    reply: (value) => {
      replies.push(value)
    },
    subscribeChat: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  const host = createNessoStore({
    concepts: [{ id: 'urn:first', label: 'First', position: { x: 0, y: 0 } }],
    relations: [],
    relationTypes: [],
  })
  const documentation = Object.fromEntries(
    aiTools.read_docs.inputSchema.shape.topic.options.map((topic) => [topic, `# ${topic}`]),
  ) as AiDocumentation
  const approvals: { effects: AiEffects; resolve: (approved: boolean) => void }[] = []
  const chat = createAiChat(
    bridge,
    host.store,
    documentation,
    (effects, signal) =>
      new Promise((resolve) => {
        approvals.push({ effects, resolve })
        signal.addEventListener('abort', () => resolve(false), { once: true })
      }),
  )
  return {
    chat,
    host,
    replies,
    approvals,
    finish: (result: AiResult<AiChatResult>) => finish(result),
    tool: (name: string, value: unknown) =>
      receive({ id: input.id, type: 'tool', callId: name, name, input: value }),
    activity: (tool: keyof typeof aiTools | null, id = input.id) =>
      receive({ id, type: 'activity', tool }),
    emit: (text: string) => receive({ id: input.id, type: 'text', text }),
    edit: (operations: unknown[]) =>
      receive({ id: input.id, type: 'tool', callId: 'edit', name: 'edit', input: { operations } }),
    history: (action: unknown) =>
      receive({
        id: input.id,
        type: 'tool',
        callId: 'history',
        name: 'history',
        input: { action },
      }),
  }
}

test('chat reserves space for both new messages within the shared limit', async () => {
  const f = fixture()
  const messages = Array.from({ length: aiChatLimits.messageCount - 1 }, (_, index) => ({
    id: String(index),
    role: 'user' as const,
    content: 'Previous message',
  }))
  f.host.store.setChatMessages(messages)
  const full = f.host.store.getState()
  await f.chat.send('Explain Nesso', f.host, 'en')
  assert.equal(f.host.store.getState(), full)
  assert.equal(f.chat.getSnapshot().issues.length, 1)

  f.host.store.setChatMessages(messages.slice(1))
  const sending = f.chat.send('Explain Nesso', f.host, 'en')
  f.finish({ value: {} })
  await sending
  assert.equal(f.host.store.getState().conversation.messages.length, aiChatLimits.messageCount)
  f.chat.dispose()
})

test('chat reads documentation with transient activity, ignores unrelated events and clears between turns', async () => {
  const f = fixture()
  const sending = f.chat.send('Explain Nesso', f.host, 'en')
  const before = f.host.store.getState()
  let publications = 0
  const unsubscribe = f.chat.subscribe(() => publications++)
  assert.equal(f.chat.getSnapshot().tool, null)
  f.activity('read_docs', 'another-request')
  assert.equal(publications, 0)
  f.activity('read_docs')
  assert.equal(f.chat.getSnapshot().tool, 'read_docs')
  f.activity('read_docs')
  assert.equal(publications, 1)
  f.tool('read_docs', { topic: 'nesso' })
  assert.deepEqual(f.replies.at(-1)?.result, { value: { topic: 'nesso', content: '# nesso' } })
  f.activity(null)
  assert.equal(f.chat.getSnapshot().tool, null)
  assert.equal(f.host.store.getState(), before)
  f.activity('concepts')
  f.finish({ value: {} })
  await sending
  assert.equal(f.host.store.getState().graph, before.graph)
  assert.equal(f.host.store.getState().history, before.history)
  assert.equal(f.chat.getSnapshot().tool, null)
  const next = f.chat.send('Explain relations', f.host, 'en')
  assert.equal(f.chat.getSnapshot().tool, null)
  f.activity('relations')
  f.chat.stop()
  assert.equal(f.chat.getSnapshot().phase, 'stopping')
  assert.equal(f.chat.getSnapshot().tool, null)
  f.activity('edit')
  assert.equal(f.chat.getSnapshot().tool, null)
  await next
  unsubscribe()
  f.chat.dispose()
})

test('chat commits only after generation and clears its conversation on document reset, not navigation', async () => {
  const f = fixture()
  const task = f.chat.send('Rename it', f.host, 'en')
  f.emit('Proposed rename.')
  f.edit([{ kind: 'concept.label', id: 'urn:first', value: 'Renamed' }])
  assert.equal(f.host.store.getState().graph.concepts[0].label, 'First')
  assert.ok('value' in f.replies[0].result)
  f.finish({ value: {} })
  await task
  assert.equal(f.host.store.getState().graph.concepts[0].label, 'Renamed')
  assert.equal(f.host.store.getState().conversation.messages.at(-1)?.outcome, 'applied')
  assert.deepEqual(f.host.store.getState().conversation.messages.at(-1)?.summary, {
    added: 0,
    updated: 1,
    removed: 0,
    memberships: 0,
  })
  f.host.store.undo()
  f.host.store.setSelection([{ kind: 'concept', id: 'urn:first' }])
  assert.equal(f.host.store.getState().conversation.messages.length, 2)
  const reset = f.chat.send('Reset', f.host, 'en')
  f.host.store.resetGraph()
  f.finish({ value: {} })
  await reset
  assert.equal(f.host.store.getState().conversation.messages.length, 0)
  assert.equal(f.host.store.getState().history.canUndo, false)
  f.chat.dispose()
})

test('history turns report completion instead of applied, leaving action buttons on the edited message', async () => {
  const f = fixture()
  const edit = f.chat.send('Rename it', f.host, 'en')
  f.emit('Proposed rename.')
  f.edit([{ kind: 'concept.label', id: 'urn:first', value: 'Renamed' }])
  f.finish({ value: {} })
  await edit
  assert.equal(f.host.store.getState().graph.concepts[0].label, 'Renamed')
  assert.equal(f.host.store.getState().conversation.messages.at(-1)?.outcome, 'applied')
  const undo = f.chat.send('Undo that', f.host, 'en')
  f.emit('Undone.')
  f.history('undo')
  f.finish({ value: {} })
  await undo
  const messages = f.host.store.getState().conversation.messages
  assert.equal(messages.at(-1)?.outcome, 'complete')
  assert.equal(messages.at(-1)?.summary, undefined)
  assert.equal(messages.filter(({ outcome }) => outcome === 'applied').length, 1)
  assert.equal(f.host.store.getState().graph.concepts[0].label, 'First')
  assert.deepEqual(f.host.store.getState().history, { canUndo: false, canRedo: true })
  f.chat.dispose()
})

test('chat stores response timing and provider token totals on the assistant message', async () => {
  const f = fixture()
  const task = f.chat.send('Explain Nesso', f.host, 'en')
  f.emit('A reply.')
  f.finish({ value: { totalTokens: 150 } })
  await task
  const message = f.host.store.getState().conversation.messages.at(-1)
  assert.equal(message?.stats?.totalTokens, 150)
  assert.ok(message?.stats && message.stats.durationMs >= 0)
  assert.deepEqual(Object.keys(message!).sort(), ['content', 'id', 'outcome', 'role', 'stats'])
  f.chat.dispose()
})

test('Stop, clear and generation failure discard staged edits and cannot resurrect a cleared conversation', async () => {
  for (const action of ['stop', 'clear', 'store-clear', 'failure']) {
    const f = fixture()
    const task = f.chat.send('Rename it', f.host, 'en')
    f.edit([{ kind: 'concept.label', id: 'urn:first', value: 'Discarded' }])
    f.activity('edit')
    if (action === 'failure') f.finish({ issues: [{ path: 'chat', message: 'Provider failed' }] })
    else if (action === 'store-clear') f.host.store.clearChat()
    else f.chat[action as 'stop' | 'clear']()
    f.emit('Late text')
    await task
    assert.equal(f.host.store.getState().graph.concepts[0].label, 'First')
    assert.equal(f.chat.getSnapshot().phase, 'idle')
    assert.equal(f.chat.getSnapshot().tool, null)
    if (action === 'clear' || action === 'store-clear')
      assert.deepEqual(f.host.store.getState().conversation.messages, [])
    else
      assert.equal(
        f.host.store.getState().conversation.messages.at(-1)?.outcome,
        action === 'failure' ? 'error' : 'cancelled',
      )
    f.chat.dispose()
  }
})

test('retry resends only a failed or cancelled last turn in place', async () => {
  const f = fixture()
  const failed = f.chat.send('Rename it', f.host, 'en')
  f.finish({ issues: [{ path: 'chat', message: 'Provider failed' }] })
  await failed
  const retried = f.chat.retry(f.host, 'en')
  f.emit('Renamed.')
  f.finish({ value: {} })
  await retried
  const messages = f.host.store.getState().conversation.messages
  assert.deepEqual(
    messages.map(({ role, content, outcome }) => [role, content, outcome]),
    [
      ['user', 'Rename it', undefined],
      ['assistant', 'Renamed.', 'complete'],
    ],
  )
  await f.chat.retry(f.host, 'en')
  assert.equal(f.host.store.getState().conversation.messages, messages)
  f.chat.dispose()
})

test('chat asks before applying turns that remove five or more concepts', async () => {
  const f = fixture()
  const ids = Array.from({ length: 6 }, (_, index) => `urn:c${index}`)
  f.host.store.applyOperations(
    ids.flatMap((id) => [
      { kind: 'selection.set', value: [] },
      { kind: 'concept.add', id },
    ]),
  )
  const settle = () => new Promise((resolve) => setImmediate(resolve))
  const labels = () => f.host.store.getState().graph.concepts.map(({ id }) => id)
  const before = labels()
  const propose = async (count: number) => {
    const task = f.chat.send('Remove concepts', f.host, 'en')
    f.edit(ids.slice(0, count).map((id) => ({ kind: 'concept.remove', id })))
    f.finish({ value: {} })
    await settle()
    return task
  }
  const outcome = () => f.host.store.getState().conversation.messages.at(-1)?.outcome

  await propose(4)
  assert.equal(f.approvals.length, 0)
  assert.equal(labels().length, before.length - 4)
  f.host.store.undo()

  const rejected = propose(5)
  await settle()
  assert.equal(f.approvals.length, 1)
  assert.equal(f.approvals[0].effects.concepts.removed, 5)
  assert.deepEqual(labels(), before)
  f.approvals[0].resolve(false)
  await rejected
  assert.deepEqual(labels(), before)
  assert.equal(outcome(), 'cancelled')

  const approved = propose(5)
  await settle()
  f.approvals[1].resolve(true)
  await approved
  assert.deepEqual(labels(), ['urn:first', 'urn:c5'])
  assert.equal(outcome(), 'applied')
  f.host.store.undo()

  const stopped = propose(5)
  await settle()
  f.chat.stop()
  await stopped
  assert.equal(f.approvals.length, 3)
  assert.deepEqual(labels(), before)
  assert.equal(outcome(), 'cancelled')

  const stale = propose(5)
  await settle()
  f.host.store.setConceptLabel('urn:first', 'Changed')
  f.approvals[3].resolve(true)
  await stale
  assert.deepEqual(labels(), before)
  assert.equal(outcome(), 'error')
  f.chat.dispose()
})
