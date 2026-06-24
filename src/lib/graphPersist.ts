// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings } from '@/types/graph'
import { extractReviewParams, nodeContentFingerprintData } from '@/lib/graphContent'

export function stripNodeSelection(n: Node<ConceptNodeData>): Node<ConceptNodeData> {
  const { selected: _s, ...rest } = n
  return rest as Node<ConceptNodeData>
}

export function stripEdgeSelection(e: Edge): Edge {
  const { selected: _s, ...rest } = e
  return rest
}

/** Persistable graph payload — node data excludes FSRS (lives in review store). */
export function graphContentPayload(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  display: GraphDisplaySettings,
) {
  return {
    nodes: nodes.map((n) => ({
      ...stripNodeSelection(n),
      data: nodeContentFingerprintData(n.data) as ConceptNodeData,
    })),
    edges: edges.map(stripEdgeSelection),
    display,
  }
}

export function graphContentFingerprint(
  nodes: Node<ConceptNodeData>[],
  edges: Edge[],
  display: GraphDisplaySettings,
): string {
  return JSON.stringify(graphContentPayload(nodes, edges, display))
}

/**
 * Fingerprint of only the personal review (FSRS) state, keyed by node id.
 * Independent of {@link graphContentFingerprint} so a review-only change is
 * detected and persisted to the review store without rewriting the shared
 * content file. Sorted by id so node reordering never registers as a change.
 */
export function reviewStateFingerprint(nodes: Node<ConceptNodeData>[]): string {
  const entries = nodes.map((n) => [n.id, extractReviewParams(n.data)] as const)
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return JSON.stringify(entries)
}

export function graphPersistEquals(
  a: { nodes: Node<ConceptNodeData>[]; edges: Edge[]; display: GraphDisplaySettings },
  b: { nodes: Node<ConceptNodeData>[]; edges: Edge[]; display: GraphDisplaySettings },
): boolean {
  return (
    graphContentFingerprint(a.nodes, a.edges, a.display) ===
    graphContentFingerprint(b.nodes, b.edges, b.display)
  )
}
