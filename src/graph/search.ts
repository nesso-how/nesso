import type { GraphSnapshot, SavedView } from '@nesso-how/core'
import type { HostStore } from '../store/types.ts'

export type SearchResult = { readonly label: string } & (
  | { readonly kind: 'view'; readonly id: string | null; readonly count: number }
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
  views: readonly SavedView[],
  query: string,
  overview: string,
  activeViewId: string | null = null,
): SearchResult[] {
  const colors = new Map(
    views.find(({ id }) => id === activeViewId)?.members.map(({ id, color }) => [id, color]),
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
      { kind: 'view', id: null, label: overview, count: graph.concepts.length },
      ...views.map((view) => ({
        kind: 'view' as const,
        id: view.id,
        label: view.name,
        count: view.members.length,
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

export function openSearchResult(store: HostStore, result: SearchResult): void {
  const { graph, workspace } = store.getState()
  if (result.kind === 'view') {
    if (result.id !== null && !workspace.savedViews.some(({ id }) => id === result.id)) return
    store.setView(result.id)
  } else {
    if (!graph.concepts.some(({ id }) => id === result.id)) return
    const current = workspace.savedViews.find(({ id }) => id === workspace.activeViewId)
    store.applyOperations([
      {
        kind: 'view.activate',
        id: current?.members.some(({ id }) => id === result.id) ? current.id : null,
      },
      { kind: 'selection.set', value: [{ kind: 'concept', id: result.id }] },
      { kind: 'preferences.section', id: 'inspector', open: true },
      { kind: 'preferences.inspectorTab', value: 'details' },
    ])
  }
}
