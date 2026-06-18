// SPDX-License-Identifier: MIT
import type { Edge } from '@xyflow/react'

/**
 * Annotate each edge with its sibling index among edges that share the same
 * unordered node pair, so the renderer can fan parallel edges apart. Edge
 * direction is ignored (A→B and B→A are siblings). Returns the original edge
 * object when its index is already correct, to keep references stable for memos.
 */
export function styleEdges(edges: Edge[]): Edge[] {
  const pairCount: Record<string, number> = {}
  return edges.map((e) => {
    const key = [e.source, e.target].sort().join('—')
    const idx = pairCount[key] ?? 0
    pairCount[key] = idx + 1
    if (e.data?.siblingIdx === idx) return e
    return { ...e, data: { ...e.data, siblingIdx: idx } }
  })
}
