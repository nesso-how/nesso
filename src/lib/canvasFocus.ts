// SPDX-License-Identifier: MIT
import type { Edge } from '@xyflow/react'
import type { Selection } from '@/store/types'

/**
 * Concepts in the current focus: the selected relation's endpoints, or the
 * selected concept plus its direct neighbours. Null when nothing relevant is
 * selected, so no concept dims.
 */
export function computeFocusNodeIds(
  selected: Selection | undefined,
  selectedEdge: { id: string; source: string; target: string } | null,
  edges: Edge[],
): string[] | null {
  if (selectedEdge) return [selectedEdge.source, selectedEdge.target]
  if (selected?.kind !== 'node') return null
  const ids = new Set<string>([selected.id])
  for (const e of edges) {
    if (e.source === selected.id) ids.add(e.target)
    else if (e.target === selected.id) ids.add(e.source)
  }
  return [...ids]
}
