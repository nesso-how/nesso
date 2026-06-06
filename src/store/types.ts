// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'

export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | null

export type Viewport = { x: number; y: number; zoom: number }

export type GraphSnapshot = { nodes: Node<ConceptNodeData>[]; edges: Edge[] }

export interface GraphMeta {
  id: string
  name: string
  updatedAt: number
}
