import { resolveRelationTypeLabel, type NessoState } from '@nesso-how/core'
import { defaultLocale } from '@nesso-how/i18n'
import { relationKey } from '@nesso-how/schema'
import { aiTools, type AiToolResults } from '@nesso-how/ai'

const page = <T>(items: readonly T[], { offset, limit }: { offset: number; limit: number }) => ({
  items: items.slice(offset, offset + limit),
  total: items.length,
  nextOffset: offset + limit < items.length ? offset + limit : null,
})

const relationTypes = (state: NessoState) => {
  const vocab = state.vocabs.find(({ id }) => id === state.preferences.activeVocabId)
  const types = new Map(
    [...(vocab?.relationTypes ?? []), ...state.graph.relationTypes].map((type) => [type.id, type]),
  )
  const locale = state.preferences.locale ?? defaultLocale
  return [...types.values()].map((type) => ({
    id: type.id,
    label: resolveRelationTypeLabel(type, state.vocabs, locale),
  }))
}

export function readAiTool(
  state: NessoState,
  name: string,
  input: unknown,
): AiToolResults[Exclude<keyof AiToolResults, 'edit' | 'history'>] | undefined {
  switch (name) {
    case 'context': {
      aiTools.context.inputSchema.parse(input)
      const map = state.workspace.maps.find(({ id }) => id === state.workspace.activeMapId)
      const vocab = state.vocabs.find(({ id }) => id === state.preferences.activeVocabId)
      return {
        activeMap: { id: map?.id ?? null, name: map?.name ?? 'Graph' },
        counts: {
          concepts: state.graph.concepts.length,
          relations: state.graph.relations.length,
          maps: state.workspace.maps.length,
        },
        visible: {
          concepts: state.mapGraph.concepts.length,
          relations: state.mapGraph.relations.length,
        },
        selection: state.selected.slice(0, 100),
        selectionCount: state.selected.length,
        history: state.history,
        vocabulary: vocab ? { id: vocab.id, defaultTypeId: vocab.defaultTypeId } : null,
      }
    }
    case 'concepts': {
      const query = aiTools.concepts.inputSchema.parse(input)
      const graph = query.scope === 'all' ? state.graph : state.mapGraph
      return page(
        graph.concepts.filter(
          (concept) =>
            (!query.ids || query.ids.includes(concept.id)) &&
            (!query.query || concept.label.toLowerCase().includes(query.query.toLowerCase())),
        ),
        query,
      )
    }
    case 'relations': {
      const query = aiTools.relations.inputSchema.parse(input)
      const graph = query.scope === 'all' ? state.graph : state.mapGraph
      return page(
        graph.relations
          .filter(
            (relation) =>
              (!query.ids || query.ids.includes(relationKey(relation))) &&
              (!query.conceptId ||
                relation.source === query.conceptId ||
                relation.target === query.conceptId),
          )
          .map((relation) => ({ ...relation, id: relationKey(relation) })),
        query,
      )
    }
    case 'maps': {
      const query = aiTools.maps.inputSchema.parse(input)
      if (query.id === undefined)
        return page(
          [
            { id: null, name: 'Graph', concepts: state.graph.concepts.length, pinned: true },
            ...state.workspace.maps.map((map) => ({
              id: map.id,
              name: map.name,
              concepts: map.members.length,
              pinned: map.pinned,
            })),
          ],
          query,
        )
      const map = state.workspace.maps.find(({ id }) => id === query.id)
      if (query.id !== null && !map) return undefined
      return {
        id: map?.id ?? null,
        name: map?.name ?? 'Graph',
        members: page(
          (map?.members ?? state.graph.concepts).map(({ id }) => id),
          query,
        ),
      }
    }
    case 'relation_types':
      return page(relationTypes(state), aiTools.relation_types.inputSchema.parse(input))
    case 'selection': {
      const query = aiTools.selection.inputSchema.parse(input)
      return page(state.selected, query)
    }
    default:
      return undefined
  }
}
