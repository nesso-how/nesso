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

export function deserializeGraph(json: string): NessoGraphFile {
  const data: unknown = JSON.parse(json)
  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as Record<string, unknown>).nodes) ||
    !Array.isArray((data as Record<string, unknown>).edges)
  ) {
    throw new Error('Invalid Nesso graph file: missing nodes or edges array')
  }
  return data as NessoGraphFile
}

/** Strip personal FSRS / review history for shareable graph export. Keeps text, elaboration, layout. */
export function nodesForGraphShareExport(
  nodes: Node<ConceptNodeData>[],
): Node<ConceptNodeData>[] {
  const review = defaultConceptReviewFields()
  return nodes.map(node => {
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
export function nodesFromGraphShareImport(
  nodes: Node<ConceptNodeData>[],
): Node<ConceptNodeData>[] {
  return nodesForGraphShareExport(nodes)
}
