// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { buildGraphJson } from './lib/graph-tools.js'
import { SERVER_NAME, createNessoServer } from './server.js'

type JsonRpcResponse = {
  id?: number
  result?: Record<string, unknown>
  error?: { message: string }
}

type OutboundMessage = Parameters<InMemoryTransport['send']>[0]

function createTestClient(transport: InMemoryTransport) {
  let nextId = 0
  const pending = new Map<number, (response: JsonRpcResponse) => void>()

  transport.onmessage = (message) => {
    const response = message as JsonRpcResponse
    if (typeof response.id === 'number' && pending.has(response.id)) {
      pending.get(response.id)?.(response)
      pending.delete(response.id)
    }
  }

  return {
    call(method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
      return new Promise((resolve) => {
        const id = nextId + 1
        nextId = id
        pending.set(id, resolve)
        void transport.send({ jsonrpc: '2.0', id, method, params } as OutboundMessage)
      })
    },
    notify(method: string): void {
      void transport.send({ jsonrpc: '2.0', method } as OutboundMessage)
    },
    close(): Promise<void> {
      return transport.close()
    },
  }
}

async function startServer() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createNessoServer('0.0.0-test')
  await server.connect(serverTransport)
  const client = createTestClient(clientTransport)
  const initialize = async (): Promise<JsonRpcResponse> => {
    const response = await client.call('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'contract-test', version: '0.0.0' },
    })
    client.notify('notifications/initialized')
    return response
  }
  return { server, client, initialize }
}

describe('nesso MCP server contract', () => {
  it('advertises the server identity and usage instructions on initialize', async () => {
    const { server, client, initialize } = await startServer()
    try {
      const response = await initialize()
      const serverInfo = response.result?.serverInfo as
        | { name: string; version: string }
        | undefined
      expect(serverInfo?.name).toBe(SERVER_NAME)
      expect(serverInfo?.version).toBe('0.0.0-test')
      const instructions = response.result?.instructions
      expect(typeof instructions).toBe('string')
      expect(instructions).toContain('get_relation_types')
      expect(instructions).toContain('validate_graph')
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('registers the four tools with output schemas on the data tools', async () => {
    const { server, client, initialize } = await startServer()
    try {
      await initialize()
      const response = await client.call('tools/list', {})
      const tools = response.result?.tools as Array<{ name: string; outputSchema?: unknown }>
      expect(tools.map((tool) => tool.name).sort()).toEqual([
        'build_graph',
        'get_nesso_docs',
        'get_relation_types',
        'validate_graph',
      ])
      const withOutputSchema = tools
        .filter((tool) => tool.outputSchema !== undefined)
        .map((tool) => tool.name)
      expect(withOutputSchema.sort()).toEqual(['get_relation_types', 'validate_graph'])
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('returns structured content for get_relation_types', async () => {
    const { server, client, initialize } = await startServer()
    try {
      await initialize()
      const response = await client.call('tools/call', {
        name: 'get_relation_types',
        arguments: {},
      })
      const structured = response.result?.structuredContent as
        | { categories: Array<{ category: string; types: unknown[] }> }
        | undefined
      expect(structured?.categories).toHaveLength(8)
      expect(structured?.categories[0]?.category).toBe('taxonomic')
      const text = (response.result?.content as Array<{ text: string }>)[0]?.text
      expect(structured).toEqual({ categories: JSON.parse(text) })
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('returns structured content for validate_graph', async () => {
    const { server, client, initialize } = await startServer()
    try {
      await initialize()
      const graphJson = buildGraphJson({
        name: 'Contract test graph',
        concepts: ['Photosynthesis', 'Glucose'],
        relations: [{ from: 'Photosynthesis', to: 'Glucose', relation: 'produces' }],
      })

      const valid = await client.call('tools/call', {
        name: 'validate_graph',
        arguments: { graph: graphJson },
      })
      const validStructured = valid.result?.structuredContent as
        | { valid: boolean; errors: unknown[] }
        | undefined
      expect(validStructured?.valid).toBe(true)
      expect(validStructured?.errors).toEqual([])

      const invalid = await client.call('tools/call', {
        name: 'validate_graph',
        arguments: { graph: 'not json' },
      })
      const invalidStructured = invalid.result?.structuredContent as
        | { valid: boolean; errors: Array<{ path: string; message: string }> }
        | undefined
      expect(invalidStructured?.valid).toBe(false)
      expect(invalidStructured?.errors.length).toBeGreaterThan(0)
    } finally {
      await client.close()
      await server.close()
    }
  })
})
