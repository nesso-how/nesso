// SPDX-License-Identifier: MIT
import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import {
  deserializeGraph,
  GRAPH_FORMAT_VERSION,
  serializeGraph,
  stripPrivateNodeParams,
  type NessoGraphFileInput,
} from './index.js'

type TestNodeData = { text: string; score?: number; flag?: boolean }

function makeNode(id: string, data?: Partial<TestNodeData>): Node<TestNodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { text: id, ...data },
  }
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'nesso', data: { type: 'causes' } }
}

describe('serializeGraph / deserializeGraph', () => {
  it('round-trips a valid graph file', () => {
    const file: NessoGraphFileInput<TestNodeData> = {
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      name: 'Demo',
      nodes: [makeNode('n1'), makeNode('n2')],
      edges: [makeEdge('e1', 'n1', 'n2')],
    }
    const parsed = deserializeGraph<TestNodeData>(serializeGraph(file))
    expect(parsed.version).toBe(GRAPH_FORMAT_VERSION)
    expect(parsed.vocabulary).toEqual({ id: '@nesso-how/vocab-learning', version: '0.1.0' })
    expect(parsed.name).toBe('Demo')
    expect(parsed.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(parsed.edges).toEqual(file.edges)
  })

  it('produces pretty-printed JSON with version as the first key', () => {
    const json = serializeGraph({ name: 'X', nodes: [], edges: [] })
    expect(json).toContain('\n')
    const parsed = JSON.parse(json)
    expect(parsed).toMatchObject({ version: GRAPH_FORMAT_VERSION, name: 'X' })
    expect(Object.keys(parsed)[0]).toBe('version')
  })

  it('writes vocabulary after version when present', () => {
    const json = serializeGraph({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      name: 'X',
      nodes: [],
      edges: [],
    })
    const keys = Object.keys(JSON.parse(json))
    expect(keys.slice(0, 2)).toEqual(['version', 'vocabulary'])
  })

  it('emits optional envelope keys in stable order when present', () => {
    const json = serializeGraph({
      vocabulary: { id: '@nesso-how/vocab-learning', version: '0.1.0' },
      id: 'g1',
      updatedAt: 42,
      name: 'X',
      nodes: [],
      edges: [],
      display: {},
    })
    const parsed = JSON.parse(json)
    expect(Object.keys(parsed)).toEqual([
      'version',
      'vocabulary',
      'id',
      'updatedAt',
      'name',
      'nodes',
      'edges',
      'display',
    ])
    expect(parsed).toMatchObject({ id: 'g1', updatedAt: 42, display: {} })
  })

  it('defaults missing version to the current format version', () => {
    const json = JSON.stringify({ name: 'Old', nodes: [], edges: [] })
    expect(deserializeGraph(json).version).toBe(GRAPH_FORMAT_VERSION)
  })

  it('throws on an unsupported version', () => {
    const json = JSON.stringify({ version: 99, name: 'Future', nodes: [], edges: [] })
    expect(() => deserializeGraph(json)).toThrow(/Unsupported Nesso graph file version: 99/)
  })

  it('returns node data as-is without vocabulary-specific normalization', () => {
    const json = JSON.stringify({
      name: 'Hand-written',
      nodes: [{ id: 'n1', position: { x: 1, y: 2 }, data: { text: 'hi' } }],
      edges: [],
    })
    const node = deserializeGraph(json).nodes[0]
    expect(node.data).toEqual({ text: 'hi' })
  })
})

describe('deserializeGraph validation', () => {
  it('rejects a file missing the nodes/edges arrays', () => {
    expect(() => deserializeGraph('{}')).toThrow(/missing nodes or edges/)
    expect(() => deserializeGraph(JSON.stringify({ nodes: [] }))).toThrow(/missing nodes or edges/)
  })

  it('rejects a non-object root', () => {
    expect(() => deserializeGraph('null')).toThrow(/missing nodes or edges/)
    expect(() => deserializeGraph('42')).toThrow(/missing nodes or edges/)
  })

  it('rejects a node entry that is not an object', () => {
    const json = JSON.stringify({ nodes: ['oops'], edges: [] })
    expect(() => deserializeGraph(json)).toThrow(/node 0 is missing a valid id or position/)
  })

  it('rejects a node without a valid id or position', () => {
    const noId = JSON.stringify({ nodes: [{ position: { x: 0, y: 0 } }], edges: [] })
    expect(() => deserializeGraph(noId)).toThrow(/node 0 is missing a valid id or position/)

    const emptyId = JSON.stringify({ nodes: [{ id: '', position: { x: 0, y: 0 } }], edges: [] })
    expect(() => deserializeGraph(emptyId)).toThrow(/node 0 is missing a valid id or position/)

    const nanPos = JSON.stringify({
      nodes: [{ id: 'n1', position: { x: Number.NaN, y: 0 } }],
      edges: [],
    })
    expect(() => deserializeGraph(nanPos)).toThrow(/node 0 is missing a valid id or position/)
  })

  it('rejects an edge that is not an object or is missing id, source or target', () => {
    const base = { nodes: [{ id: 'n1', position: { x: 0, y: 0 } }] }
    const cases = [
      [null],
      [{ source: 'n1', target: 'n1' }],
      [{ id: 'e1', target: 'n1' }],
      [{ id: 'e1', source: 'n1' }],
    ]
    for (const edges of cases) {
      const json = JSON.stringify({ ...base, edges })
      expect(() => deserializeGraph(json)).toThrow(/edge 0 is missing id, source or target/)
    }
  })
})

describe('stripPrivateNodeParams', () => {
  it('overwrites declared private defaults on each node', () => {
    const nodes = [makeNode('n1', { score: 99, flag: true })]
    const [stripped] = stripPrivateNodeParams(nodes, { score: 0, flag: false })
    expect(stripped.data).toMatchObject({ text: 'n1', score: 0, flag: false })
  })

  it('preserves non-default fields not listed in privateDefaults', () => {
    const nodes = [makeNode('n1', { score: 99 })]
    const [stripped] = stripPrivateNodeParams(nodes, { score: 0 })
    expect(stripped.data.text).toBe('n1')
    expect(stripped.data.score).toBe(0)
  })
})
