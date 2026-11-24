import assert from 'node:assert/strict'
import test from 'node:test'
import type { GraphSnapshot, WorkspaceMap } from '@nesso-how/core'
import { createSeedDocument } from '../data/seed.ts'
import { createNessoStore } from '../store/create.ts'
import { addToActiveMap, openSearchResult, searchGraph, type SearchResult } from './search.ts'

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
const maps: readonly WorkspaceMap[] = [
  {
    id: 'memory',
    name: 'Memory',
    members: [{ id: 'urn:test:memory', position: { x: 0, y: 0 }, color: '#ffeeee' }],
  },
]

test('search groups maps and concepts, ranks labels before notes, and normalizes queries', () => {
  const results = searchGraph(graph, maps, '  MÉMORY  ', 'Graph')
  assert.deepEqual(
    results.map(({ kind, id }) => [kind, id]),
    [
      ['map', 'memory'],
      ['concept', 'urn:test:memory'],
      ['concept', 'urn:test:working'],
    ],
  )
  assert.deepEqual(
    searchGraph(graph, maps, 'recall practice', 'Graph').map(({ id }) => id),
    ['urn:test:memory', 'urn:test:spacing'],
  )
  assert.deepEqual(
    searchGraph(graph, maps, '记忆', 'Graph').map(({ id }) => id),
    ['urn:test:unicode'],
  )
  assert.deepEqual(searchGraph(graph, maps, 'no match', 'Graph'), [])
  assert.deepEqual(
    searchGraph(graph, maps, 'grap', 'Graph').map(({ id }) => id),
    [null],
  )
})

test('suggestions are bounded per group', () => {
  const results = searchGraph(graph, maps, '  ', 'Graph')
  assert.equal(results.filter(({ kind }) => kind === 'map').length, 2)
  assert.equal(results.filter(({ kind }) => kind === 'concept').length, 3)
  assert.deepEqual(
    results.filter((result) => result.kind === 'map').map((result) => [result.id, result.count]),
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
  const colored = searchGraph(graph, maps, 'memory', 'Graph', 'memory')
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
    searchGraph(store.getState().graph, store.getState().workspace.maps, name, 'Graph').find(
      (item) => item.kind === 'concept' && item.label === name,
    )!
  store.setMap('energy')
  store.applyOperations([
    { kind: 'preferences.section', id: 'inspector', open: false },
    { kind: 'preferences.inspectorTab', value: 'chat' },
    { kind: 'map-group.setVisible', id: null, visible: false },
  ])
  const before = store.getState()
  let publications = 0
  const unsubscribe = store.subscribe(() => publications++)
  openSearchResult(store, conceptResult('Energy'))
  unsubscribe()
  assert.equal(publications, 1)
  assert.equal(store.getState().workspace.activeMapId, 'energy')
  assert.deepEqual(store.getState().selected, [{ kind: 'concept', id: 'urn:nesso:example:energy' }])
  assert.equal(store.getState().preferences.inspectorTab, 'details')
  assert.ok(!store.getState().preferences.collapsedSections?.includes('inspector'))
  openSearchResult(store, conceptResult('Sleep'))
  const after = store.getState()
  assert.equal(after.workspace.activeMapId, null)
  assert.deepEqual(after.selected, [{ kind: 'concept', id: 'urn:nesso:example:sleep' }])
  assert.deepEqual(after.hiddenMapGroupIds, [])
  assert.equal(after.graph, before.graph)
  assert.equal(after.workspace.maps, before.workspace.maps)
  assert.equal(after.history, before.history)
  const rest: SearchResult = { kind: 'map', id: 'rest', label: 'Rest', count: 3 }
  openSearchResult(store, rest)
  assert.equal(store.getState().workspace.activeMapId, 'rest')
  openSearchResult(store, { kind: 'map', id: null, label: 'Graph', count: 4 })
  assert.equal(store.getState().workspace.activeMapId, null)
  const unchanged = store.getState()
  openSearchResult(store, { ...rest, id: 'deleted' })
  openSearchResult(store, { kind: 'concept', id: 'urn:deleted', label: '' })
  assert.equal(store.getState(), unchanged)
})

test('adding a concept joins the active map and selects it', () => {
  const seed = createSeedDocument('en')
  const { store } = createNessoStore(seed.graph, { workspace: seed.workspace })
  const sleep = 'urn:nesso:example:sleep'
  const members = () =>
    store
      .getState()
      .workspace.maps.find(({ id }) => id === 'energy')!
      .members.map(({ id }) => id)
  store.setMap(null)
  const before = store.getState()
  addToActiveMap(store, null, sleep)
  assert.equal(store.getState(), before)
  store.setMap('energy')
  const added: string[] = []
  addToActiveMap(store, { addToMap: (id) => added.push(id) }, sleep)
  assert.deepEqual(added, [sleep])
  assert.ok(!members().includes(sleep))
  addToActiveMap(store, null, sleep)
  assert.ok(members().includes(sleep))
  assert.deepEqual(store.getState().selected, [{ kind: 'concept', id: sleep }])
})
