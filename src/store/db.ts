// SPDX-License-Identifier: MIT
import { openDB } from 'idb'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'

export interface GraphRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  viewport?: { x: number; y: number; zoom: number }
}

const db = openDB<{ graphs: GraphRecord }>('nesso-graphs', 1, {
  upgrade(db) {
    db.createObjectStore('graphs', { keyPath: 'id' })
  },
})

export async function dbSaveGraph(record: GraphRecord) {
  return (await db).put('graphs', record)
}

export async function dbLoadGraph(id: string): Promise<GraphRecord | undefined> {
  return (await db).get('graphs', id)
}

export async function dbListGraphs(): Promise<GraphRecord[]> {
  return (await db).getAll('graphs')
}

export async function dbDeleteGraph(id: string) {
  return (await db).delete('graphs', id)
}
