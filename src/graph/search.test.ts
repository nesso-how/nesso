import assert from 'node:assert/strict'
import test from 'node:test'
import type { GraphSnapshot, SavedView } from '@nesso-how/core'
import { createSeedDocument } from '../data/seed.ts'
import { createNessoStore } from '../store/create.ts'
import { addToActiveView, openSearchResult, searchGraph, type SearchResult } from './search.ts'

const graph: GraphSnapshot = {
  concepts: [
    { id: 'urn:test:memory', label: 'Memory', notes: 'Practice recall.' },
    { id: 'urn:test:working', label: 'Working memory' },
    {
      id: 'urn:test:spacing',
      label: 'Spaced repetition',
      notes: 'Practice recall at increasing intervals.',
    },
    { id: 'urn:test:unicode', label: '记忆' },
  ],
  relations: [],
  relationTypes: [],
}
const views: readonly SavedView[] = [
  {
    id: 'memory',
    name: 'Memory',
    pinned: false,
    members: [{ id: 'urn:test:memory', position: { x: 0, y: 0 }, color: '#ffeeee' }],
  },
]

test('search groups views and concepts, ranks labels before notes, and normalizes queries', () => {
  const results = searchGraph(graph, views, '  MÉMORY  ', 'Overview')
  assert.deepEqual(
    results.map(({ kind, id }) => [kind, id]),
    [
      ['view', 'memory'],
      ['concept', 'urn:test:memory'],
      ['concept', 'urn:test:working'],
    ],
  )
  assert.deepEqual(
    searchGraph(graph, views, 'recall practice', 'Overview').map(({ id }) => id),
    ['urn:test:memory', 'urn:test:spacing'],
  )
  assert.deepEqual(
    searchGraph(graph, views, '记忆', 'Overview').map(({ id }) => id),
    ['urn:test:unicode'],
  )
  assert.deepEqual(searchGraph(graph, views, 'no match', 'Overview'), [])
  assert.deepEqual(
    searchGraph(graph, views, 'over', 'Overview').map(({ id }) => id),
    [null],
  )
})

test('suggestions are bounded per group', () => {
  const results = searchGraph(graph, views, '  ', 'Overview')
  assert.equal(results.filter(({ kind }) => kind === 'view').length, 2)
  assert.equal(results.filter(({ kind }) => kind === 'concept').length, 3)
  assert.deepEqual(
    results.filter((result) => result.kind === 'view').map((result) => [result.id, result.count]),
    [
      [null, 4],
      ['memory', 1],
    ],
  )
  assert.deepEqual(
    results.find((result) => result.kind === 'concept' && result.id === 'urn:test:memory'),
    {
      kind: 'concept',
      id: 'urn:test:memory',
      label: 'Memory',
      notes: 'Practice recall.',
      color: undefined,
    },
  )
  const colored = searchGraph(graph, views, 'memory', 'Overview', 'memory')
  assert.equal(colored.find(({ id }) => id === 'urn:test:memory')?.kind, 'concept')
  assert.deepEqual(
    colored.flatMap((result) => (result.kind === 'concept' ? [result.color] : [])),
    ['#ffeeee', undefined],
  )
})

test('opening search results is atomic navigation, preserves document history and never adds memberships', () => {
  const seed = createSeedDocument('en')
  const { store } = createNessoStore(seed.graph, { workspace: seed.workspace })
  const conceptResult = (name: string) =>
    searchGraph(
      store.getState().graph,
      store.getState().workspace.savedViews,
      name,
      'Overview',
    ).find((item) => item.kind === 'concept' && item.label === name)!
  store.setView('energy')
  store.applyOperations([
    { kind: 'preferences.section', id: 'inspector', open: false },
    { kind: 'preferences.inspectorTab', value: 'chat' },
  ])
  const before = store.getState()
  let publications = 0
  const unsubscribe = store.subscribe(() => publications++)
  openSearchResult(store, conceptResult('Energy'))
  unsubscribe()
  assert.equal(publications, 1)
  assert.equal(store.getState().workspace.activeViewId, 'energy')
  assert.deepEqual(store.getState().selected, [{ kind: 'concept', id: 'urn:nesso:example:energy' }])
  assert.equal(store.getState().preferences.inspectorTab, 'details')
  assert.ok(!store.getState().preferences.collapsedSections?.includes('inspector'))
  openSearchResult(store, conceptResult('Sleep'))
  const after = store.getState()
  assert.equal(after.workspace.activeViewId, null)
  assert.deepEqual(after.selected, [{ kind: 'concept', id: 'urn:nesso:example:sleep' }])
  assert.equal(after.graph, before.graph)
  assert.equal(after.workspace.savedViews, before.workspace.savedViews)
  assert.equal(after.history, before.history)
  const rest: SearchResult = { kind: 'view', id: 'rest', label: 'Rest', count: 3 }
  openSearchResult(store, rest)
  assert.equal(store.getState().workspace.activeViewId, 'rest')
  openSearchResult(store, { kind: 'view', id: null, label: 'Overview', count: 4 })
  assert.equal(store.getState().workspace.activeViewId, null)
  const unchanged = store.getState()
  openSearchResult(store, { ...rest, id: 'deleted' })
  openSearchResult(store, { kind: 'concept', id: 'urn:deleted', label: '' })
  assert.equal(store.getState(), unchanged)
})

test('adding a concept joins the active view and selects it', () => {
  const seed = createSeedDocument('en')
  const { store } = createNessoStore(seed.graph, { workspace: seed.workspace })
  const sleep = 'urn:nesso:example:sleep'
  const members = () =>
    store
      .getState()
      .workspace.savedViews.find(({ id }) => id === 'energy')!
      .members.map(({ id }) => id)
  store.setView(null)
  const overview = store.getState()
  addToActiveView(store, null, sleep)
  assert.equal(store.getState(), overview)
  store.setView('energy')
  const added: string[] = []
  addToActiveView(store, { addToView: (id) => added.push(id) }, sleep)
  assert.deepEqual(added, [sleep])
  assert.ok(!members().includes(sleep))
  addToActiveView(store, null, sleep)
  assert.ok(members().includes(sleep))
  assert.deepEqual(store.getState().selected, [{ kind: 'concept', id: sleep }])
})
