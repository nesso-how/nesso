import assert from 'node:assert/strict'
import test from 'node:test'
import type { Preferences, WorkspaceState } from '@nesso-how/core'
import { viewportKey } from '@nesso-how/core'
import { parseGraph, serializeGraph, type Graph } from '@nesso-how/schema'
import { createNessoStore } from './create.ts'
import { connectPersistence, loadPersistence } from './persistence.ts'
import { createDesktopStorage, createIndexedDbStorage } from './storage.ts'
import { sectionIds } from './types.ts'
import { maxConceptLabelLength, maxRelationLabelLength } from './settings.ts'
import { initializeNessoStore } from './initialize.ts'
import type { PersistenceSection, PersistenceStorage } from '../../shared/persistence.ts'
import themeFixture from '../../packages/plugin/test/theme.json' with { type: 'json' }

const fixture = (): Graph => ({
  concepts: [
    { id: 'urn:one', label: 'One', notes: 'Definition\nExample' },
    { id: 'urn:two', label: 'Two' },
    { id: 'urn:hidden', label: 'Hidden' },
  ],
  relations: [{ source: 'urn:one', predicate: 'urn:links', target: 'urn:two' }],
  relationTypes: [
    { id: 'urn:links', label: 'links' },
    { id: 'urn:unused', label: 'unused' },
  ],
})

const positions = new Map([
  ['urn:one', { x: 10, y: 20 }],
  ['urn:two', { x: 30, y: 40 }],
  ['urn:hidden', { x: 50, y: 60 }],
])
const workspace = (): WorkspaceState => ({
  activeViewId: 'urn:view',
  viewports: {},
  savedViews: [
    {
      id: 'urn:view',
      name: 'Pair',
      pinned: false,
      members: ['urn:one', 'urn:two'].map((id) => ({ id, position: positions.get(id)! })),
    },
  ],
})
const legacyDocument = () => {
  const { schemaVersion: _, ...document } = serializeGraph(fixture()) as {
    schemaVersion: number
    '@graph': { '@id': string }[]
  }
  return {
    graph: {
      ...document,
      '@graph': document['@graph'].map((node) =>
        positions.has(node['@id']) ? { ...node, position: positions.get(node['@id']) } : node,
      ),
    },
    workspace: {
      activeViewId: 'urn:view',
      viewports: {},
      savedViews: [
        { id: 'urn:view', name: 'Pair', pinned: false, conceptIds: ['urn:one', 'urn:two'] },
      ],
    },
  }
}

const memoryStorage = () => {
  const records = new Map<PersistenceSection, unknown>()
  const writes: PersistenceSection[] = []
  const backups: Map<PersistenceSection, unknown>[] = []
  return {
    records,
    writes,
    backups,
    backup: async () => {
      backups.push(structuredClone(records))
    },
    read: async (key: PersistenceSection) => structuredClone(records.get(key)),
    write: async (key: PersistenceSection, value: unknown) => {
      records.set(key, structuredClone(value))
      writes.push(key)
    },
  }
}

const registeredHost = (graph: Graph | null, restored = {}) => {
  const host = createNessoStore(graph, restored)
  host.registerVocab({
    id: 'vocab',
    defaultTypeId: 'urn:links',
    relationTypes: [{ id: 'urn:links', label: 'links' }],
  })
  host.registerRenderer({ id: 'graph' })
  host.registerTheme(themeFixture)
  return host
}

const setPluginData = (host: ReturnType<typeof createNessoStore>, value: string, revision = 0) =>
  host.store.applyOperations([
    {
      kind: 'plugin-storage.set',
      pluginId: 'nesso-plugin-example',
      local: false,
      documentId: host.store.getState().documentId,
      revision,
      record: { key: 'settings', value },
    },
  ])

const savedStorage = () => {
  const storage = memoryStorage()
  const host = registeredHost(fixture(), { workspace: workspace() })
  host.store.setLocale('it')
  host.store.setChatMessages([{ id: 'user', role: 'user', content: 'Hello' }])
  const state = host.store.getState()
  storage.records.set('document', {
    version: 4,
    documentId: state.documentId,
    graph: serializeGraph(state.graph as Graph),
    workspace: state.workspace,
  })
  storage.records.set('preferences', { version: 3, preferences: state.preferences })
  storage.records.set('conversation', { version: 2, messages: state.conversation.messages })
  return storage
}

test('startup writes only missing records', async () => {
  for (const section of ['document', 'preferences', 'conversation'] as const) {
    const storage = savedStorage()
    storage.records.delete(section)
    const loaded = await loadPersistence(storage)
    const host = registeredHost(loaded.graph ?? fixture(), loaded)
    const persistence = connectPersistence(host, storage, loaded)
    assert.equal(await persistence.flush(), true)
    assert.deepEqual(storage.writes, [section])
    assert.deepEqual(storage.backups, [])
    await persistence.dispose()
  }
})

test('a failed pre-migration backup protects every section and retries before saving the latest edits', async () => {
  const storage = savedStorage()
  storage.records.set('document', { version: 1, ...legacyDocument() })
  const originals = structuredClone(storage.records)
  const loaded = await loadPersistence(storage)
  const host = registeredHost(loaded.graph!, loaded)
  const backup = storage.backup
  let denied = true
  storage.backup = async () => {
    if (denied) throw new Error('Backup failed')
    await backup()
  }
  const persistence = connectPersistence(host, storage, loaded)
  host.store.setLocale('en')
  host.store.setChatMessages([{ id: 'new', role: 'user', content: 'Unsaved' }])
  assert.equal(await persistence.flush(), false)
  assert.deepEqual(storage.records, originals)
  assert.deepEqual(storage.writes, [])
  assert.match(host.store.getState().persistenceIssues[0].message, /Backup failed/)
  denied = false
  assert.equal(await persistence.flush(), true)
  assert.equal(storage.backups.length, 1)
  assert.deepEqual(storage.backups[0], originals)
  const restored = await loadPersistence(storage)
  assert.equal(restored.preferences?.locale, 'en')
  assert.equal(restored.conversation?.messages[0].content, 'Unsaved')
  assert.deepEqual(host.store.getState().persistenceIssues, [])
  await persistence.dispose()
})

test('plugin data waits for the migrated document identity to be saved without repeating its backup', async () => {
  const storage = savedStorage()
  const original = { version: 1, ...legacyDocument() }
  storage.records.set('document', original)
  const loaded = await loadPersistence(storage)
  const host = registeredHost(loaded.graph!, loaded)
  const write = storage.write
  let denied = true
  storage.write = async (section, value) => {
    if (section === 'document' && denied) throw new Error('Disk full')
    await write(section, value)
  }
  const persistence = connectPersistence(host, storage, loaded)
  setPluginData(host, 'After migration')
  assert.equal(await persistence.flush(), false)
  assert.deepEqual(storage.records.get('document'), original)
  assert.equal(storage.records.has('plugin-storage'), false)
  denied = false
  assert.equal(await persistence.flush(), true)
  assert.equal(storage.backups.length, 1)
  assert.deepEqual(
    (await loadPersistence(storage)).pluginStorage,
    host.store.getState().pluginStorage,
  )
  await persistence.dispose()
})

test('legacy documents migrate view presentation and viewports and collect unsorted concepts', async () => {
  const storage = savedStorage()
  const original = { version: 2, documentId: 'urn:document', ...legacyDocument() }
  const viewport = { x: 100, y: -200, zoom: 0.8 }
  original.workspace.viewports = { graph: viewport }
  storage.records.set('document', original)
  const loaded = await loadPersistence(storage)
  assert.deepEqual(loaded.graph, fixture())
  assert.equal(loaded.documentId, 'urn:document')
  assert.deepEqual(loaded.workspace!.viewports, { [viewportKey('graph', 'urn:view')]: viewport })
  const [pair, unsorted, ...rest] = loaded.workspace!.savedViews
  assert.deepEqual(rest, [])
  assert.deepEqual(pair, workspace().savedViews[0])
  assert.deepEqual(
    { ...unsorted, id: undefined },
    {
      id: undefined,
      name: 'Unsorted',
      pinned: false,
      members: [{ id: 'urn:hidden', position: { x: 50, y: 60 } }],
    },
  )
  const host = registeredHost(loaded.graph!, loaded)
  const persistence = connectPersistence(host, storage, loaded)
  assert.equal(await persistence.flush(), true)
  assert.deepEqual(storage.backups[0].get('document'), original)
  const saved = storage.records.get('document') as {
    version: number
    graph: { schemaVersion: number }
  }
  assert.equal(saved.version, 4)
  assert.equal(saved.graph.schemaVersion, 1)
  assert.deepEqual(parseGraph(saved.graph).views, [])
  await persistence.dispose()
})

test('each view and Overview retain their viewport across navigation and reopening', async () => {
  const storage = savedStorage()
  const loaded = await loadPersistence(storage)
  const host = registeredHost(loaded.graph!, loaded)
  host.registerRenderer({ id: 'knowledge-graph' })
  const { store } = host
  const persistence = connectPersistence(host, storage, loaded)
  const first = { x: 100, y: 200, zoom: 0.8 }
  const second = { x: -50, y: 30, zoom: 1.2 }
  const overview = { x: 20, y: -70, zoom: 0.5 }
  store.setViewport('graph', first)
  const other = store.createView('Other', ['urn:two'])
  store.setViewport('graph', second)
  store.setView(null)
  store.setViewport('knowledge-graph', overview, null)
  store.setView('urn:view')
  const expected = {
    [viewportKey('graph', 'urn:view')]: first,
    [viewportKey('graph', other)]: second,
    [viewportKey('knowledge-graph', null)]: overview,
  }
  assert.equal(await persistence.flush(), true)
  const reopened = await loadPersistence(storage)
  assert.deepEqual(reopened.workspace?.viewports, expected)
  assert.equal(reopened.workspace?.activeViewId, 'urn:view')
  await persistence.dispose()
})

test('MCP intent round-trips in preferences without touching document or conversation records', async () => {
  const storage = savedStorage()
  const loaded = await loadPersistence(storage)
  const host = registeredHost(loaded.graph!, loaded)
  const persistence = connectPersistence(host, storage, loaded)
  storage.writes.length = 0
  host.store.applyOperations([{ kind: 'preferences.mcpEnabled', value: true }])
  assert.equal(await persistence.flush(), true)
  assert.deepEqual(storage.writes, ['preferences'])
  const restored = await loadPersistence(storage)
  const reopened = registeredHost(restored.graph!, restored)
  assert.equal(reopened.store.getState().preferences.mcpEnabled, true)
  await persistence.dispose()
})

test('earlier preferences migrate losslessly and seed the tab order after preserving originals', async () => {
  const current = (await loadPersistence(savedStorage())).preferences!
  const { canvasTabOrder: _, ...legacy } = current
  assert.deepEqual(current.canvasTabOrder, ['@nesso-how/notes:notes', '@nesso-how/review:review'])
  for (const original of [
    { version: 1, preferences: legacy },
    { version: 2, preferences: { ...legacy, disabledBundledActionPlugins: ['@nesso-how/export'] } },
  ]) {
    const storage = savedStorage()
    storage.records.set('preferences', original)
    const loaded = await loadPersistence(storage)
    const expected: Preferences = {
      ...original.preferences,
      canvasTabOrder: current.canvasTabOrder,
    }
    assert.deepEqual(loaded.preferences, expected)
    const host = registeredHost(loaded.graph!, loaded)
    const persistence = connectPersistence(host, storage, loaded)
    assert.equal(await persistence.flush(), true)
    assert.deepEqual(storage.writes, ['preferences'])
    assert.equal(storage.backups.length, 1)
    assert.deepEqual(storage.backups[0].get('preferences'), original)
    assert.deepEqual(storage.records.get('preferences'), { version: 3, preferences: expected })
    await persistence.dispose()
  }
})

test('earlier conversations migrate losslessly before saving message statistics', async () => {
  const original = {
    version: 1,
    messages: [
      { id: 'user', role: 'user', content: 'Hello' },
      {
        id: 'assistant',
        role: 'assistant',
        content: 'Applied.',
        outcome: 'applied',
        summary: { added: 1, updated: 0, removed: 0, memberships: 0 },
      },
    ],
  }
  const storage = savedStorage()
  storage.records.set('conversation', original)
  const loaded = await loadPersistence(storage)
  assert.deepEqual(loaded.conversation?.messages, original.messages)
  assert.deepEqual(loaded.upgrades?.conversation, { version: 2, messages: original.messages })
  const host = registeredHost(loaded.graph!, loaded)
  const persistence = connectPersistence(host, storage, loaded)
  assert.equal(await persistence.flush(), true)
  assert.deepEqual(storage.writes, ['conversation'])
  assert.equal(storage.backups.length, 1)
  assert.deepEqual(storage.backups[0].get('conversation'), original)
  assert.deepEqual(storage.records.get('conversation'), {
    version: 2,
    messages: original.messages,
  })
  await persistence.dispose()
})

test('plugin resolution saves corrected preferences without rewriting other records', async () => {
  const storage = savedStorage()
  const original = await loadPersistence(storage)
  storage.records.set('preferences', {
    version: 3,
    preferences: {
      ...original.preferences,
      activeVocabId: 'unavailable-vocab',
      activeRendererId: 'unavailable-renderer',
      activeThemeId: 'unavailable-theme',
    },
  })
  const loaded = await loadPersistence(storage)
  const host = registeredHost(loaded.graph!, loaded)
  const persistence = connectPersistence(host, storage, loaded)
  await persistence.flush()
  assert.deepEqual(storage.writes, ['preferences'])
  assert.deepEqual((await loadPersistence(storage)).preferences, original.preferences)
  await persistence.dispose()
})

test('startup saves durable changes made before autosave connects', async () => {
  const changes: {
    section: PersistenceSection
    apply: (host: ReturnType<typeof registeredHost>) => void
  }[] = [
    {
      section: 'document',
      apply: (host) => {
        host.store.setConceptLabel('urn:one', 'Changed before autosave')
      },
    },
    {
      section: 'document',
      apply: (host) => {
        host.store.setConceptNotes('urn:one', 'Changed notes')
      },
    },
    {
      section: 'document',
      apply: (host) => {
        host.store.setViewport('graph', { x: 30, y: 40, zoom: 0.75 })
      },
    },
    {
      section: 'conversation',
      apply: (host) => {
        host.store.clearChat()
      },
    },
    {
      section: 'preferences',
      apply: (host) => {
        host.store.applyOperations([{ kind: 'preferences.inspectorTab', value: 'chat' }])
      },
    },
  ]
  for (const { section, apply } of changes) {
    const storage = savedStorage()
    const loaded = await loadPersistence(storage)
    const host = registeredHost(loaded.graph!, loaded)
    apply(host)
    const persistence = connectPersistence(host, storage, loaded)
    await persistence.flush()
    assert.deepEqual(storage.writes, [section])
    const restored = await loadPersistence(storage)
    for (const key of ['graph', 'workspace', 'preferences', 'conversation'] as const) {
      assert.deepEqual(restored[key], host.store.getState()[key])
    }
    await persistence.dispose()
  }
})

test('record reads start in parallel and isolate failures in section order', async () => {
  const storage = savedStorage()
  const started: PersistenceSection[] = []
  const completions = new Map<
    PersistenceSection,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >()
  const loading = loadPersistence({
    read: (section) =>
      new Promise((resolve, reject) => {
        started.push(section)
        completions.set(section, { resolve, reject })
      }),
  })
  assert.deepEqual(started, ['document', 'preferences', 'conversation', 'plugin-storage'])
  completions.get('plugin-storage')!.resolve(undefined)
  completions.get('conversation')!.resolve({ version: 3, messages: [] })
  completions.get('preferences')!.reject(new Error('Access denied'))
  completions.get('document')!.resolve(storage.records.get('document'))
  const loaded = await loading
  assert.deepEqual(loaded.graph, fixture())
  assert.deepEqual(loaded.blocked, ['preferences', 'conversation'])
  assert.equal(loaded.issues.length, 2)
  assert.equal(loaded.issues[0].path, 'preferences')
  assert.match(loaded.issues[0].message, /Access denied/)
  assert.equal(loaded.issues[1].path, 'conversation.version')
  assert.equal(loaded.preferences, undefined)
  assert.equal(loaded.conversation, undefined)
  assert.deepEqual(
    loaded.issues.map(({ section, operation }) => ({ section, operation })),
    [
      { section: 'preferences', operation: 'read' },
      { section: 'conversation', operation: 'read' },
    ],
  )
})

test('durable state round-trips without rewriting restored records or persisting runtime state', async () => {
  const storage = memoryStorage()
  const host = registeredHost(fixture())
  const viewId = host.store.createView('Pair', ['urn:one', 'urn:two'])
  host.store.setViewPinned(viewId, true)
  host.store.setPanelSizes({ explorerWidth: 310, inspectorWidth: 330 })
  host.store.setLocale('zh-CN')
  host.store.applyOperations([{ kind: 'preferences.relationGroups', value: false }])
  host.store.applyOperations([{ kind: 'preferences.intro-seen' }])
  for (const id of sectionIds) host.store.setSectionOpen(id, false)
  host.store.applyOperations([{ kind: 'preferences.inspectorTab', value: 'chat' }])
  host.store.applyOperations([
    { kind: 'preferences.disabledBundledActionPlugins', value: ['@nesso-how/notes'] },
  ])
  host.store.setViewport('graph', { x: 100, y: 200, zoom: 0.75 })
  host.store.setConceptLabel('urn:one', 'Renamed')
  host.store.setChatMessages([
    {
      id: 'assistant',
      role: 'assistant',
      content: 'Proposed rename.',
      outcome: 'applied',
      stats: { durationMs: 1234, totalTokens: 56 },
    },
  ])
  host.store.setSelection([{ kind: 'concept', id: 'urn:one' }])
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  host.store.renameView(viewId, 'Renamed pair')
  await persistence.flush()
  const saved = storage.records.get('document') as { graph: unknown }
  assert.deepEqual(Object.keys(saved), ['version', 'documentId', 'graph', 'workspace'])
  assert.deepEqual(parseGraph(saved.graph), { graph: host.store.getState().graph, views: [] })
  const restored = await loadPersistence(storage)
  const reopenedHost = registeredHost(restored.graph!, restored)
  const reopened = reopenedHost.store.getState()
  for (const key of ['graph', 'workspace', 'preferences', 'conversation'] as const) {
    assert.deepEqual(reopened[key], host.store.getState()[key])
  }
  assert.deepEqual(reopened.selected, [])
  assert.equal(reopened.preferences.inspectorTab, 'chat')
  assert.equal(reopened.preferences.relationGroups, false)
  assert.deepEqual(reopened.history, { canUndo: false, canRedo: false })
  assert.deepEqual(reopened.persistenceIssues, [])
  assert.deepEqual(
    reopened.viewGraph.concepts.map(({ id }) => id),
    ['urn:one', 'urn:two'],
  )
  assert.deepEqual(Object.keys(storage.records.get('conversation') as object), [
    'version',
    'messages',
  ])
  assert.equal('themes' in (storage.records.get('preferences') as object), false)
  storage.writes.length = 0
  const reopenedPersistence = connectPersistence(reopenedHost, storage, restored)
  await reopenedPersistence.flush()
  await reopenedPersistence.dispose()
  assert.deepEqual(storage.writes, [])
  const preferences = host.store.getState().preferences
  host.store.resetGraph()
  await persistence.flush()
  const reset = await loadPersistence(storage)
  assert.equal(reset.graph?.concepts.length, 1)
  assert.deepEqual(reset.workspace, {
    activeViewId: reset.workspace?.savedViews[0].id,
    savedViews: [
      {
        id: reset.workspace?.savedViews[0].id,
        name: 'View 1',
        pinned: false,
        members: [{ id: reset.graph?.concepts[0].id, position: { x: 0, y: 0 } }],
      },
    ],
    viewports: {},
  })
  assert.deepEqual(reset.preferences, preferences)
  assert.deepEqual(reset.conversation?.messages, [])
  storage.records.set('document', {
    version: 2,
    documentId: 'urn:deleted',
    graph: null,
    workspace: null,
  })
  const deleted = await loadPersistence(storage)
  assert.equal(
    registeredHost(deleted.graph ?? null, deleted).store.getState().graph.concepts.length,
    1,
  )
  await persistence.dispose()
})

test('autosave writes continuous edits within the maximum delay', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const storage = memoryStorage()
  const host = registeredHost(fixture())
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  await persistence.flush()
  storage.writes.length = 0
  const settle = () => new Promise((resolve) => setImmediate(resolve))
  for (let step = 1; step < 20; step++) {
    host.store.setConceptLabel('urn:one', `Step ${step}`)
    context.mock.timers.tick(100)
  }
  await settle()
  assert.deepEqual(storage.writes, [])
  host.store.setConceptLabel('urn:one', 'Step 20')
  context.mock.timers.tick(100)
  await settle()
  assert.deepEqual(storage.writes, ['document'])
  assert.equal((await loadPersistence(storage)).graph?.concepts[0].label, 'Step 20')
  host.store.setConceptLabel('urn:one', 'Later')
  context.mock.timers.tick(199)
  await settle()
  assert.deepEqual(storage.writes, ['document'])
  context.mock.timers.tick(1)
  await settle()
  assert.deepEqual(storage.writes, ['document', 'document'])
  await persistence.dispose()
})

test('autosave debounces durable sections and drains edits on shutdown', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const storage = memoryStorage()
  const host = registeredHost(fixture())
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  await persistence.flush()
  storage.writes.length = 0
  host.store.setSelection([{ kind: 'concept', id: 'urn:one' }])
  context.mock.timers.tick(200)
  assert.deepEqual(storage.writes, [])
  host.store.setConceptLabel('urn:one', 'First')
  context.mock.timers.tick(100)
  host.store.setConceptLabel('urn:one', 'Last')
  context.mock.timers.tick(199)
  assert.deepEqual(storage.writes, [])
  context.mock.timers.tick(1)
  await persistence.flush()
  assert.deepEqual(storage.writes, ['document'])
  assert.equal((await loadPersistence(storage)).graph?.concepts[0].label, 'Last')
  host.store.undo()
  await persistence.flush()
  assert.equal((await loadPersistence(storage)).graph?.concepts[0].label, 'First')
  host.store.redo()
  await persistence.flush()
  assert.equal((await loadPersistence(storage)).graph?.concepts[0].label, 'Last')
  storage.writes.length = 0
  host.store.setSectionOpen('inspector.connections', false)
  await persistence.flush()
  assert.deepEqual(storage.writes, ['preferences'])
  storage.writes.length = 0
  host.store.applyOperations([{ kind: 'preferences.intro-seen' }])
  await persistence.flush()
  assert.deepEqual(storage.writes, ['preferences'])
  assert.equal((await loadPersistence(storage)).preferences?.introSeen, true)
  storage.writes.length = 0
  host.store.applyOperations([{ kind: 'preferences.inspectorTab', value: 'chat' }])
  await persistence.flush()
  assert.deepEqual(storage.writes, ['preferences'])
  assert.equal((await loadPersistence(storage)).preferences?.inspectorTab, 'chat')
  storage.writes.length = 0
  host.store.setChatMessages([
    { id: 'assistant', role: 'assistant', content: 'Complete', outcome: 'complete' },
  ])
  await persistence.flush()
  assert.deepEqual(storage.writes, ['conversation'])
  host.store.setConceptLabel('urn:one', 'Before closing')
  await persistence.dispose()
  assert.equal((await loadPersistence(storage)).graph?.concepts[0].label, 'Before closing')
  storage.writes.length = 0
  host.store.setConceptLabel('urn:one', 'After closing')
  await persistence.flush()
  assert.deepEqual(storage.writes, [])
})

test('malformed records stay protected while the other sections save', async () => {
  const state = registeredHost(fixture()).store.getState()
  const longConcept = fixture()
  longConcept.concepts[0].label = 'x'.repeat(maxConceptLabelLength + 1)
  const longType = fixture()
  longType.relationTypes[0].label = 'x'.repeat(maxRelationLabelLength + 1)
  const invalid: [PersistenceSection, unknown, string?][] = [
    ['document', null],
    ['preferences', null],
    ['conversation', null],
    ['conversation', { version: 3, messages: [] }],
    [
      'conversation',
      { version: 1, messages: [{ id: 'invalid', role: 'system', content: 'Invalid' }] },
    ],
    ['document', { version: 2 }],
    [
      'document',
      { version: 99, graph: serializeGraph(fixture()), workspace: state.workspace },
      'document.version',
    ],
    [
      'document',
      {
        version: 3,
        documentId: state.documentId,
        graph: { ...serializeGraph(fixture()), schemaVersion: 2 },
        workspace: state.workspace,
      },
      'document.schemaVersion',
    ],
    [
      'document',
      {
        version: 3,
        documentId: state.documentId,
        graph: serializeGraph(longConcept),
        workspace: state.workspace,
      },
    ],
    [
      'document',
      {
        version: 3,
        documentId: state.documentId,
        graph: serializeGraph(longType),
        workspace: state.workspace,
      },
    ],
    [
      'document',
      {
        version: 3,
        documentId: state.documentId,
        graph: serializeGraph({ concepts: [], relations: [], relationTypes: [] }),
        workspace: state.workspace,
      },
    ],
    [
      'document',
      {
        version: 3,
        documentId: state.documentId,
        graph: serializeGraph(fixture()),
        workspace: { ...state.workspace, activeViewId: 'unknown' },
      },
    ],
    [
      'document',
      {
        version: 3,
        documentId: state.documentId,
        graph: serializeGraph(fixture()),
        workspace: {
          ...state.workspace,
          savedViews: [
            {
              id: 'bad',
              name: 'Bad',
              pinned: false,
              members: [{ id: 'missing', position: { x: 0, y: 0 } }],
            },
          ],
        },
      },
    ],
    [
      'document',
      {
        version: 3,
        documentId: state.documentId,
        graph: legacyDocument().graph,
        workspace: state.workspace,
      },
    ],
    ['preferences', { version: 3, preferences: { ...state.preferences, activeThemeId: null } }],
    ...[null, 'invalid', 1].map((inspectorTab): [PersistenceSection, unknown] => [
      'preferences',
      { version: 3, preferences: { ...state.preferences, inspectorTab } },
    ]),
    [
      'preferences',
      {
        version: 3,
        preferences: { ...state.preferences, panels: { explorerWidth: 0, inspectorWidth: 280 } },
      },
    ],
    ...[null, ['missing'], ['sidebar', 'sidebar']].map(
      (collapsedSections): [PersistenceSection, unknown] => [
        'preferences',
        { version: 3, preferences: { ...state.preferences, collapsedSections } },
      ],
    ),
    ['preferences', { version: 3, preferences: { ...state.preferences, locale: 'fr' } }],
    ['preferences', { version: 3, preferences: { ...state.preferences, introSeen: 'true' } }],
    [
      'preferences',
      { version: 3, preferences: { ...state.preferences, inspectorTab: 'content' } },
      'preferences.inspectorTab',
    ],
  ]
  for (const [section, value, expectedPath] of invalid) {
    const storage = memoryStorage()
    storage.records.set(section, value)
    const loaded = await loadPersistence(storage)
    assert.deepEqual(loaded.blocked, [section])
    if (section === 'document') {
      const restored = initializeNessoStore(loaded, ['en']).store.getState()
      assert.equal(restored.graph.concepts.length, 1)
      assert.deepEqual(restored.persistenceIssues, loaded.issues)
    }
    if (expectedPath) assert.equal(loaded.issues[0].path, expectedPath)
    const host = registeredHost(loaded.graph ?? fixture(), loaded)
    const initial = host.store.getState()
    const persistence = connectPersistence(host, storage, loaded)
    assert.equal(await persistence.flush(), true)
    host.store.setConceptLabel('urn:one', 'Memory only')
    host.store.setPanelSizes({ explorerWidth: 300, inspectorWidth: 350 })
    assert.equal(await persistence.flush(), section === 'conversation')
    assert.deepEqual(storage.records.get(section), value)
    assert.equal(storage.writes.includes(section), false)
    assert.deepEqual(host.store.getState().persistenceIssues, loaded.issues)
    host.store.undo()
    host.store.setPanelSizes(initial.preferences.panels)
    assert.equal(await persistence.flush(), true)
    await persistence.dispose()
  }
})

test('an unreadable conversation is overwritten only after explicit clear', async () => {
  const storage = memoryStorage()
  storage.records.set('conversation', 'unreadable')
  const loaded = await loadPersistence(storage)
  const host = registeredHost(fixture(), loaded)
  const persistence = connectPersistence(host, storage, loaded)
  host.store.setChatMessages([{ id: 'user', role: 'user', content: 'Hello' }])
  assert.equal(await persistence.flush(), false)
  assert.equal(storage.records.get('conversation'), 'unreadable')
  host.store.resetGraph()
  assert.deepEqual(host.store.getState().conversation.messages, [])
  assert.equal(await persistence.flush(), true)
  assert.equal(storage.records.get('conversation'), 'unreadable')
  assert.ok(host.store.getState().persistenceIssues.some(({ path }) => path === 'conversation'))
  host.store.clearChat()
  assert.equal(await persistence.flush(), true)
  assert.deepEqual(storage.records.get('conversation'), { version: 2, messages: [] })
  assert.deepEqual(host.store.getState().persistenceIssues, [])
  await persistence.dispose()
})

test('storage failures preserve records and allow retrying the latest edits', async () => {
  const denied = await loadPersistence(
    createIndexedDbStorage(() => {
      throw new Error('Access denied')
    }),
  )
  assert.deepEqual(denied.blocked, ['document', 'preferences', 'conversation', 'plugin-storage'])
  assert.match(denied.issues[0].message, /Access denied/)
  const storage = memoryStorage()
  let deniedWrite = false
  const limited = createDesktopStorage({
    read: async (section) => ({ value: await storage.read(section) }),
    write: async (section, value) => {
      if (deniedWrite) return { issues: [{ path: '', message: 'Disk full' }] }
      await storage.write(section, value)
      return { value: null }
    },
    beforeClose: () => () => {},
    backup: async () => {
      await storage.backup()
      return { value: null }
    },
    snapshot: async () => ({ value: null }),
  })
  const host = registeredHost(fixture())
  const persistence = connectPersistence(host, limited, await loadPersistence(limited))
  await persistence.flush()
  const original = storage.records.get('document')
  deniedWrite = true
  host.store.setConceptLabel('urn:one', 'Unsaved')
  assert.equal(await persistence.flush(), false)
  assert.deepEqual(storage.records.get('document'), original)
  assert.deepEqual(host.store.getState().persistenceIssues, [
    { section: 'document', operation: 'write', path: 'document', message: 'Disk full' },
  ])
  deniedWrite = false
  assert.equal(await persistence.flush(), true)
  assert.equal((await loadPersistence(limited)).graph?.concepts[0].label, 'Unsaved')
  assert.deepEqual(host.store.getState().persistenceIssues, [])
  await persistence.dispose()
})

test('flush serializes overlapping writes and drains changes made during a save', async () => {
  const storage = memoryStorage()
  const host = registeredHost(fixture())
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  const write = storage.write
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let active = 0
  storage.write = async (section, value) => {
    active++
    assert.equal(active, 1)
    await gate
    await write(section, value)
    active--
  }
  host.store.setConceptLabel('urn:one', 'First')
  setPluginData(host, 'First')
  const saving = persistence.flush()
  await Promise.resolve()
  host.store.setConceptLabel('urn:one', 'Latest')
  setPluginData(host, 'Latest', 1)
  host.store.setLocale('it')
  host.store.setChatMessages([{ id: 'user', role: 'user', content: 'Latest' }])
  const overlapping = persistence.flush()
  release()
  await Promise.all([saving, overlapping])
  const restored = await loadPersistence(storage)
  assert.equal(restored.graph?.concepts[0].label, 'Latest')
  assert.equal(restored.preferences?.locale, 'it')
  assert.equal(restored.conversation?.messages[0].content, 'Latest')
  assert.deepEqual(restored.pluginStorage, host.store.getState().pluginStorage)
  await persistence.dispose()
})

test('explicit recovery replaces only the chosen record and keeps failed replacements protected', async () => {
  const storage = savedStorage()
  storage.records.set('preferences', 'unreadable')
  storage.records.set('conversation', 'unreadable')
  storage.records.set('plugin-storage', 'unreadable')
  const loaded = await loadPersistence(storage)
  const host = registeredHost(loaded.graph!, loaded)
  const write = storage.write
  let denied = true
  storage.write = async (section, value) => {
    if (denied) throw new Error('Disk full')
    await write(section, value)
  }
  const persistence = connectPersistence(host, storage, loaded)
  assert.equal(await persistence.recover('preferences'), false)
  denied = false
  await persistence.flush()
  assert.equal(storage.records.get('preferences'), 'unreadable')
  assert.deepEqual(storage.writes, [])
  assert.equal(await persistence.recover('preferences'), true)
  assert.deepEqual(storage.writes, ['preferences'])
  assert.deepEqual((await loadPersistence(storage)).blocked, ['conversation', 'plugin-storage'])
  assert.equal(
    host.store.getState().persistenceIssues.some((issue) => issue.section === 'preferences'),
    false,
  )
  host.store.setLocale('en')
  assert.equal(await persistence.flush(), true)
  assert.deepEqual(storage.writes, ['preferences', 'preferences'])
  setPluginData(host, 'New')
  assert.equal(await persistence.flush(), false)
  assert.equal(storage.records.get('plugin-storage'), 'unreadable')
  assert.equal(await persistence.recover('plugin-storage'), true)
  const restored = await loadPersistence(storage)
  assert.deepEqual(restored.blocked, ['conversation'])
  assert.deepEqual(restored.pluginStorage, host.store.getState().pluginStorage)
  assert.deepEqual(storage.writes, ['preferences', 'preferences', 'plugin-storage'])
  await persistence.dispose()
})

test('workspace-only changes reuse the serialized graph', async () => {
  const host = registeredHost(fixture())
  const graphs: unknown[] = []
  const storage: PersistenceStorage = {
    backup: async () => {},
    read: async () => undefined,
    write: async (section, value) => {
      if (section !== 'document') return
      graphs.push((value as { graph: unknown }).graph)
    },
  }
  const persistence = connectPersistence(host, storage, await loadPersistence(storage))
  await persistence.flush()
  host.store.setViewport('graph', { x: 10, y: 20, zoom: 0.5 })
  await persistence.flush()
  assert.equal(graphs.length, 2)
  assert.equal(graphs[1], graphs[0])
  await persistence.dispose()
})
