// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings } from '@nesso-how/types'

export interface NessoGraphFile {
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
