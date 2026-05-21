// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings } from '@/types/graph'

export function stripNodeSelection(n: Node<ConceptNodeData>): Node<ConceptNodeData> {
  const { selected: _s, ...rest } = n
  return rest as Node<ConceptNodeData>
}

export function stripEdgeSelection(e: Edge): Edge {
  const { selected: _s, ...rest } = e
  return rest
}

export function graphPersistPayload(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  display: GraphDisplaySettings,
) {
  return {
    nodes: nodes.map(stripNodeSelection),
    edges: edges.map(stripEdgeSelection),
    display,
  }
}

export function graphPersistFingerprint(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  display: GraphDisplaySettings,
): string {
  return JSON.stringify(graphPersistPayload(nodes, edges, display))
}

export function graphPersistEquals(
  a: { nodes: Node<ConceptNodeData>[]; edges: Edge[]; display: GraphDisplaySettings },
  b: { nodes: Node<ConceptNodeData>[]; edges: Edge[]; display: GraphDisplaySettings },
): boolean {
  return graphPersistFingerprint(a.nodes, a.edges, a.display)
    === graphPersistFingerprint(b.nodes, b.edges, b.display)
}
