import { parseGraph, SchemaError, serializeGraph, type Graph, type SchemaIssue } from '@nesso/schema'
import type { createNessoStore } from './create.ts'
import { NessoError } from './errors.ts'
import { fail, object, parsePreferences, parseWorkspace } from './settings.ts'
import type { Preferences, WorkspaceState } from '@nesso/plugin'

type Section = 'document' | 'preferences'
type StorageSource = () => Pick<Storage, 'getItem' | 'setItem'>
const sections = ['document', 'preferences'] as const

export const storageKeys = {
  document: 'nesso.document',
  preferences: 'nesso.preferences',
} as const

export type LoadedState = {
  graph?: Graph | null
  workspace?: WorkspaceState
  preferences?: Preferences
  blocked: Section[]
  issues: SchemaIssue[]
}

const storageError = (section: Section, error: unknown): NessoError => {
  const issues = error instanceof NessoError || error instanceof SchemaError
    ? error.issues
    : [{ path: '', message: error instanceof Error ? error.message : 'Local storage failed' }]
  return new NessoError(issues.map(({ path, message }) => ({
    path: path ? `${section}.${path}` : section,
    message,
  })))
}

export const loadPersistence = (storage: StorageSource): LoadedState => {
  const loaded: LoadedState = { blocked: [], issues: [] }
  for (const section of sections) {
    try {
      const text = storage().getItem(storageKeys[section])
      if (text === null) continue
      const saved = object(JSON.parse(text), '', section === 'document'
        ? ['version', 'graph', 'workspace'] : ['version', 'preferences'])
      if (saved.version !== 1) fail('version', 'Unsupported storage version')
      if (section === 'document') {
        if (saved.graph === null) {
          if (saved.workspace !== null) fail('workspace', 'Expected no workspace without a graph')
          loaded.graph = null
          continue
        }
        const graph = parseGraph(saved.graph)
        if (graph.concepts.length === 0) fail('graph.concepts', 'Graph must keep at least one concept')
        const workspace = parseWorkspace(saved.workspace)
        const ids = new Set(graph.concepts.map((concept) => concept.id))
        for (const [index, view] of workspace.savedViews.entries()) {
          if (view.conceptIds.some((id) => !ids.has(id))) fail(`workspace.savedViews[${index}].conceptIds`, 'Unknown concept')
        }
        loaded.graph = graph
        loaded.workspace = workspace
      } else {
        loaded.preferences = parsePreferences(saved.preferences)
      }
    } catch (error) {
      loaded.blocked.push(section)
      loaded.issues.push(...storageError(section, error).issues)
    }
  }
  return loaded
}

export const connectPersistence = (
  host: ReturnType<typeof createNessoStore>,
  storage: StorageSource,
  loaded: LoadedState,
) => {
  let previous = host.store.getState()
  const pending = new Set<Section>(sections.filter((section) => !loaded.blocked.includes(section)))
  let timer: ReturnType<typeof setTimeout> | undefined
  const writeIssues: Partial<Record<Section, SchemaIssue[]>> = {}

  const flush = (): void => {
    clearTimeout(timer)
    const state = host.store.getState()
    for (const section of pending) {
      try {
        const saved = section === 'document' ? {
          version: 1,
          graph: serializeGraph(structuredClone(state.graph) as Graph),
          workspace: state.workspace,
        } : { version: 1, preferences: state.preferences }
        storage().setItem(storageKeys[section], JSON.stringify(saved))
        pending.delete(section)
        delete writeIssues[section]
      } catch (error) {
        writeIssues[section] = storageError(section, error).issues
      }
    }
    host.setPersistenceIssues([...loaded.issues, ...Object.values(writeIssues).flat()])
  }

  const schedule = (): void => {
    clearTimeout(timer)
    timer = setTimeout(flush, 200)
  }

  const unsubscribe = host.store.subscribe(() => {
    const state = host.store.getState()
    const documentChanged = state.graph !== previous.graph || state.workspace !== previous.workspace
    const preferencesChanged = state.preferences !== previous.preferences
    previous = state
    if (documentChanged && !loaded.blocked.includes('document')) pending.add('document')
    if (preferencesChanged && !loaded.blocked.includes('preferences')) pending.add('preferences')
    if ((documentChanged || preferencesChanged) && pending.size) schedule()
  })

  if (pending.size) schedule()

  return {
    flush,
    dispose: (): void => {
      unsubscribe()
      flush()
    },
  }
}
