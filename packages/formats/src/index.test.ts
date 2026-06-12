// SPDX-License-Identifier: MIT
import type { Edge, Node } from '@xyflow/react'
import type { ConceptNodeData } from '@nesso-how/types'
import { defaultConceptReviewFields } from '@nesso-how/types'
import { describe, expect, it } from 'vitest'
import {
  deserializeGraph,
  nodesForGraphShareExport,
  serializeGraph,
  type NessoGraphFile,
} from './index.js'

function makeNode(id: string, data?: Partial<ConceptNodeData>): Node<ConceptNodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { text: id, ...defaultConceptReviewFields(), ...data },
  }
}

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'nesso', data: { type: 'causes' } }
}

describe('serializeGraph / deserializeGraph', () => {
  it('round-trips a valid graph file', () => {
    const file: NessoGraphFile = {
      name: 'Demo',
      nodes: [makeNode('n1'), makeNode('n2')],
      edges: [makeEdge('e1', 'n1', 'n2')],
    }
    const parsed = deserializeGraph(serializeGraph(file))
    expect(parsed.name).toBe('Demo')
    expect(parsed.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(parsed.edges).toEqual(file.edges)
  })

  it('produces pretty-printed JSON', () => {
    const json = serializeGraph({ name: 'X', nodes: [], edges: [] })
    expect(json).toContain('\n')
    expect(JSON.parse(json)).toMatchObject({ name: 'X' })
  })

  it('normalizes partial node data with fresh review fields and a string text', () => {
    const json = JSON.stringify({
      name: 'Hand-written',
      nodes: [{ id: 'n1', position: { x: 1, y: 2 }, data: { text: 'hi' } }],
      edges: [],
    })
    const node = deserializeGraph(json).nodes[0]
    expect(node.data).toMatchObject({ text: 'hi', ...defaultConceptReviewFields() })
  })

  it('coerces a non-string text to an empty string', () => {
    const json = JSON.stringify({
      name: 'X',
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { text: 42 } }],
      edges: [],
    })
    expect(deserializeGraph(json).nodes[0].data.text).toBe('')
  })
})

describe('deserializeGraph validation', () => {
  it('rejects a file missing the nodes/edges arrays', () => {
    expect(() => deserializeGraph('{}')).toThrow(/missing nodes or edges/)
    expect(() => deserializeGraph(JSON.stringify({ nodes: [] }))).toThrow(/missing nodes or edges/)
  })

  it('rejects a node without a valid id or position', () => {
    const noId = JSON.stringify({ nodes: [{ position: { x: 0, y: 0 } }], edges: [] })
    expect(() => deserializeGraph(noId)).toThrow(/node 0 is missing a valid id or position/)

    const nanPos = JSON.stringify({
      nodes: [{ id: 'n1', position: { x: Number.NaN, y: 0 } }],
      edges: [],
    })
    expect(() => deserializeGraph(nanPos)).toThrow(/node 0 is missing a valid id or position/)
  })

  it('rejects an edge missing id, source or target', () => {
    const json = JSON.stringify({
      nodes: [{ id: 'n1', position: { x: 0, y: 0 } }],
      edges: [{ id: 'e1', source: 'n1' }],
    })
    expect(() => deserializeGraph(json)).toThrow(/edge 0 is missing id, source or target/)
  })
})

describe('nodesForGraphShareExport', () => {
  it('resets personal review history while keeping text and elaboration', () => {
    const reviewed = makeNode('n1', {
      stability: 99,
      reps: 7,
      lastRating: 4,
      elaboration: { definition: 'd', examples: 'e', notes: 'n' },
    })
    const [stripped] = nodesForGraphShareExport([reviewed])
    expect(stripped.data).toMatchObject({
      text: 'n1',
      ...defaultConceptReviewFields(),
      elaboration: { definition: 'd', examples: 'e', notes: 'n' },
    })
    expect(stripped.data.stability).toBe(0)
    expect(stripped.data.reps).toBe(0)
    expect(stripped.data.lastRating).toBe(0)
  })

  it('omits the elaboration key when there is none', () => {
    const [stripped] = nodesForGraphShareExport([makeNode('n1')])
    expect('elaboration' in stripped.data).toBe(false)
  })
})
