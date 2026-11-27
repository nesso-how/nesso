import type { WorkspaceMap } from '@nesso-how/core'
import type { HostState } from './types.ts'
import { relationKey } from '@nesso-how/schema'
import {
  applyChanges,
  hasDelta,
  mergeChanges,
  sameConcept,
  sameMember,
  sameBend,
  sameType,
  sameMapMetadata,
  type Change,
  type DocumentDelta,
  type MapChange,
} from './delta.ts'
import {
  materialize,
  pruneCollapsedMapGroups,
  pruneMapVisibility,
  reconcileSelection,
} from './operations.ts'
import { checkGraphChanges, checkWorkspaceChanges } from './validation.ts'

export const historyLimit = 100

const stable = ({ before, after }: Change<unknown>): boolean =>
  !!before && !!after && before.index === after.index

const sameMetadata = (map: MapChange): boolean =>
  stable(map) && sameMapMetadata(map.before!.value, map.after!.value)

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
    pinnedMapIds: left.pinnedMapIds,
    mapGroups: left.mapGroups,
  }
}

const canMerge = (left: DocumentDelta, right: DocumentDelta): boolean =>
  left.pinnedMapIds.length + left.mapGroups.length === 0 &&
  right.pinnedMapIds.length + right.mapGroups.length === 0 &&
  left.maps.every(stable) &&
  right.maps.every(sameMetadata)

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

type HistoryEntry = {
  delta: DocumentDelta
  group?: string
  collapsedMapGroupIds?: readonly string[]
}

const removedCollapsedGroups = (
  { workspace }: HostState,
  delta: DocumentDelta,
  forward: boolean,
): readonly string[] | undefined => {
  const collapsed = workspace.collapsedMapGroupIds
  if (!collapsed?.length || !delta.mapGroups.length) return undefined
  const removed = delta.mapGroups
    .filter(({ before, after }) => (forward ? !after : !before))
    .map(({ id }) => id)
  const kept = collapsed.filter((id) => removed.includes(id))
  return kept.length ? kept : undefined
}

const restore = (
  state: HostState,
  { delta, collapsedMapGroupIds }: HistoryEntry,
  forward: boolean,
): HostState => {
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
  const toward = <T>(list: readonly Change<T>[]) =>
    forward ? list : list.map(({ id, before, after }) => ({ id, before: after, after: before }))
  const changes = {
    concepts: toward(delta.concepts),
    relations: toward(delta.relations),
    relationTypes: toward(delta.relationTypes),
  }
  if (graph !== state.graph) checkGraphChanges(graph, changes)
  const maps = restoreViews(state.workspace.maps, delta.maps, forward)
  const pinnedMapIds = applyChanges(
    state.workspace.pinnedMapIds,
    delta.pinnedMapIds,
    (id) => id,
    forward,
  )
  const mapGroups = applyChanges(
    state.workspace.mapGroups,
    delta.mapGroups,
    (group) => group.id,
    forward,
  )
  const activeMapId = maps.some((map) => map.id === state.workspace.activeMapId)
    ? state.workspace.activeMapId
    : null
  const collapsed = collapsedMapGroupIds
    ? [...(state.workspace.collapsedMapGroupIds ?? []), ...collapsedMapGroupIds]
    : state.workspace.collapsedMapGroupIds
  const workspace =
    maps === state.workspace.maps &&
    pinnedMapIds === state.workspace.pinnedMapIds &&
    mapGroups === state.workspace.mapGroups &&
    activeMapId === state.workspace.activeMapId
      ? state.workspace
      : pruneCollapsedMapGroups({
          ...state.workspace,
          maps,
          pinnedMapIds,
          mapGroups,
          activeMapId,
          ...(collapsed && { collapsedMapGroupIds: collapsed }),
        })
  if (workspace !== state.workspace)
    checkWorkspaceChanges(graph, workspace, state.workspace, changes)
  const visibility = pruneMapVisibility(state, workspace)
  const mapGraph = materialize(graph, workspace, state, visibility)
  return {
    ...state,
    graph,
    workspace,
    selected: reconcileSelection(mapGraph, state.selected),
    ...visibility,
    mapGraph,
  }
}

export const createHistory = (getState: () => HostState, publish: (next: HostState) => void) => {
  const past: HistoryEntry[] = []
  const future: HistoryEntry[] = []
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
        past.push({
          delta,
          group,
          collapsedMapGroupIds: removedCollapsedGroups(getState(), delta, true),
        })
        if (past.length > historyLimit) past.shift()
      }
      future.length = 0
    },
    undo: (): void => {
      const entry = past.at(-1)
      if (!entry) return
      const current = getState()
      const next = restore(current, entry, false)
      past.pop()
      future.push({
        delta: entry.delta,
        collapsedMapGroupIds: removedCollapsedGroups(current, entry.delta, false),
      })
      if (past.at(-1)) past.at(-1)!.group = undefined
      publish(next)
    },
    redo: (): void => {
      const entry = future.at(-1)
      if (!entry) return
      const current = getState()
      const next = restore(current, entry, true)
      future.pop()
      past.push({
        delta: entry.delta,
        collapsedMapGroupIds: removedCollapsedGroups(current, entry.delta, true),
      })
      publish(next)
    },
  }
}
