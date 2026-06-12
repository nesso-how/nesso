// SPDX-License-Identifier: MIT
import type { Edge, Node } from '@xyflow/react'
import { defaultConceptReviewFields, type ConceptNodeData } from '@/types/graph'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  advanceClipboardAfterPaste,
  getGraphClipboard,
  instantiateClipboard,
  setGraphClipboard,
  snapshotSelection,
  type GraphClipboard,
} from './graphClipboard'

function node(id: string, x = 0, y = 0): Node<ConceptNodeData> {
  return { id, position: { x, y }, data: { text: id, ...defaultConceptReviewFields() } }
}

function edge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'nesso', data: { type: 'causes' } }
}

const nodes = [node('n1'), node('n2'), node('n3')]
const edges = [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3')]

beforeEach(() => setGraphClipboard(null))

describe('snapshotSelection', () => {
  it('captures selected nodes plus the edges fully internal to them', () => {
    const snap = snapshotSelection({
      nodes,
      edges,
      selected: null,
      selectedIds: ['n1', 'n2'],
    })
    expect(snap?.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(snap?.edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('for an edge-only selection, pulls in the edge endpoints', () => {
    const snap = snapshotSelection({
      nodes,
      edges,
      selected: { kind: 'edge', id: 'e1' },
      selectedIds: [],
    })
    expect(snap?.nodes.map((n) => n.id).sort()).toEqual(['n1', 'n2'])
    expect(snap?.edges.map((e) => e.id)).toEqual(['e1'])
  })

  it('strips the selected flag from snapshotted nodes and edges', () => {
    const snap = snapshotSelection({
      nodes: [{ ...node('n1'), selected: true }],
      edges: [],
      selected: { kind: 'node', id: 'n1' },
      selectedIds: ['n1'],
    })
    expect('selected' in (snap?.nodes[0] ?? {})).toBe(false)
  })

  it('returns null when nothing is selected', () => {
    expect(snapshotSelection({ nodes, edges, selected: null, selectedIds: [] })).toBeNull()
  })
})

describe('instantiateClipboard', () => {
  const clip: GraphClipboard = {
    nodes: [node('n1', 10, 10), node('n2', 20, 20)],
    edges: [edge('e1', 'n1', 'n2')],
  }

  it('assigns fresh ids, remaps edge endpoints, and offsets positions', () => {
    const { nodes: out, edges: outEdges } = instantiateClipboard(clip, new Set(), new Set())
    expect(out.map((n) => n.id)).not.toEqual(['n1', 'n2'])
    expect(out.every((n) => n.id.startsWith('n'))).toBe(true)
    expect(out[0].position).toEqual({ x: 58, y: 58 })
    expect(out.every((n) => n.selected)).toBe(true)

    // The pasted edge points at the remapped node ids, not the originals.
    const ids = out.map((n) => n.id)
    expect(ids).toContain(outEdges[0].source)
    expect(ids).toContain(outEdges[0].target)
    expect(outEdges[0].type).toBe('nesso')
    expect(outEdges[0].selected).toBe(false)
  })

  it('avoids ids already present in the used sets', () => {
    const used = new Set(['n1', 'n2'])
    const { nodes: out } = instantiateClipboard(clip, used, new Set())
    for (const n of out) expect(['n1', 'n2']).not.toContain(n.id)
  })
})

describe('advanceClipboardAfterPaste', () => {
  it('cascades clipboard node positions so a repeat paste does not stack', () => {
    setGraphClipboard({ nodes: [node('n1', 0, 0)], edges: [] })
    advanceClipboardAfterPaste()
    expect(getGraphClipboard()?.nodes[0].position).toEqual({ x: 48, y: 48 })
  })

  it('is a no-op when the clipboard is empty', () => {
    setGraphClipboard(null)
    advanceClipboardAfterPaste()
    expect(getGraphClipboard()).toBeNull()
  })
})
