import type { Selection } from '@nesso/plugin'
import type { EdgeChange, NodeChange } from '@xyflow/react'

export const selectionForContextMenu = (selected: Selection, item: Selection[number]): Selection =>
  selected.some((current) => current.kind === item.kind && current.id === item.id) ? selected : [item]

export const selectionFromChanges = (selected: Selection, kind: Selection[number]['kind'], changes: readonly (NodeChange | EdgeChange)[]): Selection => {
  const updates = new Map(changes.flatMap((change) => change.type === 'select' ? [[change.id, change.selected] as const] : []))
  if (updates.size === 0) return selected
  const next = selected.filter((item) => item.kind !== kind || updates.get(item.id) !== false)
  const ids = new Set(next.filter((item) => item.kind === kind).map((item) => item.id))
  for (const [id, included] of updates) if (included && !ids.has(id)) next.push({ kind, id })
  return next.length === selected.length && next.every((item, index) => item === selected[index]) ? selected : next
}
