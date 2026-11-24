import type { GraphSnapshot, WorkspaceMap } from '@nesso-how/core'
import { revealConceptOperations } from '../store/maps.ts'
import type { HostStore } from '../store/types.ts'

export type SearchResult = { readonly label: string } & (
  | { readonly kind: 'map'; readonly id: string | null; readonly count: number }
  | {
      readonly kind: 'concept'
      readonly id: string
      readonly notes?: string
      readonly color?: string
    }
)

const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

export function searchGraph(
  graph: GraphSnapshot,
  maps: readonly WorkspaceMap[],
  query: string,
  graphLabel: string,
  activeMapId: string | null = null,
): SearchResult[] {
  const colors = new Map(
    maps.find(({ id }) => id === activeMapId)?.members.map(({ id, color }) => [id, color]),
  )
  const text = normalize(query)
  const tokens = text.split(/\s+/)
  const rank = (items: SearchResult[]) => {
    if (!text) return items.slice(0, 3)
    return items
      .map((item) => {
        const label = normalize(item.label)
        const notes = normalize(item.kind === 'concept' ? (item.notes ?? '') : '')
        const score = !tokens.every((token) => label.includes(token) || notes.includes(token))
          ? 0
          : label === text
            ? 5
            : label.startsWith(text)
              ? 4
              : label.includes(text)
                ? 3
                : tokens.every((token) => label.includes(token))
                  ? 2
                  : 1
        return { item, score }
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
  }
  return [
    ...rank([
      { kind: 'map', id: null, label: graphLabel, count: graph.concepts.length },
      ...maps.map((map) => ({
        kind: 'map' as const,
        id: map.id,
        label: map.name,
        count: map.members.length,
      })),
    ]),
    ...rank(
      graph.concepts.map((concept) => ({
        kind: 'concept',
        id: concept.id,
        label: concept.label,
        notes: concept.notes,
        color: colors.get(concept.id),
      })),
    ),
  ]
}

export function addToActiveMap(
  store: HostStore,
  renderer: { readonly addToMap: (id: string) => void } | null,
  id: string,
): void {
  const { graph, workspace } = store.getState()
  const mapId = workspace.activeMapId
  if (mapId === null || !graph.concepts.some((concept) => concept.id === id)) return
  if (renderer) renderer.addToMap(id)
  else store.applyOperations([{ kind: 'map.membership', mapId, conceptId: id, included: true }])
  store.applyOperations([{ kind: 'selection.set', value: [{ kind: 'concept', id }] }])
}

export function openSearchResult(store: HostStore, result: SearchResult): void {
  const state = store.getState()
  const { graph, workspace } = state
  if (result.kind === 'map') {
    if (result.id !== null && !workspace.maps.some(({ id }) => id === result.id)) return
    store.setMap(result.id)
  } else {
    if (!graph.concepts.some(({ id }) => id === result.id)) return
    const current = workspace.maps.find(({ id }) => id === workspace.activeMapId)
    const mapId = current?.members.some(({ id }) => id === result.id) ? current.id : null
    store.applyOperations([
      { kind: 'map.activate', id: mapId },
      ...(mapId === null ? revealConceptOperations(state, result.id) : []),
      { kind: 'selection.set', value: [{ kind: 'concept', id: result.id }] },
      { kind: 'preferences.section', id: 'inspector', open: true },
      { kind: 'preferences.inspectorTab', value: 'details' },
    ])
  }
}
