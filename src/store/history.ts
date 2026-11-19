import type { NessoState, WorkspaceMap } from '@nesso-how/core'
import { relationKey } from '@nesso-how/schema'
import {
  applyChanges,
  hasDelta,
  mergeChanges,
  sameConcept,
  sameMember,
  sameBend,
  sameType,
  type Change,
  type DocumentDelta,
  type MapChange,
} from './delta.ts'
import { checkGraph, checkWorkspace, materialize, reconcileSelection } from './operations.ts'
import { parseWorkspace } from './settings.ts'

export const historyLimit = 100

const stable = ({ before, after }: Change<unknown>): boolean =>
  !!before && !!after && before.index === after.index

const sameMetadata = (map: MapChange): boolean =>
  stable(map) &&
  map.before!.value.name === map.after!.value.name &&
  map.before!.value.pinned === map.after!.value.pinned

const mergeDelta = (left: DocumentDelta, right: DocumentDelta): DocumentDelta => {
  const maps = new Map(left.maps.map((map) => [map.id, map]))
  for (const map of right.maps) {
    const previous = maps.get(map.id)
    maps.set(
      map.id,
      previous
        ? {
            ...previous,
            members: mergeChanges(previous.members, map.members, sameMember),
            relationBends: mergeChanges(previous.relationBends, map.relationBends, sameBend),
          }
        : map,
    )
  }
  return {
    concepts: mergeChanges(left.concepts, right.concepts, sameConcept),
    relations: mergeChanges(
      left.relations,
      right.relations,
      (a, b) => relationKey(a) === relationKey(b),
    ),
    relationTypes: mergeChanges(left.relationTypes, right.relationTypes, sameType),
    maps: [...maps.values()].filter(
      (map) => map.members.length > 0 || map.relationBends.length > 0 || !sameMetadata(map),
    ),
  }
}

const canMerge = (left: DocumentDelta, right: DocumentDelta): boolean =>
  left.maps.every(stable) && right.maps.every(sameMetadata)

const restoreViews = (
  maps: readonly WorkspaceMap[],
  changes: readonly MapChange[],
  forward: boolean,
): readonly WorkspaceMap[] => {
  if (changes.length === 0) return maps
  const existing = new Map(maps.map((map) => [map.id, map]))
  const patches: Change<WorkspaceMap>[] = changes.map((change) => {
    const target = forward ? change.after : change.before
    const relationBends = applyChanges(
      existing.get(change.id)?.relationBends ?? [],
      change.relationBends,
      relationKey,
      forward,
    )
    const entry = target && {
      index: target.index,
      value: {
        ...target.value,
        members: applyChanges(
          existing.get(change.id)?.members ?? [],
          change.members,
          (member) => member.id,
          forward,
        ),
        ...(relationBends.length ? { relationBends } : {}),
      },
    }
    return {
      id: change.id,
      before: forward ? undefined : entry,
      after: forward ? entry : undefined,
    }
  })
  return applyChanges(maps, patches, (map) => map.id, forward)
}

const restore = (state: NessoState, delta: DocumentDelta, forward: boolean): NessoState => {
  const concepts = applyChanges(
    state.graph.concepts,
    delta.concepts,
    (concept) => concept.id,
    forward,
  )
  const relations = applyChanges(state.graph.relations, delta.relations, relationKey, forward)
  const relationTypes = applyChanges(
    state.graph.relationTypes,
    delta.relationTypes,
    (type) => type.id,
    forward,
  )
  const graph =
    concepts === state.graph.concepts &&
    relations === state.graph.relations &&
    relationTypes === state.graph.relationTypes
      ? state.graph
      : { concepts, relations, relationTypes }
  if (graph !== state.graph) checkGraph(graph)
  const maps = restoreViews(state.workspace.maps, delta.maps, forward)
  const activeMapId = maps.some((map) => map.id === state.workspace.activeMapId)
    ? state.workspace.activeMapId
    : null
  const workspace =
    maps === state.workspace.maps && activeMapId === state.workspace.activeMapId
      ? state.workspace
      : { ...state.workspace, maps, activeMapId }
  if (workspace !== state.workspace) {
    parseWorkspace(workspace)
    checkWorkspace(graph, workspace)
  }
  const mapGraph = materialize(graph, workspace, state)
  return {
    ...state,
    graph,
    workspace,
    selected: reconcileSelection(mapGraph, state.selected),
    mapGraph,
  }
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
      if (
        group &&
        group === previous?.group &&
        future.length === 0 &&
        canMerge(previous.delta, delta)
      ) {
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
