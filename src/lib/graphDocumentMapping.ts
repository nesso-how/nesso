// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings, NessoGraphDocumentInput } from '@/types/graph'
import { VOCABULARY } from '@/types/graph'
import type { NessoEdgeData } from '@nesso-how/graph'

function relationCurveData(edgeData: NessoEdgeData | undefined):
  | {
      curveOffset?: number
      sourceAttachment?: { x: number; y: number }
      targetAttachment?: { x: number; y: number }
      curveAnchor?: { x: number; y: number; t: number }
    }
  | undefined {
  if (!edgeData) return undefined
  const data: {
    curveOffset?: number
    sourceAttachment?: { x: number; y: number }
    targetAttachment?: { x: number; y: number }
    curveAnchor?: { x: number; y: number; t: number }
  } = {}
  if (edgeData.curveOffset !== undefined) data.curveOffset = edgeData.curveOffset
  if (edgeData.sourceAttachment !== undefined) data.sourceAttachment = edgeData.sourceAttachment
  if (edgeData.targetAttachment !== undefined) data.targetAttachment = edgeData.targetAttachment
  if (edgeData.curveAnchor !== undefined) data.curveAnchor = edgeData.curveAnchor
  return Object.keys(data).length > 0 ? data : undefined
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
