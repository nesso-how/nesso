// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { extractReviewParams } from '@/lib/graphContent'
import { dbPutReviewStatesForGraph, dbPruneReviewStates } from '@/store/db'

export async function persistReviewStatesFromNodes(
  graphId: string,
  nodes: Node<ConceptNodeData>[],
): Promise<void> {
  const entries = new Map<string, ReturnType<typeof extractReviewParams>>()
  for (const node of nodes) {
    entries.set(node.id, extractReviewParams(node.data))
  }
  await dbPutReviewStatesForGraph(graphId, entries)
  await dbPruneReviewStates(graphId, new Set(nodes.map((n) => n.id)))
}
