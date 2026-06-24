// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, NessoGraphDocumentInput } from '@nesso-how/vocab-learning'
import { defaultConceptReviewFields } from '@nesso-how/vocab-learning'
import type { NessoEdgeData, GraphDisplaySettings } from './display.js'

function edgeDataFromRelation(r: NessoGraphDocumentInput['relations'][number]): NessoEdgeData {
  return {
    type: r.type as NessoEdgeData['type'],
    ...(r.data?.curveFlip !== undefined ? { curveFlip: r.data.curveFlip } : {}),
    ...(r.data?.curveFlipPinned !== undefined ? { curveFlipPinned: r.data.curveFlipPinned } : {}),
  }
}

function relationToEdge(r: NessoGraphDocumentInput['relations'][number]): Edge<NessoEdgeData> {
  return {
    id: r.id,
    source: r.source,
    target: r.target,
    sourceHandle: 'out',
    targetHandle: 'in',
    type: 'nesso',
    data: edgeDataFromRelation(r),
  }
}

/** Convert a Nesso graph document to React Flow nodes/edges for rendering (no FSRS). */
export function documentToRenderGraph(doc: NessoGraphDocumentInput): {
  nodes: Node<ConceptNodeData>[]
  edges: Edge<NessoEdgeData>[]
  display?: Partial<GraphDisplaySettings>
} {
  const fsrsDefaults = defaultConceptReviewFields()
  const nodes: Node<ConceptNodeData>[] = doc.concepts.map((c) => ({
    id: c.id,
    type: 'concept',
    position: { x: c.x, y: c.y },
    data: {
      ...fsrsDefaults,
      text: c.label,
      ...(c.data?.elaboration !== undefined && { elaboration: c.data.elaboration }),
    },
  }))
  const edges: Edge<NessoEdgeData>[] = doc.relations.map(relationToEdge)
  const meta = doc.meta as { display?: Partial<GraphDisplaySettings> } | undefined
  return { nodes, edges, display: meta?.display }
}
