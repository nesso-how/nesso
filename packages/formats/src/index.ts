// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings } from '@nesso-how/types'
import { defaultConceptReviewFields } from '@nesso-how/types'

export interface NessoGraphFile {
  /** Internal graph id (desktop sync); omitted in manual exports. */
  id?: string
  /** Last save time (Unix ms); desktop sync metadata. */
  updatedAt?: number
  name: string
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  display?: Partial<GraphDisplaySettings>
}

export function serializeGraph(file: NessoGraphFile): string {
  return JSON.stringify(file, null, 2)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/**
 * Parse and structurally validate a graph file. Files are user-editable (and
 * importable from anywhere), so each element is checked before it can reach
 * the store: a node without a valid id/position crashes the canvas and would
 * then be re-persisted. Partial node data (e.g. hand-written files with only
 * `text`) is normalized with fresh review fields.
 */
export function deserializeGraph(json: string): NessoGraphFile {
  const data: unknown = JSON.parse(json)
  const root = asRecord(data)
  if (!root || !Array.isArray(root.nodes) || !Array.isArray(root.edges)) {
    throw new Error('Invalid Nesso graph file: missing nodes or edges array')
  }
  const review = defaultConceptReviewFields()
  const nodes = root.nodes.map((value, i) => {
    const node = asRecord(value)
    const pos = node ? asRecord(node.position) : null
    if (
      !node ||
      typeof node.id !== 'string' ||
      node.id === '' ||
      !pos ||
      typeof pos.x !== 'number' ||
      !Number.isFinite(pos.x) ||
      typeof pos.y !== 'number' ||
      !Number.isFinite(pos.y)
    ) {
      throw new Error(`Invalid Nesso graph file: node ${i} is missing a valid id or position`)
    }
    const d = asRecord(node.data) ?? {}
    return {
      ...node,
      data: { ...review, ...d, text: typeof d.text === 'string' ? d.text : '' },
    }
  })
  const edges = root.edges.map((value, i) => {
    const edge = asRecord(value)
    if (
      !edge ||
      typeof edge.id !== 'string' ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string'
    ) {
      throw new Error(`Invalid Nesso graph file: edge ${i} is missing id, source or target`)
    }
    return edge
  })
  return { ...root, nodes, edges } as unknown as NessoGraphFile
}

/** Strip personal FSRS / review history for shareable graph export. Keeps text, elaboration, layout. */
export function nodesForGraphShareExport(nodes: Node<ConceptNodeData>[]): Node<ConceptNodeData>[] {
  const review = defaultConceptReviewFields()
  return nodes.map((node) => {
    const { text, elaboration } = node.data ?? { text: '' }
    return {
      ...node,
      data: {
        text: text ?? '',
        ...(elaboration ? { elaboration } : {}),
        ...review,
      },
    }
  })
}

/** Reset review fields on import so shared files never restore someone else's scheduling. */
export function nodesFromGraphShareImport(nodes: Node<ConceptNodeData>[]): Node<ConceptNodeData>[] {
  return nodesForGraphShareExport(nodes)
}
