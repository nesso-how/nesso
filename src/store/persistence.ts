import { parseGraph, serializeGraph, type Graph } from '@nesso-how/schema'
import type { createNessoStore } from './create.ts'
import { NessoError } from '@nesso-how/errors'
import { fail, parseConversation, parseWorkspace } from './settings.ts'
import type { Preferences, WorkspaceState } from '@nesso-how/core'
import type { HostState } from './types.ts'
import {
  persistenceSections as sections,
  type PersistenceIssue,
  type PersistenceSection as Section,
  type PersistenceStorage,
} from '../../shared/persistence.ts'
import { checkGraph, sameGraph, samePreferences, sameWorkspace } from './operations.ts'
import { parsePluginStorage } from './plugin-storage.ts'
import { migrateDocument, migratePluginStorage, migratePreferences } from './migrations.ts'

export type LoadedState = {
  graph?: Graph | null
  documentId?: string
  pluginStorage?: HostState['pluginStorage']
  workspace?: WorkspaceState
  preferences?: Preferences
  conversation?: HostState['conversation']
  blocked: Section[]
  issues: PersistenceIssue[]
  upgrades?: Partial<Record<Section, unknown>>
}

const storageIssues = (
  section: Section,
  error: unknown,
  operation: PersistenceIssue['operation'],
): PersistenceIssue[] => {
  const issues =
    error instanceof NessoError
      ? error.issues
      : [{ path: '', message: error instanceof Error ? error.message : 'Storage failed' }]
  return issues.map(({ path, message }) => ({
    path:
      path === section || path.startsWith(`${section}.`)
        ? path
        : path
          ? `${section}.${path}`
          : section,
    message,
    section,
    operation,
  }))
}

export const loadPersistence = async (
  storage: Pick<PersistenceStorage, 'read'>,
): Promise<LoadedState> => {
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
      if (section === 'plugin-storage') {
        const migrated = migratePluginStorage(value)
        const saved = parsePluginStorage(migrated)
        if (!loaded.graph || loaded.blocked.includes('document'))
          fail('documentId', 'The document must load successfully before restoring plugin storage')
        if (saved.documentId !== loaded.documentId)
          fail('documentId', 'Plugin storage belongs to another document')
        loaded.pluginStorage = saved.plugins
        if ((value as { version: number }).version !== 2)
          (loaded.upgrades ??= {})['plugin-storage'] = migrated
        continue
      }
      if (section === 'document') {
        const saved = migrateDocument(value)
        if (saved.graph === null) {
          if (saved.workspace !== null) fail('workspace', 'Expected no workspace without a graph')
          loaded.graph = null
        } else {
          const graph = parseGraph(saved.graph)
          checkGraph(graph)
          const workspace = parseWorkspace(saved.workspace)
          const ids = new Set(graph.concepts.map((concept) => concept.id))
          for (const [index, view] of workspace.savedViews.entries()) {
            if (view.conceptIds.some((id) => !ids.has(id)))
              fail(`workspace.savedViews[${index}].conceptIds`, 'Unknown concept')
          }
          loaded.graph = graph
          loaded.workspace = workspace
        }
        loaded.documentId = saved.documentId
        if ((value as { version: number }).version !== saved.version)
          (loaded.upgrades ??= {}).document = saved
      } else {
        const saved = migratePreferences(value)
        loaded.preferences = saved.preferences
        if ((value as { version: number }).version !== saved.version)
          (loaded.upgrades ??= {}).preferences = saved
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
    document:
      loaded.upgrades?.document !== undefined ||
      !loaded.graph ||
      !loaded.workspace ||
      previous.documentId !== loaded.documentId ||
      !sameGraph(previous.graph, loaded.graph) ||
      !sameWorkspace(previous.workspace, loaded.workspace),
    preferences:
      loaded.upgrades?.preferences !== undefined ||
      !loaded.preferences ||
      !samePreferences(previous.preferences, loaded.preferences),
    conversation:
      !loaded.conversation ||
      JSON.stringify(previous.conversation) !== JSON.stringify(loaded.conversation),
    'plugin-storage':
      loaded.upgrades?.['plugin-storage'] !== undefined ||
      (loaded.pluginStorage === undefined
        ? previous.pluginStorage.length > 0
        : JSON.stringify(previous.pluginStorage) !== JSON.stringify(loaded.pluginStorage)),
  }
  const pending = new Set(sections.filter((section) => changed[section] && !blocked.has(section)))
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  const writeIssues: Partial<Record<Section, PersistenceIssue[]>> = {}
  let writing: Promise<void> | undefined
  let serializedGraph:
    | { source: HostState['graph']; value: ReturnType<typeof serializeGraph> }
    | undefined
  let savedDocumentId = loaded.upgrades?.document === undefined ? loaded.documentId : undefined
  let needsBackup = loaded.upgrades !== undefined

  const save = async (): Promise<void> => {
    if (needsBackup && pending.size) {
      try {
        await storage.backup()
        needsBackup = false
      } catch (error) {
        const section = sections.find((section) => loaded.upgrades?.[section] !== undefined)!
        writeIssues[section] = storageIssues(section, error, 'write')
        host.setPersistenceIssues([...readIssues, ...Object.values(writeIssues).flat()])
        return
      }
    }
    while (pending.size) {
      const batch = sections.filter((section) => pending.has(section))
      pending.clear()
      const state = host.store.getState()
      for (const section of batch) {
        const replace = replacements.delete(section)
        if (blocked.has(section) && !replace) continue
        try {
          if (
            section === 'plugin-storage' &&
            (blocked.has('document') || savedDocumentId !== state.documentId)
          ) {
            fail('documentId', 'Save the document before saving its plugin storage')
          }
          if (section === 'document' && serializedGraph?.source !== state.graph) {
            serializedGraph = { source: state.graph, value: serializeGraph(state.graph as Graph) }
          }
          const saved =
            section === 'document'
              ? {
                  version: 2,
                  documentId: state.documentId,
                  graph: serializedGraph!.value,
                  workspace: state.workspace,
                }
              : section === 'preferences'
                ? { version: 2, preferences: state.preferences }
                : section === 'conversation'
                  ? { version: 1, messages: state.conversation.messages }
                  : { version: 2, documentId: state.documentId, plugins: state.pluginStorage }
          await storage.write(section, saved)
          if (section === 'document') savedDocumentId = state.documentId
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
    clearTimeout(deadline)
    deadline = undefined
    writing ??= Promise.resolve()
      .then(save)
      .finally(() => {
        writing = undefined
      })
    return writing.then(() => {
      const state = host.store.getState()
      return (
        pending.size === 0 &&
        [...blocked].every((section) =>
          section === 'document'
            ? state.documentId === initial.documentId &&
              sameGraph(state.graph, initial.graph) &&
              sameWorkspace(state.workspace, initial.workspace)
            : section === 'preferences'
              ? samePreferences(state.preferences, initial.preferences)
              : section === 'conversation'
                ? JSON.stringify(state.conversation) === JSON.stringify(initial.conversation)
                : state.documentId === initial.documentId &&
                  JSON.stringify(state.pluginStorage) === JSON.stringify(initial.pluginStorage),
        )
      )
    })
  }

  const schedule = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      void flush()
    }, 200)
    deadline ??= setTimeout(() => {
      void flush()
    }, 2000)
  }

  const unsubscribe = host.store.subscribe(() => {
    const state = host.store.getState()
    const changed = {
      document:
        state.documentId !== previous.documentId ||
        state.graph !== previous.graph ||
        state.workspace !== previous.workspace,
      preferences: state.preferences !== previous.preferences,
      conversation: state.conversation !== previous.conversation,
      'plugin-storage':
        state.documentId !== previous.documentId || state.pluginStorage !== previous.pluginStorage,
    }
    const reset = state.documentId !== previous.documentId
    previous = state
    if (changed.conversation && !reset && state.conversation.messages.length === 0) {
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
