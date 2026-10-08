import type { NessoState } from '@nesso/plugin'
import { relationKey } from '@nesso/schema'
import { aiTools } from '@nesso/ai'

const page = <T>(items: readonly T[], { offset, limit }: { offset: number; limit: number }) => ({
  items: items.slice(offset, offset + limit), total: items.length,
  nextOffset: offset + limit < items.length ? offset + limit : null,
})

export function readAiTool(state: NessoState, name: string, input: unknown): unknown {
  switch (name) {
    case 'context': {
      aiTools.context.inputSchema.parse(input)
      const view = state.workspace.savedViews.find(({ id }) => id === state.workspace.activeViewId)
      const vocab = state.vocabs.find(({ id }) => id === state.preferences.activeVocabId)
      return {
        activeView: { id: view?.id ?? null, name: view?.name ?? 'All' },
        counts: { concepts: state.graph.concepts.length, relations: state.graph.relations.length, views: state.workspace.savedViews.length },
        visible: { concepts: state.viewGraph.concepts.length, relations: state.viewGraph.relations.length },
        selection: state.selected.slice(0, 100), selectionCount: state.selected.length, history: state.history,
        vocabulary: vocab ? { id: vocab.id, label: vocab.label, defaultTypeId: vocab.defaultTypeId } : null,
      }
    }
    case 'concepts': {
      const query = aiTools.concepts.inputSchema.parse(input)
      const graph = query.scope === 'all' ? state.graph : state.viewGraph
      return page(graph.concepts.filter((concept) => (!query.ids || query.ids.includes(concept.id))
        && (!query.query || concept.label.toLowerCase().includes(query.query.toLowerCase()))), query)
    }
    case 'relations': {
      const query = aiTools.relations.inputSchema.parse(input)
      const graph = query.scope === 'all' ? state.graph : state.viewGraph
      return page(graph.relations.filter((relation) => (!query.ids || query.ids.includes(relationKey(relation)))
        && (!query.conceptId || relation.source === query.conceptId || relation.target === query.conceptId))
        .map((relation) => ({ ...relation, id: relationKey(relation) })), query)
    }
    case 'views': {
      const query = aiTools.views.inputSchema.parse(input)
      if (query.id === undefined) return page([{ id: null, name: 'All', concepts: state.graph.concepts.length, pinned: true },
        ...state.workspace.savedViews.map((view) => ({ id: view.id, name: view.name, concepts: view.conceptIds.length, pinned: view.pinned }))], query)
      const view = state.workspace.savedViews.find(({ id }) => id === query.id)
      if (query.id !== null && !view) return undefined
      return { id: view?.id ?? null, name: view?.name ?? 'All', members: page(view?.conceptIds ?? state.graph.concepts.map(({ id }) => id), query) }
    }
    case 'relation_types': {
      const query = aiTools.relation_types.inputSchema.parse(input)
      const vocab = state.vocabs.find(({ id }) => id === state.preferences.activeVocabId)
      const types = new Map([...vocab?.relationTypes ?? [], ...state.graph.relationTypes].map((type) => [type.id, type]))
      return page([...types.values()], query)
    }
    default: return undefined
  }
}
