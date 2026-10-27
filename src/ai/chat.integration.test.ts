import assert from 'node:assert/strict'
import test from 'node:test'
import { aiTools, type AiChatEvent, type AiChatRequest, type AiDocumentation, type AiResult, type AiToolReply } from '@nesso-how/ai'
import type { AiBridge } from '../../electron/ai-bridge.ts'
import { createNessoStore } from '../store/create.ts'
import { createAiChat } from './chat.ts'

const fixture = () => {
  const listeners = new Set<(event: AiChatEvent) => void>()
  const receive = (event: AiChatEvent) => { for (const listener of listeners) listener(event) }
  let finish: (result: AiResult<true>) => void = () => {}
  let input: AiChatRequest
  const replies: AiToolReply[] = []
  const bridge: Pick<AiBridge, 'chat' | 'stop' | 'reply' | 'subscribeChat'> = {
    chat: (value) => { input = value; return new Promise((resolve) => { finish = resolve }) },
    stop: () => finish({ issues: [{ path: 'chat', message: 'Stopped' }] }),
    reply: (value) => { replies.push(value) },
    subscribeChat: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
  const host = createNessoStore({ concepts: [{ id: 'urn:first', label: 'First', position: { x: 0, y: 0 } }], relations: [], relationTypes: [] })
  const documentation = Object.fromEntries(aiTools.read_docs.inputSchema.shape.topic.options.map((topic) => [topic, `# ${topic}`])) as AiDocumentation
  const chat = createAiChat(bridge, host.store, documentation)
  return {
    chat, host, replies, finish: (result: AiResult<true>) => finish(result),
    tool: (name: string, value: unknown) => receive({ id: input.id, type: 'tool', callId: name, name, input: value }),
    activity: (tool: keyof typeof aiTools | null, id = input.id) => receive({ id, type: 'activity', tool }),
    emit: (text: string) => receive({ id: input.id, type: 'text', text }),
    edit: (operations: unknown[]) => receive({ id: input.id, type: 'tool', callId: 'edit', name: 'edit', input: { operations } }),
    history: (action: unknown) => receive({ id: input.id, type: 'tool', callId: 'history', name: 'history', input: { action } }),
  }
}

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
  f.finish({ value: true })
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
  f.finish({ value: true })
  await task
  assert.equal(f.host.store.getState().graph.concepts[0].label, 'Renamed')
  assert.equal(f.host.store.getState().conversation.messages.at(-1)?.outcome, 'applied')
  assert.deepEqual(f.host.store.getState().conversation.messages.at(-1)?.summary, { added: 0, updated: 1, removed: 0, memberships: 0 })
  f.host.store.undo()
  f.host.store.setSelection([{ kind: 'concept', id: 'urn:first' }])
  assert.equal(f.host.store.getState().conversation.messages.length, 2)
  const reset = f.chat.send('Reset', f.host, 'en')
  f.host.store.resetGraph()
  f.finish({ value: true })
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
  f.finish({ value: true })
  await edit
  assert.equal(f.host.store.getState().graph.concepts[0].label, 'Renamed')
  assert.equal(f.host.store.getState().conversation.messages.at(-1)?.outcome, 'applied')
  const undo = f.chat.send('Undo that', f.host, 'en')
  f.emit('Undone.')
  f.history('undo')
  f.finish({ value: true })
  await undo
  const messages = f.host.store.getState().conversation.messages
  assert.equal(messages.at(-1)?.outcome, 'complete')
  assert.equal(messages.at(-1)?.summary, undefined)
  assert.equal(messages.filter(({ outcome }) => outcome === 'applied').length, 1)
  assert.equal(f.host.store.getState().graph.concepts[0].label, 'First')
  assert.deepEqual(f.host.store.getState().history, { canUndo: false, canRedo: true })
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
    if (action === 'clear' || action === 'store-clear') assert.deepEqual(f.host.store.getState().conversation.messages, [])
    else assert.equal(f.host.store.getState().conversation.messages.at(-1)?.outcome, action === 'failure' ? 'error' : 'cancelled')
    f.chat.dispose()
  }
})
