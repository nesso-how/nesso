import assert from 'node:assert/strict'
import test from 'node:test'
import { request } from 'node:http'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { aiMcpTools, aiTools } from '@nesso-how/ai'
import { startMcpServer } from './mcp-server.ts'

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
})
const call = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'context', arguments: {} },
}
const token = '1'.repeat(64)

test('MCP authenticates local requests and exposes validated tools with host results and errors', async (t) => {
  const calls: unknown[] = []
  const server = await startMcpServer(
    async (name, input) => {
      calls.push({ name, input })
      return name === 'history'
        ? { issues: [{ path: 'mcp', message: 'Rejected by host' }] }
        : { value: { status: 'applied' } }
    },
    'test',
    token,
    0,
  )
  t.after(() => server.close())
  for (const [override, status, body = JSON.stringify(call)] of [
    [{ Authorization: '' }, 401],
    [{ Authorization: `Bearer ${'0'.repeat(64)}` }, 401],
    [{ Origin: 'https://evil.example' }, 403],
    [{ Host: 'evil.example' }, 403],
    [{}, 413, 'x'.repeat(1_048_577)],
  ] as const) {
    const actual = await new Promise<number>((resolve, reject) => {
      const req = request(
        server.state.url,
        { method: 'POST', headers: { ...headers(token), ...override } },
        (response) => {
          response.resume()
          resolve(response.statusCode!)
        },
      )
      req.on('error', reject)
      req.end(body)
    })
    assert.equal(actual, status)
  }
  assert.equal(calls.length, 0)
  const client = new Client({ name: 'test', version: '1' })
  t.after(() => client.close())
  await client.connect(
    new StreamableHTTPClientTransport(new URL(server.state.url), {
      requestInit: { headers: headers(server.token) },
    }),
  )
  const { tools } = await client.listTools()
  assert.deepEqual(
    tools.map(({ name }) => name).sort(),
    Object.keys({ ...aiTools, ...aiMcpTools }).sort(),
  )
  assert.equal(tools.find(({ name }) => name === 'read_docs')?.annotations?.readOnlyHint, true)
  assert.deepEqual(tools.find(({ name }) => name === 'read_docs')?.inputSchema.properties?.topic, {
    type: 'string',
    enum: aiTools.read_docs.inputSchema.shape.topic.options,
  })
  const read = await client.callTool({ name: 'concepts', arguments: { query: 'One' } })
  assert.deepEqual(read.content, [{ type: 'text', text: '{"status":"applied"}' }])
  assert.deepEqual(calls[0], {
    name: 'concepts',
    input: aiTools.concepts.inputSchema.parse({ query: 'One' }),
  })
  const rejected = await client.callTool({ name: 'history', arguments: { action: 'undo' } })
  assert.equal(rejected.isError, true)
  const invalid = await client.callTool({
    name: 'edit',
    arguments: { operations: [{ kind: 'document.reset', id: 'urn:fresh' }] },
  })
  assert.equal(invalid.isError, true)
  const invalidDocs = await client.callTool({
    name: 'read_docs',
    arguments: { topic: '../../packages/plugin/README.md' },
  })
  assert.equal(invalidDocs.isError, true)
  assert.equal(calls.length, 2)
})

test('MCP plugin proposals forward only the package entry read from its directory', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'nesso-mcp-plugin-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const directory = path.join(root, 'theme')
  await mkdir(path.join(directory, 'dist'), { recursive: true })
  await mkdir(path.join(directory, 'fonts'))
  const definition = await readFile('packages/plugin/test/theme.json', 'utf8')
  const manifest = {
    name: 'nesso-plugin-theme',
    version: '1.0.0',
    nesso: {
      apiVersion: 3,
      kind: 'theme',
      entry: 'dist/definition.json',
      writes: [],
      capabilities: [],
    },
  }
  await writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest))
  await writeFile(path.join(directory, 'dist/definition.json'), definition)
  await writeFile(path.join(directory, 'fonts/a.woff2'), 'wOF2')
  await writeFile(path.join(directory, 'fonts/unused.woff2'), 'wOF2')
  await writeFile(path.join(root, 'outside.woff2'), 'wOF2')
  const calls: unknown[] = []
  const server = await startMcpServer(
    async (name, input) => {
      calls.push({ name, input })
      return { value: { status: 'cancelled' } }
    },
    'test',
    token,
    0,
  )
  t.after(() => server.close())
  const client = new Client({ name: 'test', version: '1' })
  t.after(() => client.close())
  await client.connect(
    new StreamableHTTPClientTransport(new URL(server.state.url), {
      requestInit: { headers: headers(server.token) },
    }),
  )
  const propose = async (target: string) =>
    JSON.parse(
      (
        (await client.callTool({ name: 'propose_plugin', arguments: { directory: target } }))
          .content as { text: string }[]
      )[0].text,
    )
  assert.deepEqual(await propose(directory), { status: 'cancelled' })
  const bytes = (text: string) => new Uint8Array(Buffer.from(text))
  assert.deepEqual(calls, [
    {
      name: 'propose_plugin',
      input: {
        package: {
          manifest,
          files: [{ path: 'dist/definition.json', bytes: bytes(definition) }],
        },
      },
    },
  ])
  await rm(path.join(directory, 'dist/definition.json'))
  await symlink(path.join(root, 'outside.woff2'), path.join(directory, 'dist/definition.json'))
  for (const [target, issue] of [
    ['theme', { path: 'directory', message: 'Expected the absolute path of a package directory' }],
    [
      directory,
      { path: 'dist/definition.json', message: 'Expected a file inside the package directory' },
    ],
  ] as const)
    assert.deepEqual(await propose(target), { status: 'failed', issues: [issue] })
  assert.equal(calls.length, 1)
})

test(
  'MCP cancellation, disconnect and shutdown abort pending host requests',
  { timeout: 5000 },
  async (t) => {
    for (const action of ['cancel', 'disconnect', 'stop']) {
      const started = Promise.withResolvers<void>()
      const aborted = Promise.withResolvers<void>()
      const server = await startMcpServer(
        async (_name, _input, signal) => {
          if (_name === 'selection') return { value: {} }
          started.resolve()
          return new Promise((resolve) =>
            signal.addEventListener(
              'abort',
              () => {
                aborted.resolve()
                resolve({ issues: [{ path: 'mcp', message: 'Cancelled' }] })
              },
              { once: true },
            ),
          )
        },
        'test',
        token,
        0,
      )
      t.after(() => server.close())
      const client = new Client({ name: 'test', version: '1' })
      t.after(() => client.close())
      await client.connect(
        new StreamableHTTPClientTransport(new URL(server.state.url), {
          requestInit: { headers: headers(server.token) },
        }),
      )
      const controller = new AbortController()
      const response = client
        .callTool({ name: 'context', arguments: {} }, undefined, { signal: controller.signal })
        .catch(() => null)
      await started.promise
      if (action === 'cancel') controller.abort()
      else if (action === 'disconnect') await client.close()
      else await server.close()
      await aborted.promise
      await response
      if (action === 'cancel')
        assert.equal((await client.callTool({ name: 'selection', arguments: {} })).isError, false)
      await client.close()
      if (action !== 'stop') await server.close()
    }
  },
)
