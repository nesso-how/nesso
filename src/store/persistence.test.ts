import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGraph, serializeGraph, type Graph } from '@nesso/schema'
import { createNessoStore } from './create.ts'
import { connectPersistence, loadPersistence, storageKeys } from './persistence.ts'
import { sectionIds } from './types.ts'

const fixture = (): Graph => ({
  concepts: [
    { id: 'urn:one', label: 'One', position: { x: 10, y: 20 } },
    { id: 'urn:two', label: 'Two', position: { x: 30, y: 40 } },
    { id: 'urn:hidden', label: 'Hidden', position: { x: 50, y: 60 } },
  ],
  relations: [{ source: 'urn:one', predicate: 'urn:links', target: 'urn:two' }],
  relationTypes: [{ id: 'urn:links', label: 'links' }, { id: 'urn:unused', label: 'unused' }],
})

const memoryStorage = () => {
  const records = new Map<string, string>()
  const writes: string[] = []
  return {
    records,
    writes,
    getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => {
      records.set(key, value)
      writes.push(key)
    },
  }
}

const registeredHost = (graph: Graph | null, restored = {}) => {
  const host = createNessoStore(graph, restored)
  host.registerVocab({
    id: 'vocab', label: 'Vocabulary', defaultTypeId: 'urn:links',
    relationTypes: [{ id: 'urn:links', label: 'links' }],
  })
  host.registerRenderer({ id: 'graph', label: 'Graph', component: () => null })
  host.registerTheme({ id: 'light', label: 'Light' })
  return host
}

test('local persistence round-trips document, workspace, preferences and conversation, not runtime state', () => {
  const storage = memoryStorage()
  const loaded = loadPersistence(() => storage)
  const host = registeredHost(fixture())
  const viewId = host.store.createView('Pair', ['urn:one', 'urn:two'])
  host.store.setViewPinned(viewId, true)
  host.store.setPanelSizes({ explorerWidth: 310, inspectorWidth: 330 })
  host.store.setLocale('it')
  for (const id of sectionIds) host.store.setSectionOpen(id, false)
  host.store.setViewport('graph', { x: 100, y: 200, zoom: 0.75 })
  host.store.setConceptLabel('urn:one', 'Renamed')
  host.store.setChatMessages([{ id: 'assistant', role: 'assistant', content: 'Proposed rename.', outcome: 'applied' }])
  host.store.setSelection([{ kind: 'concept', id: 'urn:one' }, { kind: 'concept', id: 'urn:two' }])
  const persistence = connectPersistence(host, () => storage, loaded)
  host.store.renameView(viewId, 'Renamed pair')
  persistence.flush()
  const saved = JSON.parse(storage.records.get(storageKeys.document)!)
  assert.deepEqual(Object.keys(saved), ['version', 'graph', 'workspace'])
  assert.deepEqual(parseGraph(saved.graph), host.store.getState().graph)
  assert.equal(saved.graph['@graph'].length, 5)
  assert.equal(host.store.getState().viewGraph.concepts.length, 2)
  const restored = loadPersistence(() => storage)
  const reopened = registeredHost(restored.graph!, restored).store.getState()
  assert.deepEqual(reopened.graph, host.store.getState().graph)
  assert.deepEqual(reopened.workspace, host.store.getState().workspace)
  assert.equal(reopened.workspace.savedViews[0].name, 'Renamed pair')
  assert.deepEqual(reopened.preferences, host.store.getState().preferences)
  assert.deepEqual(reopened.conversation, host.store.getState().conversation)
  assert.deepEqual(Object.keys(JSON.parse(storage.records.get(storageKeys.conversation)!)), ['version', 'messages'])
  assert.deepEqual(reopened.preferences.collapsedSections, sectionIds)
  assert.deepEqual(reopened.selected, [])
  assert.deepEqual(reopened.history, { canUndo: false, canRedo: false })
  assert.deepEqual(reopened.persistenceIssues, [])
  assert.deepEqual(reopened.viewGraph.concepts.map(({ id }) => id), ['urn:one', 'urn:two'])
  const preferences = host.store.getState().preferences
  const savedPreferences = JSON.parse(storage.records.get(storageKeys.preferences)!)
  assert.equal(savedPreferences.preferences.activeThemeId, 'light')
  assert.equal('themes' in savedPreferences.preferences, false)
  assert.equal('themes' in saved, false)
  host.store.resetGraph()
  const reset = host.store.getState()
  assert.equal(reset.graph.concepts.length, 1)
  assert.deepEqual(reset.graph.relations, [])
  assert.deepEqual(reset.graph.relationTypes, [])
  assert.deepEqual(reset.workspace, { activeViewId: null, savedViews: [], viewports: {} })
  assert.deepEqual(reset.selected, [])
  assert.equal(reset.preferences, preferences)
  assert.deepEqual(reset.conversation.messages, [])
  persistence.flush()
  const savedReset = loadPersistence(() => storage)
  assert.deepEqual(registeredHost(savedReset.graph!, savedReset).store.getState().graph, reset.graph)
  storage.records.set(storageKeys.document, JSON.stringify({ version: 1, graph: null, workspace: null }))
  const deleted = loadPersistence(() => storage)
  assert.equal(registeredHost(deleted.graph ?? null, deleted).store.getState().graph.concepts.length, 1)
  persistence.dispose()
})

test('autosave debounces durable sections only and flushes pending edits on shutdown', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const storage = memoryStorage()
  const host = registeredHost(fixture())
  const persistence = connectPersistence(host, () => storage, loadPersistence(() => storage))
  persistence.flush()
  storage.writes.length = 0
  host.store.setSelection([{ kind: 'concept', id: 'urn:one' }, { kind: 'concept', id: 'urn:two' }])
  context.mock.timers.tick(200)
  assert.deepEqual(storage.writes, [])
  host.store.setConceptLabel('urn:one', 'First')
  context.mock.timers.tick(100)
  host.store.setConceptLabel('urn:one', 'Last')
  context.mock.timers.tick(199)
  assert.deepEqual(storage.writes, [])
  context.mock.timers.tick(1)
  assert.deepEqual(storage.writes, [storageKeys.document])
  assert.equal(loadPersistence(() => storage).graph?.concepts[0].label, 'Last')
  host.store.undo()
  context.mock.timers.tick(200)
  assert.equal(loadPersistence(() => storage).graph?.concepts[0].label, 'First')
  host.store.redo()
  context.mock.timers.tick(200)
  assert.equal(loadPersistence(() => storage).graph?.concepts[0].label, 'Last')
  storage.writes.length = 0
  host.store.setPanelSizes({ explorerWidth: 300, inspectorWidth: 350 })
  context.mock.timers.tick(200)
  assert.deepEqual(storage.writes, [storageKeys.preferences])
  storage.writes.length = 0
  host.store.setSectionOpen('inspector.connections', false)
  context.mock.timers.tick(200)
  assert.deepEqual(storage.writes, [storageKeys.preferences])
  assert.deepEqual(loadPersistence(() => storage).preferences?.collapsedSections, ['inspector.connections'])
  storage.writes.length = 0
  host.store.setChatMessages([{ id: 'assistant', role: 'assistant', content: 'First', outcome: 'cancelled' }])
  context.mock.timers.tick(100)
  host.store.setChatMessages([{ id: 'assistant', role: 'assistant', content: 'Complete', outcome: 'complete' }])
  context.mock.timers.tick(199)
  assert.deepEqual(storage.writes, [])
  context.mock.timers.tick(1)
  assert.deepEqual(storage.writes, [storageKeys.conversation])
  assert.equal(loadPersistence(() => storage).conversation?.messages[0].outcome, 'complete')
  host.store.setConceptLabel('urn:one', 'Before closing')
  persistence.dispose()
  assert.equal(loadPersistence(() => storage).graph?.concepts[0].label, 'Before closing')
  storage.writes.length = 0
  host.store.setConceptLabel('urn:one', 'After closing')
  persistence.flush()
  assert.deepEqual(storage.writes, [])
})

test('legacy theme-less preferences restore without blocking, while malformed theme ids remain protected', () => {
  const storage = memoryStorage()
  const legacy = {
    activeVocabId: 'vocab',
    activeRendererId: 'graph',
    panels: { explorerWidth: 310, inspectorWidth: 330 },
  }
  storage.records.set(storageKeys.preferences, JSON.stringify({ version: 1, preferences: legacy }))
  const loaded = loadPersistence(() => storage)
  assert.deepEqual(loaded.blocked, [])
  assert.deepEqual(loaded.issues, [])
  assert.equal(loaded.preferences?.activeThemeId, '')
  const host = registeredHost(fixture(), loaded)
  assert.equal(host.store.getState().preferences.activeThemeId, 'light')
  assert.deepEqual(host.store.getState().preferences.panels, legacy.panels)
  const persistence = connectPersistence(host, () => storage, loaded)
  persistence.flush()
  assert.equal(loadPersistence(() => storage).preferences?.activeThemeId, 'light')
  host.registerTheme({ id: 'alternative', label: 'Alternative' })
  host.store.setActiveTheme('alternative')
  persistence.flush()
  const restored = loadPersistence(() => storage)
  const reopened = registeredHost(restored.graph!, restored)
  reopened.registerTheme({ id: 'alternative', label: 'Alternative' })
  assert.equal(reopened.store.getState().preferences.activeThemeId, 'alternative')
  persistence.dispose()
  const invalid = JSON.stringify({ version: 1, preferences: { ...legacy, activeThemeId: null } })
  storage.records.set(storageKeys.preferences, invalid)
  const blocked = loadPersistence(() => storage)
  assert.deepEqual(blocked.blocked, ['preferences'])
  assert.match(blocked.issues[0].path, /activeThemeId/)
  const protectedPersistence = connectPersistence(registeredHost(fixture(), blocked), () => storage, blocked)
  protectedPersistence.flush()
  assert.equal(storage.records.get(storageKeys.preferences), invalid)
  protectedPersistence.dispose()
})

test('invalid records are reported and never overwritten while the other section can still save', () => {
  const state = registeredHost(fixture()).store.getState()
  const invalid = [
    ['document', '{broken json'],
    ['preferences', '{broken json'],
    ['conversation', '{broken json'],
    ['conversation', JSON.stringify({ version: 2, messages: [] })],
    ['conversation', JSON.stringify({ version: 1, messages: [{ id: 'invalid', role: 'system', content: 'Invalid' }] })],
    ['document', JSON.stringify({ version: 2 })],
    ['document', JSON.stringify({ version: 1, graph: serializeGraph({ concepts: [], relations: [], relationTypes: [] }), workspace: state.workspace })],
    ['document', JSON.stringify({ version: 1, graph: serializeGraph(fixture()), workspace: { ...state.workspace, activeViewId: 'unknown' } })],
    ['document', JSON.stringify({ version: 1, graph: serializeGraph(fixture()), workspace: { ...state.workspace, savedViews: [{ id: 'bad', name: 'Bad', pinned: false, conceptIds: ['missing'] }] } })],
    ['preferences', JSON.stringify({ version: 1, preferences: { ...state.preferences, panels: { explorerWidth: 0, inspectorWidth: 280 } } })],
    ['preferences', JSON.stringify({ version: 1, preferences: { ...state.preferences, collapsedSections: null } })],
    ['preferences', JSON.stringify({ version: 1, preferences: { ...state.preferences, collapsedSections: ['missing'] } })],
    ['preferences', JSON.stringify({ version: 1, preferences: { ...state.preferences, collapsedSections: ['sidebar', 'sidebar'] } })],
    ['preferences', JSON.stringify({ version: 1, preferences: { ...state.preferences, locale: 'fr' } })],
  ] as const
  for (const [section, text] of invalid) {
    const storage = memoryStorage()
    storage.records.set(storageKeys[section], text)
    const loaded = loadPersistence(() => storage)
    assert.deepEqual(loaded.blocked, [section])
    assert.ok(loaded.issues[0].path.startsWith(section))
    const host = registeredHost(loaded.graph ?? fixture(), loaded)
    const persistence = connectPersistence(host, () => storage, loaded)
    host.store.setConceptLabel('urn:one', 'Memory only')
    host.store.setPanelSizes({ explorerWidth: 300, inspectorWidth: 350 })
    persistence.flush()
    assert.equal(storage.records.get(storageKeys[section]), text)
    assert.equal(storage.writes.includes(storageKeys[section]), false)
    assert.deepEqual(host.store.getState().persistenceIssues, loaded.issues)
    assert.equal(storage.writes.length, 2)
    persistence.dispose()
  }
})

test('an unreadable conversation stays protected with in-memory messages until explicit clear', () => {
  for (const messages of [[], [{ id: 'user', role: 'user' as const, content: 'Hello' }]]) {
    const storage = memoryStorage()
    storage.records.set(storageKeys.conversation, 'unreadable')
    const loaded = loadPersistence(() => storage)
    const host = registeredHost(fixture(), loaded)
    const persistence = connectPersistence(host, () => storage, loaded)
    if (messages.length) host.store.setChatMessages(messages)
    persistence.flush()
    assert.deepEqual(host.store.getState().conversation.messages, messages)
    assert.equal(storage.records.get(storageKeys.conversation), 'unreadable')
    const before = host.store.getState()
    host.store.clearChat()
    persistence.flush()
    assert.deepEqual(JSON.parse(storage.records.get(storageKeys.conversation)!), { version: 1, messages: [] })
    assert.deepEqual(host.store.getState().persistenceIssues, [])
    assert.equal(host.store.getState().graph, before.graph)
    persistence.dispose()
  }
})

test('storage failures are reported, preserve saved data and allow retrying in-memory edits', () => {
  const denied = loadPersistence(() => { throw new Error('Access denied') })
  assert.deepEqual(denied.blocked, ['document', 'preferences', 'conversation'])
  assert.equal(denied.issues.length, 3)
  const storage = memoryStorage()
  const host = registeredHost(fixture())
  const loaded = loadPersistence(() => storage)
  let quotaExceeded = false
  const limited = {
    getItem: storage.getItem,
    setItem: (key: string, value: string) => {
      if (quotaExceeded && (key === storageKeys.document || key === storageKeys.conversation)) throw new Error('Quota exceeded')
      storage.setItem(key, value)
    },
  }
  const persistence = connectPersistence(host, () => limited, loaded)
  persistence.flush()
  const original = storage.records.get(storageKeys.document)
  const originalConversation = storage.records.get(storageKeys.conversation)
  quotaExceeded = true
  host.store.setConceptLabel('urn:one', 'Unsaved')
  host.store.setChatMessages([{ id: 'user', role: 'user', content: 'Unsaved' }])
  persistence.flush()
  assert.equal(storage.records.get(storageKeys.document), original)
  assert.equal(storage.records.get(storageKeys.conversation), originalConversation)
  assert.match(host.store.getState().persistenceIssues[0].message, /Quota/)
  quotaExceeded = false
  host.store.setConceptLabel('urn:one', 'Latest')
  persistence.flush()
  assert.equal(loadPersistence(() => storage).graph?.concepts[0].label, 'Latest')
  assert.equal(loadPersistence(() => storage).conversation?.messages[0].content, 'Unsaved')
  assert.deepEqual(host.store.getState().persistenceIssues, [])
  persistence.dispose()
})
