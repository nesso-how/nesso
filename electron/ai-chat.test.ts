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

const responses = (events: readonly object[]) => new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } })
const messageEvents = [
  { type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'message' } },
  { type: 'response.output_text.delta', item_id: 'message', delta: 'A reply.' },
  { type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'A reply.', annotations: [] }] } },
]
const chatGptEntry = { ...entry, provider: 'openai' as const, endpoint: 'https://api.openai.com/v1', authentication: 'chatgpt' as const, apiKey: 'oauth-secret' }

test('ChatGPT streaming uses stateless Responses, namespaced tools and preserves namespace through tool replies', async () => {
  let calls = 0
  const events: AiChatEvent[] = []
  const request: typeof fetch = async (url, options) => {
    assert.equal(url, `${chatGptEntry.endpoint}/responses`)
    assert.equal(new Headers(options?.headers).get('authorization'), 'Bearer oauth-secret')
    const body = JSON.parse(String(options?.body))
    assert.equal(body.store, false)
    assert.equal(body.stream, true)
    for (const field of ['max_output_tokens', 'previous_response_id']) assert.equal(body[field], undefined)
    assert.equal(body.instructions, aiChatInstructions(input))
    assert.ok(body.input.every((item: { role?: string }) => item.role !== 'system'))
    assert.ok(body.tools.every((tool: { type: string; name: string }) => tool.type === 'namespace' && tool.name === 'nesso'))
    if (++calls === 1) {
      const tool = { type: 'function_call', id: 'function', call_id: 'concepts-call', name: 'concepts', namespace: 'nesso', arguments: '{}', status: 'completed' }
      return responses([
        { type: 'response.output_item.added', output_index: 0, item: tool },
        { type: 'response.output_item.done', output_index: 0, item: tool },
        { type: 'response.completed', response: {} },
      ])
    }
    assert.ok(body.input.some((item: { type: string; namespace: string }) => item.type === 'function_call' && item.namespace === 'nesso'))
    assert.ok(body.input.some((item: { type: string }) => item.type === 'function_call_output'))
    return responses([...messageEvents, { type: 'response.completed', response: {} }])
  }
  const run = createAiChatRun(chatGptEntry, input, (event) => {
    events.push(event)
    if (event.type === 'tool') run.reply({ id: input.id, callId: event.callId, result: { value: { items: [], total: 0, nextOffset: null } } })
  }, request)
  assert.equal(await run.result, true)
  assert.equal(calls, 2)
  assert.deepEqual(events.map(({ type }) => type), ['tool', 'text'])
})

test('ChatGPT usage errors after output are actionable and interrupted streams never count as completed', async () => {
  for (const terminal of ['subscription_sharing_usage_limit_exceeded', 'incomplete', 'interrupted']) {
    const end = terminal === 'interrupted' ? [] : terminal === 'incomplete'
      ? [{ type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } }]
      : [{ type: 'response.failed', sequence_number: 3, response: { error: { code: terminal, message: 'secret provider details' } } }]
    const run = createAiChatRun(chatGptEntry, input, () => {}, async () => responses([...messageEvents, ...end]))
    await assert.rejects(run.result, (error) => error instanceof ElectronError && !error.message.includes('secret')
      && (terminal.startsWith('subscription') ? error.issues[0].path === 'chatgpt.usage' : error.issues[0].path === 'chat'))
  }
})
