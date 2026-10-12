import { parseGraph, SchemaError, serializeGraph, type Graph } from '@nesso/schema'
import type { createNessoStore } from './create.ts'
import { NessoError } from './errors.ts'
import { fail, object, parseConversation, parsePreferences, parseWorkspace } from './settings.ts'
import type { Preferences, WorkspaceState } from '@nesso/plugin'
import type { HostState } from './types.ts'
import { persistenceSections as sections, type PersistenceIssue, type PersistenceSection as Section, type PersistenceStorage } from '../../shared/persistence.ts'
import { sameGraph, samePreferences, sameWorkspace } from './operations.ts'

export type LoadedState = {
  graph?: Graph | null
  workspace?: WorkspaceState
  preferences?: Preferences
  conversation?: HostState['conversation']
  blocked: Section[]
  issues: PersistenceIssue[]
}

const storageIssues = (section: Section, error: unknown, operation: PersistenceIssue['operation']): PersistenceIssue[] => {
  const issues = error instanceof NessoError || error instanceof SchemaError
    ? error.issues
    : [{ path: '', message: error instanceof Error ? error.message : 'Storage failed' }]
  return issues.map(({ path, message }) => ({
    path: path === section || path.startsWith(`${section}.`) ? path : path ? `${section}.${path}` : section,
    message, section, operation,
  }))
}

export const loadPersistence = async (storage: PersistenceStorage): Promise<LoadedState> => {
  const loaded: LoadedState = { blocked: [], issues: [] }
  const records = await Promise.allSettled(sections.map(async (section) => storage.read(section)))
  for (const [index, section] of sections.entries()) {
    try {
      const record = records[index]
      if (record.status === 'rejected') throw record.reason
      const value = record.value
      if (value === undefined) continue
      if (section === 'conversation') {
        loaded.conversation = parseConversation(value)
        continue
      }
      const saved = object(value, '', section === 'document'
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
      loaded.issues.push(...storageIssues(section, error, 'read'))
    }
  }
  return loaded
}

export const connectPersistence = (
  host: ReturnType<typeof createNessoStore>,
  storage: PersistenceStorage,
  loaded: LoadedState,
) => {
  const initial = host.store.getState()
  let previous = initial
  const blocked = new Set(loaded.blocked)
  const replacements = new Set<Section>()
  let readIssues = loaded.issues
  const changed = {
    document: !loaded.graph || !loaded.workspace
      || !sameGraph(previous.graph, loaded.graph) || !sameWorkspace(previous.workspace, loaded.workspace),
    preferences: !loaded.preferences || !samePreferences(previous.preferences, loaded.preferences),
    conversation: !loaded.conversation || JSON.stringify(previous.conversation) !== JSON.stringify(loaded.conversation),
  }
  const pending = new Set(sections.filter((section) => changed[section] && !blocked.has(section)))
  let timer: ReturnType<typeof setTimeout> | undefined
  const writeIssues: Partial<Record<Section, PersistenceIssue[]>> = {}
  let writing: Promise<void> | undefined
  let serializedGraph: { source: HostState['graph']; value: ReturnType<typeof serializeGraph> } | undefined

  const save = async (): Promise<void> => {
    while (pending.size) {
      const batch = [...pending]
      pending.clear()
      const state = host.store.getState()
      for (const section of batch) {
        const replace = replacements.delete(section)
        if (blocked.has(section) && !replace) continue
        try {
          if (section === 'document' && serializedGraph?.source !== state.graph) {
            serializedGraph = { source: state.graph, value: serializeGraph(state.graph as Graph) }
          }
          const saved = section === 'document' ? {
            version: 1, graph: serializedGraph!.value, workspace: state.workspace,
          } : section === 'preferences' ? { version: 1, preferences: state.preferences }
            : { version: 1, messages: state.conversation.messages }
          await storage.write(section, saved)
          if (replace) {
            blocked.delete(section)
            readIssues = readIssues.filter((issue) => issue.section !== section)
          }
          delete writeIssues[section]
        } catch (error) {
          writeIssues[section] = storageIssues(section, error, 'write')
        }
      }
      host.setPersistenceIssues([...readIssues, ...Object.values(writeIssues).flat()])
    }
    for (const section of sections) {
      if (writeIssues[section] && !blocked.has(section)) pending.add(section)
    }
  }

  const flush = (): Promise<boolean> => {
    clearTimeout(timer)
    writing ??= Promise.resolve().then(save).finally(() => { writing = undefined })
    return writing.then(() => {
      const state = host.store.getState()
      return pending.size === 0 && [...blocked].every((section) => section === 'document'
        ? sameGraph(state.graph, initial.graph) && sameWorkspace(state.workspace, initial.workspace)
        : section === 'preferences' ? samePreferences(state.preferences, initial.preferences)
          : JSON.stringify(state.conversation) === JSON.stringify(initial.conversation))
    })
  }

  const schedule = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => { void flush() }, 200)
  }

  const unsubscribe = host.store.subscribe(() => {
    const state = host.store.getState()
    const changed = {
      document: state.graph !== previous.graph || state.workspace !== previous.workspace,
      preferences: state.preferences !== previous.preferences,
      conversation: state.conversation !== previous.conversation,
    }
    previous = state
    if (changed.conversation && state.conversation.messages.length === 0) {
      blocked.delete('conversation')
      readIssues = readIssues.filter((issue) => issue.section !== 'conversation')
    }
    for (const section of sections) {
      if (changed[section] && !blocked.has(section)) pending.add(section)
    }
    if (pending.size && sections.some((section) => changed[section])) schedule()
  })

  host.setPersistenceIssues(readIssues)
  if (pending.size) schedule()

  return {
    flush,
    recover: async (section: Section) => {
      if (blocked.has(section)) replacements.add(section)
      pending.add(section)
      await flush()
      return !blocked.has(section) && !writeIssues[section]
    },
    dispose: async (): Promise<void> => {
      unsubscribe()
      await flush()
    },
  }
}
