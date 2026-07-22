// SPDX-License-Identifier: MIT
import { openDB } from 'idb'
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings, LearningNodeParams } from '@/types/graph'
import { GRAPHS_DB_NAME } from '@/data/storageKeys'

export const GRAPH_RECORD_VERSION = 1 as const

export interface GraphRecord {
  recordVersion: typeof GRAPH_RECORD_VERSION
  vocabulary: {
    id: string
    version: string
  }
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

type NessoDB = { graphs: GraphRecord; reviewState: LearningNodeParams }

let _dbPromise: ReturnType<typeof openDB<NessoDB>> | undefined

function getDB(): ReturnType<typeof openDB<NessoDB>> {
  if (!_dbPromise) {
    _dbPromise = openDB<NessoDB>(GRAPHS_DB_NAME, 2, {
      // Idempotent schema bootstrap: ensure the current object stores exist.
      // Not a version ladder — IndexedDB requires a version + upgrade tx to create
      // stores, and the version cannot go below existing alpha installs (2).
      upgrade(db) {
        if (!db.objectStoreNames.contains('graphs')) {
          db.createObjectStore('graphs', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('reviewState')) {
          db.createObjectStore('reviewState')
        }
      },
    })
  }
  return _dbPromise
}

export async function dbSaveGraph(record: GraphRecord) {
  return (await getDB()).put('graphs', record)
}

export async function dbLoadGraph(id: string): Promise<GraphRecord | undefined> {
  return (await getDB()).get('graphs', id)
}

export async function dbListGraphs(): Promise<GraphRecord[]> {
  return (await getDB()).getAll('graphs')
}

export async function dbDeleteGraph(id: string) {
  return (await getDB()).delete('graphs', id)
}

export async function dbClearGraphs() {
  return (await getDB()).clear('graphs')
}

export async function dbGetReviewState(
  graphId: string,
  nodeId: string,
): Promise<LearningNodeParams | undefined> {
  return (await getDB()).get('reviewState', reviewStateKey(graphId, nodeId))
}

export async function dbPutReviewState(
  graphId: string,
  nodeId: string,
  params: LearningNodeParams,
): Promise<void> {
  await (await getDB()).put('reviewState', params, reviewStateKey(graphId, nodeId))
}

export async function dbGetReviewStatesForGraph(
  graphId: string,
): Promise<Map<string, LearningNodeParams>> {
  const tx = (await getDB()).transaction('reviewState', 'readonly')
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
  const tx = (await getDB()).transaction('reviewState', 'readwrite')
  const store = tx.objectStore('reviewState')
  for (const [nodeId, params] of entries) {
    await store.put(params, reviewStateKey(graphId, nodeId))
  }
  await tx.done
}

export async function dbDeleteReviewForGraph(graphId: string): Promise<void> {
  const tx = (await getDB()).transaction('reviewState', 'readwrite')
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
  const tx = (await getDB()).transaction('reviewState', 'readwrite')
  const store = tx.objectStore('reviewState')
  for (const nodeId of existing.keys()) {
    if (!nodeIds.has(nodeId)) {
      await store.delete(reviewStateKey(graphId, nodeId))
    }
  }
  await tx.done
}
