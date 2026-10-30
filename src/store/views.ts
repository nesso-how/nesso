import type { NessoOperation, NessoState } from '@nesso-how/plugin'
import { newIri } from '@nesso-how/schema'

export const buildDeleteViewOperations = (
  state: NessoState,
  viewId: string | null,
  withConcepts: boolean,
): NessoOperation[] => {
  const view = state.workspace.savedViews.find((view) => view.id === viewId)
  if (viewId !== null && !view) return []
  const ids = new Set(view?.conceptIds)
  const concepts = state.graph.concepts.filter(
    (concept) => viewId === null || (withConcepts && ids.has(concept.id)),
  )
  const views = view ? [view] : state.workspace.savedViews
  const operations: NessoOperation[] = [
    ...concepts.map((concept) => ({ kind: 'concept.remove' as const, id: concept.id })),
    ...views.map((view) => ({ kind: 'view.remove' as const, id: view.id })),
  ]
  if (concepts.length === state.graph.concepts.length)
    operations.push(
      { kind: 'selection.set', value: [] },
      { kind: 'concept.add', id: newIri() },
      { kind: 'selection.set', value: [] },
    )
  return operations
}
