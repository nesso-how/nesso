import type { NessoState, SavedView } from '@nesso/plugin'
import { relationKey } from '@nesso/schema'
import { applyChanges, hasDelta, mergeChanges, sameConcept, type Change, type DocumentDelta, type ViewChange } from './delta.ts'
import { checkGraph, materialize, reconcileSelection } from './operations.ts'
import { parseWorkspace } from './settings.ts'

export const historyLimit = 100

const mergeDelta = (left: DocumentDelta, right: DocumentDelta): DocumentDelta => ({
  ...left,
  concepts: mergeChanges(left.concepts, right.concepts, sameConcept),
})

const canMerge = (delta: DocumentDelta): boolean =>
  delta.views.length + delta.relations.length + delta.relationTypes.length === 0
  && delta.concepts.every(({ before, after }) => before && after && before.index === after.index)

const restoreViews = (views: readonly SavedView[], changes: readonly ViewChange[], forward: boolean): readonly SavedView[] => {
  if (changes.length === 0) return views
  const existing = new Map(views.map((view) => [view.id, view]))
  const patches: Change<SavedView>[] = changes.map((change) => {
    const target = forward ? change.after : change.before
    const entry = target && { index: target.index, value: {
      ...target.value,
      conceptIds: applyChanges(existing.get(change.id)?.conceptIds ?? [], change.members, (id) => id, forward),
    } }
    return { id: change.id, before: forward ? undefined : entry, after: forward ? entry : undefined }
  })
  return applyChanges(views, patches, (view) => view.id, forward)
}

const restore = (state: NessoState, delta: DocumentDelta, forward: boolean): NessoState => {
  const concepts = applyChanges(state.graph.concepts, delta.concepts, (concept) => concept.id, forward)
  const relations = applyChanges(state.graph.relations, delta.relations, relationKey, forward)
  const relationTypes = applyChanges(state.graph.relationTypes, delta.relationTypes, (type) => type.id, forward)
  const graph = concepts === state.graph.concepts && relations === state.graph.relations && relationTypes === state.graph.relationTypes
    ? state.graph : { concepts, relations, relationTypes }
  if (graph !== state.graph) checkGraph(graph)
  const savedViews = restoreViews(state.workspace.savedViews, delta.views, forward)
  const activeViewId = savedViews.some((view) => view.id === state.workspace.activeViewId) ? state.workspace.activeViewId : null
  const workspace = savedViews === state.workspace.savedViews && activeViewId === state.workspace.activeViewId
    ? state.workspace : { ...state.workspace, savedViews, activeViewId }
  if (workspace !== state.workspace) parseWorkspace(workspace)
  return { ...state, graph, workspace, selected: reconcileSelection(graph, state.selected), viewGraph: materialize(graph, workspace, state) }
}

export const createHistory = (getState: () => NessoState, publish: (next: NessoState) => void) => {
  const past: { delta: DocumentDelta; group?: string }[] = []
  const future: DocumentDelta[] = []
  const flags = () => ({ canUndo: past.length > 0, canRedo: future.length > 0 })
  return {
    flags,
    record: (delta: DocumentDelta, group?: string, reset = false): void => {
      if (reset) {
        past.length = 0
        future.length = 0
        return
      }
      if (!hasDelta(delta)) return
      const previous = past.at(-1)
      const stableIndices = previous?.delta.concepts.every(({ before, after }) => after && (!before || before.index === after.index))
      if (group && group === previous?.group && future.length === 0 && stableIndices && canMerge(delta)) {
        previous.delta = mergeDelta(previous.delta, delta)
        if (!hasDelta(previous.delta)) past.pop()
      } else {
        past.push({ delta, group })
        if (past.length > historyLimit) past.shift()
      }
      future.length = 0
    },
    undo: (): void => {
      const entry = past.at(-1)
      if (!entry) return
      const next = restore(getState(), entry.delta, false)
      past.pop()
      future.push(entry.delta)
      if (past.at(-1)) past.at(-1)!.group = undefined
      publish(next)
    },
    redo: (): void => {
      const delta = future.at(-1)
      if (!delta) return
      const next = restore(getState(), delta, true)
      future.pop()
      past.push({ delta })
      publish(next)
    },
  }
}
