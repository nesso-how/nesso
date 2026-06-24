// SPDX-License-Identifier: MIT
import type { Node, Edge } from '@xyflow/react'
import type { ConceptNodeData, NessoGraphDocument } from '@/types/graph'
import { documentToGraphFromReviews } from '@/lib/graphDocumentMapping'
import { extractReviewParams } from '@/lib/graphContent'
import {
  dbGetReviewStatesForGraph,
  dbPutReviewStatesForGraph,
  dbPruneReviewStates,
} from '@/store/db'

export async function documentToGraph(
  doc: NessoGraphDocument,
  graphId: string,
): Promise<ReturnType<typeof documentToGraphFromReviews>> {
  const reviews = await dbGetReviewStatesForGraph(graphId)
  return documentToGraphFromReviews(doc, reviews)
}

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
