import assert from 'node:assert/strict'
import test from 'node:test'
import { aiChatInstructions, aiChatMessages, type AiChatRequest, type AiChatEvent, type AiEffects } from '@nesso/ai'
import { createAiChatRun } from './ai-chat.ts'
import { ElectronError } from './errors.ts'

const entry = { id: 'local', name: 'Local', provider: 'custom' as const, endpoint: 'http://localhost:8888/v1', model: 'test-model', apiKey: '' }
const input: AiChatRequest = {
  id: 'turn', locale: 'en', context: '{"counts":{"concepts":1}}', messages: [
    { id: 'discarded', role: 'assistant', content: 'A previous proposal.' },
    { id: 'applied', role: 'assistant', content: 'Another proposal.', outcome: 'applied' },
    { id: 'user', role: 'user', content: 'Add a concept' },
  ],
}
const completion = (delta: object, finish = 'stop') => new Response([
  { choices: [{ index: 0, delta, finish_reason: null }] },
  { choices: [{ index: 0, delta: {}, finish_reason: finish }] },
].map((value) => `data: ${JSON.stringify({ id: 'response', object: 'chat.completion.chunk', created: 0, model: 'test-model', ...value })}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })

test('provider streaming shares tool schemas, waits for host replies and keeps local keys optional', async () => {
  const events: AiChatEvent[] = []
  let calls = 0
  const request: typeof fetch = async (url, options) => {
    assert.equal(url, `${entry.endpoint}/chat/completions`)
    assert.equal(options?.redirect, 'error')
    assert.equal(new Headers(options?.headers).has('authorization'), false)
    const body = JSON.parse(String(options?.body))
    assert.equal(body.model, entry.model)
    assert.deepEqual(body.messages.slice(0, input.messages.length + 2), [
      { role: 'system', content: aiChatInstructions(input) }, ...aiChatMessages(input),
    ])
    assert.ok(body.tools.some((tool: { function: { name: string } }) => tool.function.name === 'edit'))
    if (++calls === 1) return completion({ tool_calls: [{ index: 0, id: 'edit-call', type: 'function', function: { name: 'edit', arguments: '{"operations":[{"kind":"concept.add","id":"urn:new"}]}' } }] }, 'tool_calls')
    assert.ok(body.messages.some((message: { role: string }) => message.role === 'tool'))
    return completion({ content: 'A proposed concept.' })
  }
  const run = createAiChatRun(entry, input, (event) => {
    events.push(event)
    if (event.type === 'tool') {
      assert.equal(event.callId, 'edit-call')
      const counts = { added: 0, updated: 0, removed: 0 }
      const effects: AiEffects = { concepts: { ...counts, added: 1 }, relations: counts, relationTypes: counts, views: counts, memberships: 0, requiresApproval: false }
      run.reply({ id: 'unrelated', callId: event.callId, result: { value: effects } })
      run.reply({ id: input.id, callId: 'unrelated', result: { value: effects } })
      run.reply({ id: input.id, callId: event.callId, result: { value: effects } })
    }
  }, request)
  assert.equal(await run.result, true)
  assert.equal(calls, 2)
  assert.deepEqual(events.map(({ type }) => type), ['tool', 'text'])
})

test('Stop, tool failure and incomplete provider replies never report successful generation or leak response bodies', async () => {
  for (const mode of ['stop', 'tool', 'length', 'http']) {
    const request: typeof fetch = async () => mode === 'http' ? new Response('secret-key', { status: 401 })
      : mode === 'length' ? completion({ content: 'Incomplete plan' }, 'length')
      : completion({ tool_calls: [{ index: 0, id: 'call', type: 'function', function: { name: 'context', arguments: '{}' } }] }, 'tool_calls')
    const run = createAiChatRun(entry, input, (event) => {
      if (event.type !== 'tool') return
      if (mode === 'stop') run.cancel()
      else run.reply({ id: input.id, callId: event.callId, result: { issues: [{ path: 'tool', message: 'secret-key' }] } })
    }, request)
    await assert.rejects(run.result, (error) => error instanceof ElectronError && !error.message.includes('secret-key'))
  }
})
