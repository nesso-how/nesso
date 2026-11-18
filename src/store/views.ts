import type { NessoOperation, NessoState } from '@nesso-how/core'
import { newIri } from '@nesso-how/schema'
import { defaultViewName } from './operations.ts'

export const exclusiveConceptIds = (state: NessoState, viewId: string): Set<string> => {
  const views = state.workspace.savedViews
  const ids = new Set(views.find((view) => view.id === viewId)?.members.map(({ id }) => id))
  for (const view of views)
    if (view.id !== viewId) for (const { id } of view.members) ids.delete(id)
  return ids
}

export const buildDeleteViewOperations = (
  state: NessoState,
  viewId: string | null,
  keepConcepts = false,
): NessoOperation[] => {
  const view = state.workspace.savedViews.find((view) => view.id === viewId)
  if (viewId !== null && !view) return []
  const ids = viewId === null || keepConcepts ? new Set() : exclusiveConceptIds(state, viewId)
  const concepts = state.graph.concepts.filter((concept) => viewId === null || ids.has(concept.id))
  const views = view ? [view] : state.workspace.savedViews
  const operations: NessoOperation[] = [
    ...concepts.map((concept) => ({ kind: 'concept.remove' as const, id: concept.id })),
    ...views.map((view) => ({ kind: 'view.remove' as const, id: view.id })),
  ]
  if (concepts.length === state.graph.concepts.length) {
    const remaining = state.workspace.savedViews.find((item) => !views.includes(item))
    operations.push(
      remaining
        ? { kind: 'view.activate', id: remaining.id }
        : { kind: 'view.create', id: newIri(), name: defaultViewName, conceptIds: [] },
      { kind: 'selection.set', value: [] },
      { kind: 'concept.add', id: newIri(), position: { x: 0, y: 0 } },
      { kind: 'selection.set', value: [] },
    )
  }
  return operations
}
