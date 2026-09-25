// SPDX-License-Identifier: MIT
import { RELATION_TYPES, asRelationTypeName } from '@nesso-how/vocab-learning'
import { useGraphStore } from '@/store'

/**
 * True when the selected relation is its own inverse (e.g. "contrasts with"):
 * reversing it changes nothing, so flip actions are hidden.
 */
export function useSelectedEdgeIsSymmetric(): boolean {
  const selectedEdge = useGraphStore((s) =>
    s.selected?.kind === 'edge' ? s.edges.find((e) => e.id === s.selected?.id) : undefined,
  )
  return (
    selectedEdge !== undefined &&
    RELATION_TYPES[asRelationTypeName(selectedEdge.data?.type)].inverse === 'self'
  )
}
