import type { NessoOperation, NessoState } from '@nesso-how/core'
import { newIri } from '@nesso-how/schema'
import { defaultMapName, hiddenConceptIds } from './operations.ts'
import type { HostOperation, HostState } from './types.ts'

export const exclusiveConceptIds = (state: NessoState, mapId: string): Set<string> => {
  const maps = state.workspace.maps
  const ids = new Set(maps.find((map) => map.id === mapId)?.members.map(({ id }) => id))
  for (const map of maps) if (map.id !== mapId) for (const { id } of map.members) ids.delete(id)
  return ids
}

export const buildDeleteMapOperations = (
  state: NessoState,
  mapId: string | null,
  keepConcepts = false,
): NessoOperation[] => {
  const map = state.workspace.maps.find((map) => map.id === mapId)
  if (mapId !== null && !map) return []
  const ids = mapId === null || keepConcepts ? new Set() : exclusiveConceptIds(state, mapId)
  const concepts = state.graph.concepts.filter((concept) => mapId === null || ids.has(concept.id))
  const maps = map ? [map] : state.workspace.maps
  const operations: NessoOperation[] = [
    ...concepts.map((concept) => ({ kind: 'concept.remove' as const, id: concept.id })),
    ...maps.map((map) => ({ kind: 'map.remove' as const, id: map.id })),
  ]
  if (concepts.length === state.graph.concepts.length) {
    const remaining = state.workspace.maps.find((item) => !maps.includes(item))
    operations.push(
      remaining
        ? { kind: 'map.activate', id: remaining.id }
        : { kind: 'map.create', id: newIri(), name: defaultMapName, conceptIds: [] },
      { kind: 'selection.set', value: [] },
      { kind: 'concept.add', id: newIri(), position: { x: 0, y: 0 } },
      { kind: 'selection.set', value: [] },
    )
  }
  return operations
}

export const revealConceptOperations = (state: HostState, conceptId: string): HostOperation[] => {
  const { graph, workspace } = state
  if (!hiddenConceptIds(graph, workspace.maps, state).has(conceptId)) return []
  const maps = workspace.maps.filter(({ members }) => members.some(({ id }) => id === conceptId))
  if (!maps.length) return [{ kind: 'map.setVisible', id: null, visible: true }]
  return [
    ...[...new Set(maps.map(({ groupId }) => groupId ?? null))]
      .filter((id) => state.hiddenMapGroupIds.includes(id))
      .map((id): HostOperation => ({ kind: 'map-group.setVisible', id, visible: true })),
    ...maps
      .filter(({ id }) => state.hiddenMapIds.includes(id))
      .map(({ id }): HostOperation => ({ kind: 'map.setVisible', id, visible: true })),
  ]
}
