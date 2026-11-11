import type { NessoOperation, NessoState } from '@nesso-how/core'
import { newIri } from '@nesso-how/schema'
import { defaultViewName } from './operations.ts'

export const buildDeleteViewOperations = (
  state: NessoState,
  viewId: string | null,
  withConcepts: boolean,
): NessoOperation[] => {
  const view = state.workspace.savedViews.find((view) => view.id === viewId)
  if (viewId !== null && !view) return []
  const ids = new Set(view?.members.map(({ id }) => id))
  const concepts = state.graph.concepts.filter(
    (concept) => viewId === null || (withConcepts && ids.has(concept.id)),
  )
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
