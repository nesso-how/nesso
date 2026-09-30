import type {
  GraphSnapshot,
  NessoState,
  NessoStore,
  RendererDefinition,
  Selection,
  VocabDefinition,
} from '@nesso/plugin'
import {
  newIri,
  relationKey,
  SchemaError,
  validateGraph,
  type Graph,
  type RelationType,
  type SchemaIssue,
} from '@nesso/schema'
import { createStore } from 'zustand/vanilla'

type Draft = { graph: Graph; focusId: string; selected: Selection }

const checkGraph = (graph: Graph): void => {
  const issues = validateGraph(graph)
  if (graph.concepts.length === 0) {
    issues.push({ path: 'concepts', message: 'Graph must keep at least one concept' })
  }
  if (issues.length > 0) throw new SchemaError(issues)
}

const selectionExists = (graph: GraphSnapshot, selected: Selection): boolean =>
  !selected || (selected.kind === 'concept'
    ? graph.concepts.some((concept) => concept.id === selected.id)
    : graph.relations.some((relation) => relationKey(relation) === selected.id))

const neighborhood = (graph: GraphSnapshot, focusId: string): GraphSnapshot => {
  const ids = new Set([focusId])
  for (const { source, target } of graph.relations) {
    if (source === focusId) ids.add(target)
    if (target === focusId) ids.add(source)
  }
  const relations = graph.relations.filter((relation) => ids.has(relation.source) && ids.has(relation.target))
  return {
    concepts: graph.concepts.filter((concept) => ids.has(concept.id)),
    relations,
    relationTypes: graph.relationTypes.filter((type) => relations.some((relation) => relation.predicate === type.id)),
  }
}

const defaultType = (vocab: VocabDefinition): RelationType =>
  vocab.relationTypes.find((item) => item.id === vocab.defaultTypeId) ?? { id: vocab.defaultTypeId, label: '' }

const ensureType = (graph: Graph, type: RelationType): void => {
  if (!graph.relationTypes.some((item) => item.id === type.id)) graph.relationTypes.push(type)
}

export const createNessoStore = (graph: Graph) => {
  checkGraph(graph)
  const initial = structuredClone(graph) as Graph
  const store = createStore<NessoState>()(() => ({
    graph: initial,
    view: 'focus',
    viewGraph: neighborhood(initial, initial.concepts[0].id),
    focusId: initial.concepts[0].id,
    selected: null,
    vocabs: [],
    activeVocabId: '',
    activeRendererId: '',
  }))

  const commit = (edit: (draft: Draft) => void): void => {
    const prev = store.getState()
    const draft: Draft = {
      graph: structuredClone(prev.graph) as Graph,
      focusId: prev.focusId,
      selected: prev.selected,
    }
    edit(draft)
    checkGraph(draft.graph)
    if (!draft.graph.concepts.some((concept) => concept.id === draft.focusId)) {
      draft.focusId = draft.graph.concepts[0].id
    }
    if (!selectionExists(draft.graph, draft.selected)) draft.selected = null
    store.setState({
      graph: draft.graph,
      viewGraph: prev.view === 'whole' ? draft.graph : neighborhood(draft.graph, draft.focusId),
      focusId: draft.focusId,
      selected: draft.selected,
    })
  }

  const activeVocab = (): VocabDefinition => {
    const state = store.getState()
    const vocab = state.vocabs.find((item) => item.id === state.activeVocabId)
    if (!vocab) throw new SchemaError([{ path: 'activeVocabId', message: 'No active vocabulary' }])
    return vocab
  }

  const resolveType = (
    graph: { readonly relationTypes: readonly RelationType[] },
    vocab: VocabDefinition,
    rawLabel: string,
  ): RelationType => {
    const label = rawLabel.trim()
    if (!label) return defaultType(vocab)
    const name = label.toLowerCase()
    return vocab.relationTypes.find((item) => item.label.toLowerCase() === name)
      ?? graph.relationTypes.find((item) => item.label.toLowerCase() === name)
      ?? { id: newIri(), label }
  }

  const renderers = new Map<string, RendererDefinition>()

  const registerRenderer = (renderer: RendererDefinition): void => {
    if (renderers.has(renderer.id)) {
      throw new SchemaError([{ path: 'renderer.id', message: `Duplicate renderer id: ${renderer.id}` }])
    }
    renderers.set(renderer.id, renderer)
    if (!store.getState().activeRendererId) store.setState({ activeRendererId: renderer.id })
  }

  const getRenderer = (id: string): RendererDefinition | undefined => renderers.get(id)

  const listRenderers = (): readonly RendererDefinition[] => [...renderers.values()]

  const nessoStore: NessoStore = {
    getState: store.getState,
    subscribe: store.subscribe,

    setFocus: (id) => {
      const state = store.getState()
      if (!state.graph.concepts.some((concept) => concept.id === id)) return
      store.setState({
        focusId: id,
        selected: { kind: 'concept', id },
        view: 'focus',
        viewGraph: neighborhood(state.graph, id),
      })
    },

    setSelection: (selection) => {
      const state = store.getState()
      store.setState({ selected: selectionExists(state.graph, selection) ? selection : null })
    },

    setView: (mode) => {
      const state = store.getState()
      if (state.view === mode) return
      store.setState({
        view: mode,
        viewGraph: mode === 'whole' ? state.graph : neighborhood(state.graph, state.focusId),
      })
    },

    setConceptPosition: (id, position) => commit((draft) => {
      const concept = draft.graph.concepts.find((item) => item.id === id)
      if (concept) concept.position = { x: position.x, y: position.y }
    }),

    setConceptLabel: (id, label) => commit((draft) => {
      const concept = draft.graph.concepts.find((item) => item.id === id)
      if (concept) concept.label = label
    }),

    addTags: (id, tags) => commit((draft) => {
      const concept = draft.graph.concepts.find((item) => item.id === id)
      if (!concept) return
      const known = draft.graph.concepts.flatMap((item) => item.tags)
      for (const raw of tags) {
        const tag = raw.trim()
        if (!tag || concept.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) continue
        concept.tags.push(known.find((item) => item.toLowerCase() === tag.toLowerCase()) ?? tag)
      }
    }),

    removeTag: (id, tag) => commit((draft) => {
      const concept = draft.graph.concepts.find((item) => item.id === id)
      if (concept) concept.tags = concept.tags.filter((item) => item !== tag)
    }),

    addConcept: (position) => {
      const id = newIri()
      const vocab = activeVocab()
      const focusId = store.getState().focusId
      commit((draft) => {
        ensureType(draft.graph, defaultType(vocab))
        const focus = draft.graph.concepts.find((concept) => concept.id === focusId)
        draft.graph.concepts.push({
          id,
          label: `Concept ${draft.graph.concepts.length + 1}`,
          tags: [],
          position: position ?? {
            x: (focus?.position.x ?? 0) + 160,
            y: (focus?.position.y ?? 0) + 100,
          },
        })
        draft.graph.relations.push({ source: focusId, predicate: vocab.defaultTypeId, target: id })
        draft.selected = { kind: 'concept', id }
      })
      return id
    },

    connect: (source, target) => {
      if (!source || !target || source === target) return
      const state = store.getState()
      const vocab = activeVocab()
      const key = relationKey({ source, predicate: vocab.defaultTypeId, target })
      if (state.graph.relations.some((relation) => relationKey(relation) === key)) return
      commit((draft) => {
        ensureType(draft.graph, defaultType(vocab))
        const relation = { source, predicate: vocab.defaultTypeId, target }
        draft.graph.relations.push(relation)
        draft.selected = { kind: 'relation', id: relationKey(relation) }
      })
    },

    setRelationType: (id, rawLabel) => {
      const vocab = activeVocab()
      const state = store.getState()
      const relation = state.graph.relations.find((item) => relationKey(item) === id)
      if (!relation) return
      const type = resolveType(state.graph, vocab, rawLabel)
      const triple = relationKey({ ...relation, predicate: type.id })
      if (state.graph.relations.some((item) => item !== relation && relationKey(item) === triple)) return
      commit((draft) => {
        const index = draft.graph.relations.findIndex((item) => relationKey(item) === id)
        if (index < 0) return
        ensureType(draft.graph, type)
        draft.graph.relations[index] = { ...draft.graph.relations[index], predicate: type.id }
        draft.selected = { kind: 'relation', id: relationKey(draft.graph.relations[index]) }
      })
    },

    removeConcept: (id) => commit((draft) => {
      draft.graph.concepts = draft.graph.concepts.filter((concept) => concept.id !== id)
      draft.graph.relations = draft.graph.relations.filter((relation) =>
        relation.source !== id && relation.target !== id,
      )
    }),

    removeRelation: (id) => commit((draft) => {
      draft.graph.relations = draft.graph.relations.filter((relation) => relationKey(relation) !== id)
    }),

    editGraph: (edit) => commit((draft) => {
      draft.graph = edit(draft.graph)
    }),

    setActiveVocab: (id) => {
      if (!store.getState().vocabs.some((vocab) => vocab.id === id)) {
        throw new SchemaError([{ path: 'activeVocabId', message: `Unknown vocabulary: ${id}` }])
      }
      store.setState({ activeVocabId: id })
    },

    setActiveRenderer: (id) => {
      if (!renderers.has(id)) {
        throw new SchemaError([{ path: 'activeRendererId', message: `Unknown renderer: ${id}` }])
      }
      store.setState({ activeRendererId: id })
    },
  }

  const registerVocab = (vocab: VocabDefinition): void => {
    const state = store.getState()
    const issues: SchemaIssue[] = validateGraph({
      concepts: [],
      relationTypes: [...vocab.relationTypes],
      relations: [],
    })
    if (!vocab.id || state.vocabs.some((item) => item.id === vocab.id)) {
      issues.push({ path: 'id', message: `Duplicate or missing vocabulary id: ${vocab.id}` })
    }
    if (!vocab.defaultTypeId || !vocab.relationTypes.some((type) => type.id === vocab.defaultTypeId)) {
      issues.push({ path: 'defaultTypeId', message: `Default type is not offered by vocabulary: ${vocab.id}` })
    }
    if (issues.length > 0) throw new SchemaError(issues)
    store.setState({
      vocabs: [...state.vocabs, vocab],
      activeVocabId: state.activeVocabId || vocab.id,
    })
  }

  return { store: nessoStore, registerVocab, registerRenderer, getRenderer, listRenderers }
}
