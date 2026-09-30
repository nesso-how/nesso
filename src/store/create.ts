import type {
  GraphSnapshot,
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
import { defaultPanels, fail, parsePanels, parsePreferences, parseTagFilter, parseViewport, parseWorkspace } from './settings.ts'
import type { HostPreferences, HostState, HostStore, HostWorkspace, PanelSizes, RestoredState } from './types.ts'

const checkGraph = (graph: GraphSnapshot): void => {
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

const defaultType = (vocab: VocabDefinition): Readonly<RelationType> =>
  vocab.relationTypes.find((item) => item.id === vocab.defaultTypeId) ?? { id: vocab.defaultTypeId, label: '' }

const withType = (graph: GraphSnapshot, type: Readonly<RelationType>): GraphSnapshot['relationTypes'] =>
  graph.relationTypes.some((item) => item.id === type.id)
    ? graph.relationTypes
    : [...graph.relationTypes, { ...type }]

const newGraph = (): Graph => ({
  concepts: [{ id: newIri(), label: 'Concept 1', tags: [], position: { x: 0, y: 0 } }],
  relationTypes: [],
  relations: [],
})
const newWorkspace = (focusId: string): HostWorkspace => ({
  focusId,
  view: 'focus',
  tagFilter: [],
  viewports: {},
})

export const createNessoStore = (graph: Graph | null, restored: RestoredState = {}) => {
  if (graph) checkGraph(graph)
  const initial = graph ? structuredClone(graph) : newGraph()
  const workspace = graph && restored.workspace ? parseWorkspace(restored.workspace) : newWorkspace(initial.concepts[0].id)
  const focusId = initial.concepts.some((concept) => concept.id === workspace.focusId)
    ? workspace.focusId : initial.concepts[0].id
  const preferences: HostPreferences = restored.preferences ? parsePreferences(restored.preferences) : {
    activeVocabId: '',
    activeRendererId: '',
    panels: { ...defaultPanels },
  }
  const store = createStore<HostState>()(() => ({
    graph: initial,
    workspace: { ...workspace, focusId },
    preferences: { ...preferences, activeVocabId: '', activeRendererId: '' },
    viewGraph: workspace.view === 'whole' ? initial : neighborhood(initial, focusId),
    selected: null,
    vocabs: [],
    persistenceIssues: [],
  }))

  const commit = (candidate: GraphSnapshot, selected = store.getState().selected, reset = false): void => {
    const prev = store.getState()
    if (candidate === prev.graph && selected === prev.selected) return
    checkGraph(candidate)
    const focusId = !reset && candidate.concepts.some((concept) => concept.id === prev.workspace.focusId)
      ? prev.workspace.focusId
      : candidate.concepts[0].id
    const workspace = reset ? newWorkspace(focusId)
      : focusId === prev.workspace.focusId ? prev.workspace : { ...prev.workspace, focusId }
    store.setState({
      graph: candidate,
      viewGraph: workspace.view === 'whole' ? candidate : neighborhood(candidate, focusId),
      workspace,
      selected: selectionExists(candidate, selected) ? selected : null,
    })
  }

  const activeVocab = (): VocabDefinition => {
    const state = store.getState()
    const vocab = state.vocabs.find((item) => item.id === state.preferences.activeVocabId)
    if (!vocab) throw new SchemaError([{ path: 'activeVocabId', message: 'No active vocabulary' }])
    return vocab
  }

  const retypeRelation = (id: string, type: Readonly<RelationType>): void => {
    const state = store.getState()
    const relation = state.graph.relations.find((item) => relationKey(item) === id)
    if (!relation || relation.predicate === type.id) return
    const triple = relationKey({ ...relation, predicate: type.id })
    if (state.graph.relations.some((item) => relationKey(item) === triple)) return
    commit({
      ...state.graph,
      relationTypes: withType(state.graph, type),
      relations: state.graph.relations.map((item) => item === relation ? { ...item, predicate: type.id } : item),
    }, { kind: 'relation', id: triple })
  }

  const updateConcept = (
    id: string,
    update: (concept: GraphSnapshot['concepts'][number]) => GraphSnapshot['concepts'][number],
  ): void => {
    const graph = store.getState().graph
    const concept = graph.concepts.find((item) => item.id === id)
    if (!concept) return
    const next = update(concept)
    if (next === concept) return
    commit({ ...graph, concepts: graph.concepts.map((item) => item === concept ? next : item) })
  }

  const setConceptPositions: NessoStore['setConceptPositions'] = (updates) => {
    if (updates.length === 0) return
    const graph = store.getState().graph
    const positions = new Map(updates.map(({ id, position }) => [id, position]))
    let changed = false
    const concepts = graph.concepts.map((concept) => {
      const position = positions.get(concept.id)
      if (!position || (position.x === concept.position.x && position.y === concept.position.y)) return concept
      changed = true
      return { ...concept, position: { x: position.x, y: position.y } }
    })
    if (changed) commit({ ...graph, concepts })
  }

  const renderers = new Map<string, RendererDefinition>()

  const registerRenderer = (renderer: RendererDefinition): void => {
    if (renderers.has(renderer.id)) {
      throw new SchemaError([{ path: 'renderer.id', message: `Duplicate renderer id: ${renderer.id}` }])
    }
    renderers.set(renderer.id, renderer)
    const state = store.getState()
    if (!state.preferences.activeRendererId || renderer.id === preferences.activeRendererId) {
      store.setState({ preferences: { ...state.preferences, activeRendererId: renderer.id } })
    }
  }

  const getRenderer = (id: string): RendererDefinition | undefined => renderers.get(id)

  const listRenderers = (): readonly RendererDefinition[] => [...renderers.values()]

  const nessoStore: HostStore = {
    getState: store.getState,
    subscribe: store.subscribe,

    setFocus: (id) => {
      const state = store.getState()
      if (!state.graph.concepts.some((concept) => concept.id === id)) return
      const unchanged = state.workspace.focusId === id && state.workspace.view === 'focus'
      if (unchanged && state.selected?.kind === 'concept' && state.selected.id === id) return
      store.setState({
        workspace: unchanged ? state.workspace : { ...state.workspace, focusId: id, view: 'focus' },
        selected: { kind: 'concept', id },
        viewGraph: unchanged ? state.viewGraph : neighborhood(state.graph, id),
      })
    },

    setSelection: (selection) => {
      const state = store.getState()
      store.setState({ selected: selection && selectionExists(state.graph, selection) ? { ...selection } : null })
    },

    setView: (mode) => {
      const state = store.getState()
      if (mode !== 'focus' && mode !== 'whole') fail('workspace.view', 'Unknown view mode')
      if (state.workspace.view === mode) return
      store.setState({
        workspace: { ...state.workspace, view: mode },
        viewGraph: mode === 'whole' ? state.graph : neighborhood(state.graph, state.workspace.focusId),
      })
    },

    setViewport: (rendererId, viewport) => {
      if (!renderers.has(rendererId)) fail('rendererId', `Unknown renderer: ${rendererId}`)
      const next = parseViewport(viewport, `workspace.viewports.${rendererId}`)
      const state = store.getState()
      const previous = state.workspace.viewports[rendererId]
      if (previous && previous.x === next.x && previous.y === next.y && previous.zoom === next.zoom) return
      store.setState({ workspace: {
        ...state.workspace,
        viewports: { ...state.workspace.viewports, [rendererId]: next },
      } })
    },

    setConceptPosition: (id, position) => setConceptPositions([{ id, position }]),
    setConceptPositions,

    setConceptLabel: (id, label) => updateConcept(id, (concept) =>
      concept.label === label ? concept : { ...concept, label }),

    addTags: (id, tags) => updateConcept(id, (concept) => {
      const known = store.getState().graph.concepts.flatMap((item) => item.tags)
      const next = [...concept.tags]
      for (const raw of tags) {
        const tag = raw.trim()
        if (!tag || next.some((item) => item.toLowerCase() === tag.toLowerCase())) continue
        next.push(known.find((item) => item.toLowerCase() === tag.toLowerCase()) ?? tag)
      }
      return next.length === concept.tags.length ? concept : { ...concept, tags: next }
    }),

    removeTag: (id, tag) => updateConcept(id, (concept) =>
      concept.tags.includes(tag) ? { ...concept, tags: concept.tags.filter((item) => item !== tag) } : concept),

    addConcept: (position) => {
      const id = newIri()
      const vocab = activeVocab()
      const { graph, workspace: { focusId } } = store.getState()
      const focus = graph.concepts.find((concept) => concept.id === focusId)
      commit({
        ...graph,
        relationTypes: withType(graph, defaultType(vocab)),
        concepts: [...graph.concepts, {
          id,
          label: `Concept ${graph.concepts.length + 1}`,
          tags: [],
          position: position ? { x: position.x, y: position.y } : {
            x: (focus?.position.x ?? 0) + 160,
            y: (focus?.position.y ?? 0) + 100,
          },
        }],
        relations: [...graph.relations, { source: focusId, predicate: vocab.defaultTypeId, target: id }],
      }, { kind: 'concept', id })
      return id
    },

    connect: (source, target) => {
      if (!source || !target || source === target) return
      const state = store.getState()
      const vocab = activeVocab()
      const key = relationKey({ source, predicate: vocab.defaultTypeId, target })
      if (state.graph.relations.some((relation) => relationKey(relation) === key)) return
      commit({
        ...state.graph,
        relationTypes: withType(state.graph, defaultType(vocab)),
        relations: [...state.graph.relations, { source, predicate: vocab.defaultTypeId, target }],
      }, { kind: 'relation', id: key })
    },

    setRelationType: (id, typeId) => {
      const type = store.getState().graph.relationTypes.find((item) => item.id === typeId)
        ?? activeVocab().relationTypes.find((item) => item.id === typeId)
      if (!type) throw new SchemaError([{ path: 'relationTypeId', message: `Unknown relation type: ${typeId}` }])
      retypeRelation(id, type)
    },

    createRelationType: (id, rawLabel) => {
      const label = rawLabel.trim()
      if (!label) throw new SchemaError([{ path: 'label', message: 'Relation type label must not be empty' }])
      retypeRelation(id, { id: newIri(), label })
    },

    removeConcept: (id) => {
      const graph = store.getState().graph
      if (!graph.concepts.some((concept) => concept.id === id)) return
      const relations = graph.relations.filter((relation) =>
        relation.source !== id && relation.target !== id,
      )
      commit({
        ...graph,
        concepts: graph.concepts.filter((concept) => concept.id !== id),
        relations: relations.length === graph.relations.length ? graph.relations : relations,
      })
    },

    removeRelation: (id) => {
      const graph = store.getState().graph
      const relations = graph.relations.filter((relation) => relationKey(relation) !== id)
      if (relations.length !== graph.relations.length) commit({ ...graph, relations })
    },

    editGraph: (edit) => {
      const draft = structuredClone(store.getState().graph) as Graph
      commit(structuredClone(edit(draft)) as Graph)
    },

    setActiveVocab: (id) => {
      if (!store.getState().vocabs.some((vocab) => vocab.id === id)) {
        throw new SchemaError([{ path: 'activeVocabId', message: `Unknown vocabulary: ${id}` }])
      }
      const state = store.getState()
      if (state.preferences.activeVocabId !== id) {
        store.setState({ preferences: { ...state.preferences, activeVocabId: id } })
      }
    },

    setActiveRenderer: (id) => {
      if (!renderers.has(id)) {
        throw new SchemaError([{ path: 'activeRendererId', message: `Unknown renderer: ${id}` }])
      }
      const state = store.getState()
      if (state.preferences.activeRendererId !== id) {
        store.setState({ preferences: { ...state.preferences, activeRendererId: id } })
      }
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
      vocabs: [...state.vocabs, structuredClone(vocab)],
      preferences: {
        ...state.preferences,
        activeVocabId: vocab.id === preferences.activeVocabId ? vocab.id : state.preferences.activeVocabId || vocab.id,
      },
    })
  }

  const ui = {
    resetGraph: (): void => commit(newGraph(), null, true),
    setTagFilter: (tags: readonly string[]): void => {
      const next = parseTagFilter(tags)
      const state = store.getState()
      if (next.length === state.workspace.tagFilter.length && next.every((tag, index) => tag === state.workspace.tagFilter[index])) return
      store.setState({ workspace: { ...state.workspace, tagFilter: next } })
    },
    setPanelSizes: (sizes: PanelSizes): void => {
      const panels = parsePanels(sizes)
      const state = store.getState()
      if (panels.explorerWidth === state.preferences.panels.explorerWidth && panels.inspectorWidth === state.preferences.panels.inspectorWidth) return
      store.setState({ preferences: { ...state.preferences, panels } })
    },
    setPersistenceIssues: (issues: readonly Readonly<SchemaIssue>[]): void => {
      if (JSON.stringify(issues) !== JSON.stringify(store.getState().persistenceIssues)) {
        store.setState({ persistenceIssues: issues.map((issue) => ({ ...issue })) })
      }
    },
  }

  return { store: nessoStore, ui, registerVocab, registerRenderer, getRenderer, listRenderers }
}
