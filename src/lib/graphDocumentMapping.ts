// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings, NessoGraphDocumentInput } from '@/types/graph'
import { VOCABULARY } from '@/types/graph'
import type { NessoEdgeData } from '@nesso-how/graph'

function relationCurveData(
  edgeData: NessoEdgeData | undefined,
): { curveOffset?: number } | undefined {
  const curveOffset = edgeData?.curveOffset
  if (curveOffset === undefined) return undefined
  return { curveOffset }
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
