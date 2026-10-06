import type {
  NessoStore,
  Preferences,
  RendererDefinition,
  ThemeDefinition,
  VocabDefinition,
} from '@nesso/plugin'
import {
  newIri,
  SchemaError,
  validateGraph,
  type Graph,
  type SchemaIssue,
} from '@nesso/schema'
import { createStore } from 'zustand/vanilla'
import { createCommands } from './commands.ts'
import { applyStateOperations, checkGraph, materialize, newGraph, newWorkspace } from './operations.ts'
import { defaultPanels, fail, parsePreferences, parseWorkspace } from './settings.ts'
import type { HostState, HostStore, RestoredState } from './types.ts'

export const createNessoStore = (graph: Graph | null, restored: RestoredState = {}) => {
  if (graph) checkGraph(graph)
  const initial = graph ? structuredClone(graph) : newGraph(newIri())
  const workspace = graph && restored.workspace ? parseWorkspace(restored.workspace) : newWorkspace()
  const initialIds = new Set(initial.concepts.map((concept) => concept.id))
  if (workspace.savedViews.some((view) => view.conceptIds.some((id) => !initialIds.has(id)))) {
    fail('workspace.savedViews', 'Unknown concept in view')
  }
  const preferences: Preferences = restored.preferences ? parsePreferences(restored.preferences) : {
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

  const applyOperations: NessoStore['applyOperations'] = (operations) => {
    const state = store.getState()
    const next = applyStateOperations(state, operations, { renderers, themes })
    if (next !== state) store.setState(next)
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
    ...createCommands(applyOperations),
    getViewGraph: (id) => {
      const state = store.getState()
      if (!state.workspace.savedViews.some((view) => view.id === id)) fail('view.id', 'Unknown view')
      return materialize(state.graph, { ...state.workspace, activeViewId: id })
    },
  }

  const registerVocab = (vocab: VocabDefinition): void => {
    const state = store.getState()
    const issues: SchemaIssue[] = validateGraph({
      concepts: [],
      relationTypes: vocab.relationTypes,
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

  const setPersistenceIssues = (issues: readonly Readonly<SchemaIssue>[]): void => {
    if (JSON.stringify(issues) !== JSON.stringify(store.getState().persistenceIssues)) {
      store.setState({ persistenceIssues: issues.map((issue) => ({ ...issue })) })
    }
  }

  return { store: nessoStore, setPersistenceIssues, registerVocab, registerRenderer, getRenderer, registerTheme, getTheme, listThemes }
}
