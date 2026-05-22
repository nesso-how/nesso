// SPDX-License-Identifier: MIT
import type { Edge } from '@xyflow/react'
import type { EdgeTypeName } from '@/types/graph'
import { asEdgeTypeName } from './relationTypes'

const MIN_EDGES_FOR_FREQUENT = 4
const MIN_COUNT_FOR_FREQUENT = 2
const MAX_FREQUENT = 6

export function relationCountsFromEdges(edges: Edge[]): Map<EdgeTypeName, number> {
  const counts = new Map<EdgeTypeName, number>()
  for (const edge of edges) {
    const type = asEdgeTypeName(edge.data?.type)
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return counts
}

/** Types used repeatedly in the current graph; empty until enough signal. */
export function frequentRelationTypes(edges: Edge[]): EdgeTypeName[] {
  if (edges.length < MIN_EDGES_FOR_FREQUENT) return []

  return [...relationCountsFromEdges(edges).entries()]
    .filter(([, count]) => count >= MIN_COUNT_FOR_FREQUENT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_FREQUENT)
    .map(([id]) => id)
}
