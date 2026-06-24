// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type {
  ConceptNodeData,
  GraphDisplaySettings,
  LearningNodeParams,
  NessoGraphDocument,
  NessoGraphDocumentInput,
} from '@/types/graph'
import { VOCABULARY } from '@/types/graph'
import type { NessoEdgeData } from '@nesso-how/graph'
import { documentToRenderGraph } from '@nesso-how/graph'
import { mergeReviewIntoNode } from '@/lib/graphContent'

function relationCurveData(
  edgeData: NessoEdgeData | undefined,
): { curveFlip?: boolean; curveFlipPinned?: boolean } | undefined {
  const curveFlip = edgeData?.curveFlip
  const curveFlipPinned = edgeData?.curveFlipPinned
  if (curveFlip === undefined && curveFlipPinned === undefined) return undefined
  return {
    ...(curveFlip !== undefined ? { curveFlip } : {}),
    ...(curveFlipPinned !== undefined ? { curveFlipPinned } : {}),
  }
}

function relationFromEdge(e: Edge) {
  const edgeData = e.data as NessoEdgeData | undefined
  const data = relationCurveData(edgeData)
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    type: edgeData?.type,
    ...(data !== undefined ? { data } : {}),
  }
}

export function documentToGraphFromReviews(
  doc: NessoGraphDocument,
  reviews: Map<string, LearningNodeParams>,
): { nodes: Node<ConceptNodeData>[]; edges: Edge[]; display?: Partial<GraphDisplaySettings> } {
  const { nodes, edges, display } = documentToRenderGraph(doc)
  return {
    nodes: nodes.map((n) => mergeReviewIntoNode(n, reviews.get(n.id))),
    edges,
    display,
  }
}

export function graphToDocument(input: {
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  display: GraphDisplaySettings
  name: string
  id?: string
  updatedAt?: number
}): NessoGraphDocumentInput<{ display: GraphDisplaySettings }> {
  const { nodes, edges, display, name, id, updatedAt } = input
  return {
    vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
    ...(id !== undefined && { id }),
    ...(updatedAt !== undefined && { updatedAt }),
    name,
    concepts: nodes.map((n) => ({
      id: n.id,
      label: n.data.text,
      x: n.position.x,
      y: n.position.y,
      ...(n.data.elaboration !== undefined && {
        data: { elaboration: n.data.elaboration },
      }),
    })),
    relations: edges.map(relationFromEdge),
    meta: { display },
  }
}
