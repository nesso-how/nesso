// SPDX-License-Identifier: MIT
import { openDB } from 'idb'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings, LearningNodeParams } from '@/types/graph'
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

export function reviewStateKey(graphId: string, nodeId: string): string {
  return `${graphId}:${nodeId}`
}

const db = openDB<{ graphs: GraphRecord; reviewState: LearningNodeParams }>(GRAPHS_DB_NAME, 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('graphs', { keyPath: 'id' })
    }
    if (oldVersion < 2) {
      db.createObjectStore('reviewState')
    }
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

export async function dbClearGraphs() {
  return (await db).clear('graphs')
}

export async function dbGetReviewState(
  graphId: string,
  nodeId: string,
): Promise<LearningNodeParams | undefined> {
  return (await db).get('reviewState', reviewStateKey(graphId, nodeId))
}

export async function dbPutReviewState(
  graphId: string,
  nodeId: string,
  params: LearningNodeParams,
): Promise<void> {
  await (await db).put('reviewState', params, reviewStateKey(graphId, nodeId))
}

export async function dbGetReviewStatesForGraph(
  graphId: string,
): Promise<Map<string, LearningNodeParams>> {
  const tx = (await db).transaction('reviewState', 'readonly')
  const store = tx.objectStore('reviewState')
  const prefix = `${graphId}:`
  const out = new Map<string, LearningNodeParams>()
  for await (const cursor of store.iterate()) {
    const key = String(cursor.key)
    if (key.startsWith(prefix)) {
      out.set(key.slice(prefix.length), cursor.value)
    }
  }
  await tx.done
  return out
}

export async function dbPutReviewStatesForGraph(
  graphId: string,
  entries: Map<string, LearningNodeParams>,
): Promise<void> {
  const tx = (await db).transaction('reviewState', 'readwrite')
  const store = tx.objectStore('reviewState')
  for (const [nodeId, params] of entries) {
    await store.put(params, reviewStateKey(graphId, nodeId))
  }
  await tx.done
}

export async function dbDeleteReviewForGraph(graphId: string): Promise<void> {
  const tx = (await db).transaction('reviewState', 'readwrite')
  const store = tx.objectStore('reviewState')
  const prefix = `${graphId}:`
  const keysToDelete: string[] = []
  for await (const cursor of store.iterate()) {
    const key = String(cursor.key)
    if (key.startsWith(prefix)) keysToDelete.push(key)
  }
  for (const key of keysToDelete) {
    await store.delete(key)
  }
  await tx.done
}

/** Remove review entries for node ids no longer present in the graph. */
export async function dbPruneReviewStates(graphId: string, nodeIds: Set<string>): Promise<void> {
  const existing = await dbGetReviewStatesForGraph(graphId)
  const tx = (await db).transaction('reviewState', 'readwrite')
  const store = tx.objectStore('reviewState')
  for (const nodeId of existing.keys()) {
    if (!nodeIds.has(nodeId)) {
      await store.delete(reviewStateKey(graphId, nodeId))
    }
  }
  await tx.done
}
