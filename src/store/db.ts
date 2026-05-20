// SPDX-License-Identifier: MIT
import { deleteDB, openDB } from 'idb'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import type { GraphDisplaySettings } from '@/types/graph'
import { GRAPHS_DB_NAME } from '@/data/storageKeys'

export interface GraphRecord {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  nodes: Node<ConceptNodeData>[]
  edges: Edge[]
  display?: GraphDisplaySettings
}

const db = openDB<{ graphs: GraphRecord }>(GRAPHS_DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore('graphs', { keyPath: 'id' })
  },
})

/** Close the open DB handle and remove the IndexedDB database (e.g. factory reset). Caller should reload the page. */
export async function wipeGraphsIndexedDb(): Promise<void> {
  const conn = await db
  conn.close()
  await deleteDB(GRAPHS_DB_NAME)
}

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
