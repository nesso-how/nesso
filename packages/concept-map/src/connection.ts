import type { GraphSnapshot } from '@nesso-how/core'

export function canConnect(
  graph: GraphSnapshot,
  source: string,
  target: string,
  defaultTypeId: string | undefined,
  restriction?: { readonly source: string; readonly target: string },
) {
  if (source === target) return false
  if (restriction && (source !== restriction.source || target !== restriction.target)) return false
  return !graph.relations.some(
    (relation) =>
      relation.source === source &&
      relation.target === target &&
      (!!restriction || relation.predicate === defaultTypeId),
  )
}
