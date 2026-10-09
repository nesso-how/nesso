import type {
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
import { createHistory } from './history.ts'
import { applyStateOperations, checkGraph, materialize, newGraph, newWorkspace } from './operations.ts'
import { defaultPanels, fail, maxRelationLabelLength, parseConversation, parsePreferences, parseWorkspace } from './settings.ts'
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
    conversation: parseConversation({ version: 1, messages: restored.conversation?.messages ?? [] }),
    preferences: { ...preferences, activeVocabId: '', activeRendererId: '', activeThemeId: '' },
    viewGraph: materialize(initial, workspace),
    selected: [],
    vocabs: [],
    persistenceIssues: [],
    history: { canUndo: false, canRedo: false },
  }))

  const history = createHistory(store.getState, (next) => store.setState({ ...next, history: history.flags() }))

  const applyOperations: HostStore['applyOperations'] = (operations, options) => {
    const historyOperation = operations.find(({ kind }) => kind === 'history.undo' || kind === 'history.redo')
    if (historyOperation) {
      if (operations.length !== 1) fail('operations', 'History operations must be applied alone')
      if (historyOperation.kind === 'history.undo') history.undo()
      else history.redo()
      return
    }
    const state = store.getState()
    const { next, delta, reset } = applyStateOperations(state, operations, { renderers, themes })
    history.record(delta, options?.historyGroup, reset)
    const flags = history.flags()
    const historyState = flags.canUndo === state.history.canUndo && flags.canRedo === state.history.canRedo ? state.history : flags
    if (next !== state || historyState !== state.history) store.setState({ ...next, history: historyState })
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
    applyOperations,
    setChatMessages: (value) => applyOperations([{ kind: 'conversation.messages', value }]),
    clearChat: () => applyOperations([{ kind: 'conversation.clear' }]),
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
    vocab.relationTypes.forEach((type, index) => {
      if (type.label.length > maxRelationLabelLength) {
        issues.push({ path: `relationTypes[${index}].label`, message: `Relation label must not exceed ${maxRelationLabelLength} characters` })
      }
    })
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

  const previewOperations = (state: Parameters<typeof applyStateOperations>[0], operations: Parameters<typeof applyStateOperations>[1]) =>
    applyStateOperations(state, operations, { renderers, themes })

  return { store: nessoStore, previewOperations, setPersistenceIssues, registerVocab, registerRenderer, getRenderer, registerTheme, getTheme, listThemes }
}
