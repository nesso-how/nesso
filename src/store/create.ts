import type {
  GraphSnapshot,
  NessoStore,
  RendererDefinition,
  Selection,
  ThemeDefinition,
  VocabDefinition,
} from '@nesso/plugin'
import {
  newIri,
  relationKey,
  SchemaError,
  validateGraph,
  type Graph,
  type SchemaIssue,
} from '@nesso/schema'
import { createStore } from 'zustand/vanilla'
import { applyGraphOperations } from './operations.ts'
import { defaultPanels, fail, parsePanels, parsePreferences, parseViewport, parseWorkspace } from './settings.ts'
import { sectionIds, type HostPreferences, type HostState, type HostStore, type HostWorkspace, type PanelSizes, type RestoredState, type SectionId } from './types.ts'

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

const materialize = (graph: GraphSnapshot, workspace: HostWorkspace): GraphSnapshot => {
  if (workspace.activeViewId === null) return graph
  const ids = new Set(workspace.savedViews.find((view) => view.id === workspace.activeViewId)?.conceptIds ?? [])
  const relations = graph.relations.filter((relation) => ids.has(relation.source) && ids.has(relation.target))
  return {
    concepts: graph.concepts.filter((concept) => ids.has(concept.id)),
    relations,
    relationTypes: graph.relationTypes,
  }
}

const newGraph = (): Graph => ({
  concepts: [{ id: newIri(), label: 'Concept 1', position: { x: 0, y: 0 } }],
  relationTypes: [],
  relations: [],
})
const newWorkspace = (): HostWorkspace => ({
  activeViewId: null,
  savedViews: [],
  viewports: {},
})

export const createNessoStore = (graph: Graph | null, restored: RestoredState = {}) => {
  if (graph) checkGraph(graph)
  const initial = graph ? structuredClone(graph) : newGraph()
  const workspace = graph && restored.workspace ? parseWorkspace(restored.workspace) : newWorkspace()
  const initialIds = new Set(initial.concepts.map((concept) => concept.id))
  if (workspace.savedViews.some((view) => view.conceptIds.some((id) => !initialIds.has(id)))) {
    fail('workspace.savedViews', 'Unknown concept in view')
  }
  const preferences: HostPreferences = restored.preferences ? parsePreferences(restored.preferences) : {
    activeVocabId: '',
    activeRendererId: '',
    activeThemeId: '',
    panels: { ...defaultPanels },
  }
  const store = createStore<HostState>()(() => ({
    graph: initial,
    workspace,
    preferences: { ...preferences, activeVocabId: '', activeRendererId: '', activeThemeId: '' },
    viewGraph: materialize(initial, workspace),
    selected: null,
    vocabs: [],
    persistenceIssues: [],
  }))

  const commit = (candidate: GraphSnapshot, selected = store.getState().selected, reset = false): void => {
    const prev = store.getState()
    if (candidate === prev.graph && selected === prev.selected) return
    checkGraph(candidate)
    if (!reset && candidate.relations !== prev.graph.relations) {
      const used = new Set(candidate.relations.map((relation) => relation.predicate))
      const vocabularyTypes = new Set(prev.vocabs.flatMap((vocab) => vocab.relationTypes.map((type) => type.id)))
      const removed = new Set(prev.graph.relations.map((relation) => relation.predicate)
        .filter((id) => !used.has(id) && !vocabularyTypes.has(id)))
      if (removed.size) {
        const relationTypes = candidate.relationTypes.filter((type) => !removed.has(type.id))
        if (relationTypes.length !== candidate.relationTypes.length) candidate = { ...candidate, relationTypes }
      }
    }
    let workspace = reset ? newWorkspace() : prev.workspace
    if (!reset) {
      const ids = new Set(candidate.concepts.map((concept) => concept.id))
      const previousIds = new Set(prev.graph.concepts.map((concept) => concept.id))
      const addedIds = candidate.concepts.filter((concept) => !previousIds.has(concept.id)).map((concept) => concept.id)
      let changed = false
      const savedViews = workspace.savedViews.map((view) => {
        let conceptIds = view.conceptIds
        if (conceptIds.some((id) => !ids.has(id))) conceptIds = conceptIds.filter((id) => ids.has(id))
        if (addedIds.length && view.id === workspace.activeViewId) conceptIds = [...conceptIds, ...addedIds]
        if (conceptIds === view.conceptIds) return view
        changed = true
        return { ...view, conceptIds }
      })
      if (changed) workspace = { ...workspace, savedViews }
    }
    store.setState({
      graph: candidate,
      viewGraph: materialize(candidate, workspace),
      workspace,
      selected: selectionExists(candidate, selected) ? selected : null,
    })
  }

  const applyOperations: NessoStore['applyOperations'] = (operations) => {
    const next = applyGraphOperations(store.getState(), operations)
    commit(next.graph, next.selected)
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

  const themes = new Map<string, ThemeDefinition>()

  const registerTheme = (theme: ThemeDefinition): void => {
    if (typeof theme.id !== 'string' || !theme.id.trim() || themes.has(theme.id)) {
      fail('theme.id', `Duplicate or missing theme id: ${theme.id}`)
    }
    if (typeof theme.label !== 'string' || !theme.label.trim()) fail('theme.label', 'Expected a theme label')
    themes.set(theme.id, { id: theme.id, label: theme.label })
    const state = store.getState()
    if (!state.preferences.activeThemeId || theme.id === preferences.activeThemeId) {
      store.setState({ preferences: { ...state.preferences, activeThemeId: theme.id } })
    }
  }

  const getTheme = (id: string): ThemeDefinition | undefined => themes.get(id)

  const listThemes = (): readonly ThemeDefinition[] => [...themes.values()]

  const nessoStore: HostStore = {
    getState: store.getState,
    subscribe: store.subscribe,

    setSelection: (selection) => {
      const state = store.getState()
      store.setState({ selected: selection && selectionExists(state.graph, selection) ? { ...selection } : null })
    },

    setView: (id) => {
      const state = store.getState()
      if (id !== null && !state.workspace.savedViews.some((view) => view.id === id)) fail('workspace.activeViewId', 'Unknown view')
      if (state.workspace.activeViewId === id) return
      const workspace = { ...state.workspace, activeViewId: id }
      const viewGraph = materialize(state.graph, workspace)
      store.setState({
        workspace,
        selected: selectionExists(viewGraph, state.selected) ? state.selected : null,
        viewGraph,
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

    applyOperations,
    setConceptPosition: (id, position) => applyOperations([{ kind: 'concept.position', id, value: position }]),
    setConceptPositions: (updates) => applyOperations([{ kind: 'concept.positions', updates }]),
    setConceptLabel: (id, label) => applyOperations([{ kind: 'concept.label', id, value: label }]),

    addConcept: (position) => {
      const id = newIri()
      applyOperations([{ kind: 'concept.add', id, position }])
      return id
    },
    connect: (source, target) => applyOperations([{ kind: 'relation.connect', source, target }]),
    setRelationType: (id, typeId) => applyOperations([{ kind: 'relation.type', id, typeId }]),
    createRelationType: (id, label) => applyOperations([{ kind: 'relation.type.create', id, typeId: newIri(), label }]),
    removeConcept: (id) => applyOperations([{ kind: 'concept.remove', id }]),
    removeRelation: (id) => applyOperations([{ kind: 'relation.remove', id }]),

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
    setActiveTheme: (id: string): void => {
      if (!themes.has(id)) fail('preferences.activeThemeId', `Unknown theme: ${id}`)
      const state = store.getState()
      if (state.preferences.activeThemeId !== id) {
        store.setState({ preferences: { ...state.preferences, activeThemeId: id } })
      }
    },
    createView: (name: string, conceptIds: readonly string[]): string => {
      const state = store.getState()
      const id = newIri()
      const workspace = parseWorkspace({ ...state.workspace, activeViewId: id, savedViews: [
        ...state.workspace.savedViews, { id, name, conceptIds: [...new Set(conceptIds)], pinned: false },
      ] })
      if (conceptIds.some((id) => !state.graph.concepts.some((concept) => concept.id === id))) fail('view.conceptIds', 'Unknown concept')
      store.setState({ workspace, viewGraph: materialize(state.graph, workspace) })
      return id
    },
    setViewPinned: (id: string, pinned: boolean): void => {
      const state = store.getState()
      const view = state.workspace.savedViews.find((view) => view.id === id) ?? fail('view.id', 'Unknown view')
      if (view.pinned === pinned) return
      store.setState({ workspace: { ...state.workspace, savedViews: state.workspace.savedViews.map((view) =>
        view.id === id ? { ...view, pinned } : view) } })
    },
    setViewMembership: (viewId: string, conceptId: string, included: boolean): void => {
      const state = store.getState()
      const view = state.workspace.savedViews.find((view) => view.id === viewId) ?? fail('view.id', 'Unknown view')
      if (!state.graph.concepts.some((concept) => concept.id === conceptId)) fail('view.conceptId', 'Unknown concept')
      if (view.conceptIds.includes(conceptId) === included) return
      const conceptIds = included
        ? [...view.conceptIds, conceptId]
        : view.conceptIds.filter((id) => id !== conceptId)
      const workspace = { ...state.workspace, savedViews: state.workspace.savedViews.map((view) =>
        view.id === viewId ? { ...view, conceptIds } : view) }
      store.setState({ workspace, viewGraph: workspace.activeViewId === viewId ? materialize(state.graph, workspace) : state.viewGraph })
    },
    deleteView: (id: string): void => {
      const state = store.getState()
      if (!state.workspace.savedViews.some((view) => view.id === id)) fail('view.id', 'Unknown view')
      const active = state.workspace.activeViewId === id
      const workspace = { ...state.workspace, activeViewId: active ? null : state.workspace.activeViewId,
        savedViews: state.workspace.savedViews.filter((view) => view.id !== id) }
      store.setState({ workspace, viewGraph: active ? state.graph : state.viewGraph })
    },
    getViewGraph: (id: string): GraphSnapshot => {
      const state = store.getState()
      if (!state.workspace.savedViews.some((view) => view.id === id)) fail('view.id', 'Unknown view')
      return materialize(state.graph, { ...state.workspace, activeViewId: id })
    },
    setPanelSizes: (sizes: PanelSizes): void => {
      const panels = parsePanels(sizes)
      const state = store.getState()
      if (panels.explorerWidth === state.preferences.panels.explorerWidth && panels.inspectorWidth === state.preferences.panels.inspectorWidth) return
      store.setState({ preferences: { ...state.preferences, panels } })
    },
    setSectionOpen: (id: SectionId, open: boolean): void => {
      if (!sectionIds.includes(id)) fail('preferences.collapsedSections', 'Unknown section')
      if (typeof open !== 'boolean') fail('section.open', 'Expected a boolean')
      const state = store.getState()
      const collapsed = state.preferences.collapsedSections ?? []
      if (!collapsed.includes(id) === open) return
      const collapsedSections = open ? collapsed.filter((section) => section !== id) : [...collapsed, id]
      store.setState({ preferences: { ...state.preferences, collapsedSections } })
    },
    setPersistenceIssues: (issues: readonly Readonly<SchemaIssue>[]): void => {
      if (JSON.stringify(issues) !== JSON.stringify(store.getState().persistenceIssues)) {
        store.setState({ persistenceIssues: issues.map((issue) => ({ ...issue })) })
      }
    },
  }

  return { store: nessoStore, ui, registerVocab, registerRenderer, getRenderer, registerTheme, getTheme, listThemes }
}
