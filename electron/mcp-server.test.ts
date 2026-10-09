import assert from 'node:assert/strict'
import test from 'node:test'
import { request } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { aiTools } from '@nesso/ai'
import { startMcpServer } from './mcp-server.ts'

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' })
const call = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'context', arguments: {} } }
const token = '1'.repeat(64)

test('MCP authenticates local requests and exposes validated tools with host results and errors', async (t) => {
  const calls: unknown[] = []
  const server = await startMcpServer(async (name, input) => {
    calls.push({ name, input })
    return name === 'history' ? { issues: [{ path: 'mcp', message: 'Rejected by host' }] } : { value: { status: 'applied' } }
  }, 'test', token, 0)
  t.after(() => server.close())
  for (const [override, status, body = JSON.stringify(call)] of [
    [{ Authorization: '' }, 401], [{ Authorization: `Bearer ${'0'.repeat(64)}` }, 401],
    [{ Origin: 'https://evil.example' }, 403], [{ Host: 'evil.example' }, 403],
    [{}, 413, 'x'.repeat(1_048_577)],
  ] as const) {
    const actual = await new Promise<number>((resolve, reject) => {
      const req = request(server.state.url, { method: 'POST', headers: { ...headers(token), ...override } }, (response) => {
        response.resume()
        resolve(response.statusCode!)
      })
      req.on('error', reject)
      req.end(body)
    })
    assert.equal(actual, status)
  }
  assert.equal(calls.length, 0)
  const client = new Client({ name: 'test', version: '1' })
  t.after(() => client.close())
  await client.connect(new StreamableHTTPClientTransport(new URL(server.state.url), { requestInit: { headers: headers(server.token) } }))
  const { tools } = await client.listTools()
  assert.deepEqual(tools.map(({ name }) => name).sort(), Object.keys(aiTools).sort())
  const read = await client.callTool({ name: 'concepts', arguments: { query: 'One' } })
  assert.deepEqual(read.content, [{ type: 'text', text: '{"status":"applied"}' }])
  assert.deepEqual(calls[0], { name: 'concepts', input: aiTools.concepts.inputSchema.parse({ query: 'One' }) })
  const rejected = await client.callTool({ name: 'history', arguments: { action: 'undo' } })
  assert.equal(rejected.isError, true)
  const invalid = await client.callTool({ name: 'edit', arguments: { operations: [{ kind: 'document.reset', id: 'urn:fresh' }] } })
  assert.equal(invalid.isError, true)
  assert.equal(calls.length, 2)
})

test('MCP cancellation, disconnect and shutdown abort pending host requests', { timeout: 5000 }, async (t) => {
  for (const action of ['cancel', 'disconnect', 'stop']) {
    const started = Promise.withResolvers<void>()
    const aborted = Promise.withResolvers<void>()
    const server = await startMcpServer(async (_name, _input, signal) => {
      if (_name === 'selection') return { value: {} }
      started.resolve()
      return new Promise((resolve) => signal.addEventListener('abort', () => { aborted.resolve(); resolve({ issues: [{ path: 'mcp', message: 'Cancelled' }] }) }, { once: true }))
    }, 'test', token, 0)
    t.after(() => server.close())
    const client = new Client({ name: 'test', version: '1' })
    t.after(() => client.close())
    await client.connect(new StreamableHTTPClientTransport(new URL(server.state.url), { requestInit: { headers: headers(server.token) } }))
    const controller = new AbortController()
    const response = client.callTool({ name: 'context', arguments: {} }, undefined, { signal: controller.signal }).catch(() => null)
    await started.promise
    if (action === 'cancel') controller.abort()
    else if (action === 'disconnect') await client.close()
    else await server.close()
    await aborted.promise
    await response
    if (action === 'cancel') assert.equal((await client.callTool({ name: 'selection', arguments: {} })).isError, false)
    await client.close()
    if (action !== 'stop') await server.close()
  }
})
