import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoOperation, WorkspaceState } from '@nesso-how/core'
import { relationKey, SchemaError, type Graph } from '@nesso-how/schema'
import { createNessoStore } from './create.ts'
import { indexOf } from './delta.ts'
import { historyLimit } from './history.ts'
import { NessoError } from '@nesso-how/errors'
import { applyStateOperations } from './operations.ts'
import type { HostOperation } from './types.ts'
import { reuseConceptOperations } from '../../packages/concept-map/src/creation.ts'

const fixture = (): Graph => ({
  concepts: Array.from({ length: 4 }, (_, i) => ({
    id: `urn:n${i}`,
    label: `${i}`,
  })),
  relationTypes: [{ id: 'urn:custom', label: 'Custom' }],
  relations: [{ source: 'urn:n0', predicate: 'urn:custom', target: 'urn:n1' }],
})
const members = (...ids: number[]) =>
  ids.map((i) => ({ id: `urn:n${i}`, position: { x: i, y: 0 } }))
const viewed = (): WorkspaceState => ({
  activeMapId: 'urn:v',
  pinnedMapIds: [],
  mapGroups: [],
  viewports: {},
  maps: [{ id: 'urn:v', name: 'Map', members: members(0, 1, 2, 3) }],
})

test('undo and redo restore deletion, incident relations, custom types, memberships and order atomically', () => {
  const host = createNessoStore(fixture(), {
    workspace: {
      activeMapId: 'urn:v1',
      pinnedMapIds: ['urn:v1'],
      mapGroups: [],
      viewports: {},
      maps: [
        { id: 'urn:v1', name: 'First', members: members(0, 1, 2) },
        { id: 'urn:v2', name: 'Second', members: members(3, 1) },
      ],
    },
  })
  const before = host.store.getState()
  const snapshot = structuredClone(before)
  const selected = [
    { kind: 'concept' as const, id: 'urn:n1' },
    { kind: 'concept' as const, id: 'urn:n2' },
    { kind: 'relation' as const, id: relationKey(before.graph.relations[0]) },
  ]
  host.store.setSelection(selected)
  host.store.applyOperations([
    { kind: 'concept.remove', id: 'urn:n1' },
    { kind: 'concept.remove', id: 'urn:n2' },
    { kind: 'relation.remove', id: selected[2].id },
  ])
  const after = host.store.getState()
  assert.deepEqual(after.graph.relationTypes, [])
  assert.deepEqual(after.selected, [])
  host.store.setMap('urn:v2')
  host.store.setSelection([{ kind: 'concept', id: 'urn:n3' }])
  let notifications = 0
  host.store.subscribe(() => notifications++)
  host.store.undo()
  const undone = host.store.getState()
  assert.equal(notifications, 1)
  assert.deepEqual(undone.graph, before.graph)
  assert.deepEqual(undone.workspace.maps, before.workspace.maps)
  assert.equal(undone.workspace.activeMapId, 'urn:v2')
  assert.deepEqual(undone.selected, [{ kind: 'concept', id: 'urn:n3' }])
  assert.equal(undone.graph.concepts[0], before.graph.concepts[0])
  assert.equal(undone.graph.concepts[1], before.graph.concepts[1])
  assert.deepEqual(undone.history, { canUndo: false, canRedo: true })
  host.store.setSelection([...selected, { kind: 'concept', id: 'urn:n3' }])
  host.store.redo()
  assert.equal(notifications, 3)
  assert.deepEqual(host.store.getState().selected, [{ kind: 'concept', id: 'urn:n3' }])
  assert.deepEqual(host.store.getState().graph, after.graph)
  assert.deepEqual(host.store.getState().workspace.maps, after.workspace.maps)
  assert.deepEqual(before, snapshot)
})

test('notes edits share map data, group history, clear cleanly and preserve no-op references', () => {
  const { store } = createNessoStore(fixture())
  const mapId = store.createMap('Map', ['urn:n0'])
  const before = store.getState()
  for (const value of ['Definition', 'Definition\nExample'])
    store.setConceptNotes('urn:n0', value, 'notes-1')
  const after = store.getState()
  assert.equal(after.mapGraph.concepts[0].notes, 'Definition\nExample')
  assert.equal(after.graph.concepts[1], before.graph.concepts[1])
  assert.equal(after.graph.relations, before.graph.relations)
  assert.equal(after.workspace, before.workspace)
  store.setConceptNotes('urn:n0', 'Definition\nExample')
  store.applyOperations([
    { kind: 'concept.notes', id: 'urn:n0', value: 'Temporary' },
    { kind: 'concept.notes', id: 'urn:n0', value: 'Definition\nExample' },
  ])
  assert.equal(store.getState(), after)
  assert.throws(
    () =>
      store.applyOperations([
        { kind: 'concept.label', id: 'urn:n0', value: 'Must not commit' },
        { kind: 'concept.notes', id: 'urn:n0', value: 42 as never },
      ]),
    SchemaError,
  )
  assert.equal(store.getState(), after)
  store.undo()
  assert.deepEqual(store.getState().graph, before.graph)
  store.redo()
  assert.deepEqual(store.getState().graph, after.graph)
  store.setConceptNotes('urn:n0', '')
  assert.equal(Object.hasOwn(store.getState().graph.concepts[0], 'notes'), false)
  const cleared = store.getState()
  store.setConceptNotes('urn:n0', '')
  assert.equal(store.getState(), cleared)
  store.undo()
  assert.equal(store.getState().mapGraph.concepts[0].notes, 'Definition\nExample')
  store.setMap(null)
  assert.equal(store.getState().graph.concepts[0].notes, 'Definition\nExample')
  assert.equal(store.getMapGraph(mapId).concepts[0].notes, 'Definition\nExample')
})

test('mixed batches undo only document changes and replay recorded effects, not current selection or vocabulary', () => {
  const host = createNessoStore(fixture())
  host.registerVocab({
    id: 'vocab',
    defaultTypeId: 'urn:links',
    relationTypes: [{ id: 'urn:links', label: 'Links' }],
  })
  host.store.applyOperations([
    { kind: 'map.create', id: 'urn:v', name: 'Map', conceptIds: ['urn:n0'] },
    { kind: 'selection.set', value: [{ kind: 'concept', id: 'urn:n0' }] },
    { kind: 'concept.add', id: 'urn:new' },
    { kind: 'map.rename', id: 'urn:v', name: 'Renamed' },
    { kind: 'map.pin', id: 'urn:v', pinned: true },
    { kind: 'preferences.section', id: 'sidebar', open: false },
  ])
  const after = host.store.getState()
  host.store.undo()
  assert.deepEqual(host.store.getState().graph, fixture())
  assert.deepEqual(host.store.getState().workspace.maps, [])
  assert.equal(host.store.getState().workspace.activeMapId, null)
  assert.equal(host.store.getState().preferences, after.preferences)
  assert.deepEqual(host.store.getState().selected, [])
  host.registerVocab({
    id: 'other',
    defaultTypeId: 'urn:other',
    relationTypes: [{ id: 'urn:other', label: 'Other' }],
  })
  host.store.setActiveVocab('other')
  host.store.setSelection([{ kind: 'concept', id: 'urn:n3' }])
  host.store.redo()
  assert.deepEqual(host.store.getState().graph, after.graph)
  assert.deepEqual(host.store.getState().workspace.maps, after.workspace.maps)
  assert.equal(host.store.getState().workspace.activeMapId, null)
  assert.deepEqual(host.store.getState().selected, [{ kind: 'concept', id: 'urn:n3' }])
  assert.equal(host.store.getState().preferences.activeVocabId, 'other')
})

test('membership deltas contain changed IDs rather than copies of all map members', () => {
  const host = createNessoStore(fixture(), {
    workspace: {
      activeMapId: 'urn:v',
      pinnedMapIds: [],
      mapGroups: [],
      viewports: {},
      maps: [{ id: 'urn:v', name: 'Map', members: members(0, 1, 2, 3) }],
    },
  })
  const { delta } = applyStateOperations(
    host.store.getState(),
    [{ kind: 'concept.remove', id: 'urn:n0' }],
    { renderers: new Map(), themes: new Map() },
  )
  assert.equal(delta.concepts.length, 1)
  assert.deepEqual(delta.maps[0].members, [
    { id: 'urn:n0', before: { index: 0, value: members(0)[0] }, after: undefined },
  ])
  assert.equal('conceptIds' in delta.maps[0].before!.value, false)
})

test('undo restores a deleted group, its maps and its last collapse state', () => {
  const { store } = createNessoStore(fixture(), { workspace: viewed() })
  const mapId = 'urn:v'
  const groupId = 'urn:work'
  const other = 'urn:empty'
  const before = store.getState()
  store.applyOperations([
    { kind: 'map-group.create', id: groupId, name: 'Work' },
    { kind: 'map-group.create', id: other, name: 'Empty' },
    { kind: 'map.group', id: mapId, groupId },
    { kind: 'map.pin', id: mapId, pinned: true },
  ])
  store.applyOperations([{ kind: 'map-group.rename', id: groupId, name: 'Study' }])
  store.applyOperations([{ kind: 'map-group.setOpen', id: other, open: false }])
  store.undo()
  assert.equal(store.getState().workspace.mapGroups[0].name, 'Work')
  assert.deepEqual(store.getState().workspace.collapsedMapGroupIds, [other])
  store.redo()
  store.applyOperations([{ kind: 'map-group.setOpen', id: groupId, open: false }])
  const grouped = store.getState()
  store.applyOperations([{ kind: 'map-group.remove', id: groupId }])
  const removed = store.getState()
  assert.deepEqual(removed.workspace, {
    ...before.workspace,
    pinnedMapIds: [mapId],
    mapGroups: [{ id: other, name: 'Empty' }],
    collapsedMapGroupIds: [other],
  })
  assert.equal(removed.graph, before.graph)
  assert.equal(removed.mapGraph, before.mapGraph)
  store.undo()
  assert.deepEqual(store.getState().workspace, grouped.workspace)
  store.redo()
  assert.deepEqual(store.getState().workspace, removed.workspace)
  store.undo()
  store.applyOperations([{ kind: 'map-group.setOpen', id: groupId, open: true }])
  store.redo()
  store.undo()
  assert.deepEqual(store.getState().workspace.collapsedMapGroupIds, [other])
})

test('redo restores a newly created group with its last collapse state', () => {
  const { store } = createNessoStore(fixture(), { workspace: viewed() })
  const id = 'urn:group'
  const mapId = 'urn:v'
  const before = store.getState().workspace
  store.applyOperations([
    { kind: 'map-group.create', id, name: 'Group' },
    { kind: 'map.group', id: mapId, groupId: id },
  ])
  store.applyOperations([{ kind: 'map-group.setOpen', id, open: false }])
  const collapsed = store.getState().workspace
  store.undo()
  assert.deepEqual(store.getState().workspace, { ...before, collapsedMapGroupIds: [] })
  store.redo()
  assert.deepEqual(store.getState().workspace, collapsed)
})

test('moving maps, pins and groups is one undo step each and keeps map contents', () => {
  const { store } = createNessoStore(fixture())
  const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((name, i) => store.createMap(name, [`urn:n${i}`]))
  store.applyOperations([
    { kind: 'map-group.create', id: 'urn:g', name: 'G' },
    { kind: 'map-group.create', id: 'urn:h', name: 'H' },
    { kind: 'map.group', id: c, groupId: 'urn:g' },
    { kind: 'map.group', id: a, groupId: 'urn:g' },
    ...[a, b, c].map((id) => ({ kind: 'map.pin', id, pinned: true }) as const),
  ])
  store.setSelection([{ kind: 'concept', id: 'urn:n3' }])
  const layout = () => {
    const { maps, mapGroups, pinnedMapIds } = store.getState().workspace
    const names = (ids: readonly string[]) =>
      ids.map((id) => maps.find((map) => map.id === id)!.name)
    const section = (groupId?: string) =>
      maps.filter((map) => map.groupId === groupId).map(({ name }) => name)
    return [
      names(pinnedMapIds),
      ...mapGroups.map(({ id, name }) => [name, ...section(id)]),
      section(),
    ]
  }
  assert.deepEqual(layout(), [['A', 'B', 'C'], ['G', 'C', 'A'], ['H'], ['B', 'D']])
  const initial = store.getState()
  const steps: [HostOperation, string[][]][] = [
    [
      { kind: 'map.move', id: d, groupId: 'urn:g', beforeId: c },
      [['A', 'B', 'C'], ['G', 'D', 'C', 'A'], ['H'], ['B']],
    ],
    [
      { kind: 'map.move', id: a, groupId: null, beforeId: b },
      [['A', 'B', 'C'], ['G', 'D', 'C'], ['H'], ['A', 'B']],
    ],
    [
      { kind: 'map.move', id: d, groupId: 'urn:h', beforeId: null },
      [
        ['A', 'B', 'C'],
        ['G', 'C'],
        ['H', 'D'],
        ['A', 'B'],
      ],
    ],
    [
      { kind: 'map.pin.move', id: c, beforeId: a },
      [
        ['C', 'A', 'B'],
        ['G', 'C'],
        ['H', 'D'],
        ['A', 'B'],
      ],
    ],
    [
      { kind: 'map-group.move', id: 'urn:g', beforeId: null },
      [
        ['C', 'A', 'B'],
        ['H', 'D'],
        ['G', 'C'],
        ['A', 'B'],
      ],
    ],
    [
      { kind: 'map-group.remove', id: 'urn:g' },
      [
        ['C', 'A', 'B'],
        ['H', 'D'],
        ['A', 'B', 'C'],
      ],
    ],
  ]
  for (const [operation, expected] of steps) {
    const before = store.getState().workspace
    store.applyOperations([operation])
    const after = store.getState().workspace
    assert.deepEqual(layout(), expected)
    store.undo()
    assert.deepEqual(store.getState().workspace, before)
    store.redo()
    assert.deepEqual(store.getState().workspace, after)
  }
  const settled = store.getState()
  assert.equal(settled.graph, initial.graph)
  assert.equal(settled.selected, initial.selected)
  for (const map of settled.workspace.maps)
    assert.equal(map.members, initial.workspace.maps.find(({ id }) => id === map.id)!.members)
  store.applyOperations([{ kind: 'map.move', id: b, groupId: null, beforeId: c }])
  store.applyOperations([{ kind: 'map.move', id: c, groupId: null, beforeId: null }])
  store.applyOperations([{ kind: 'map.group', id: d, groupId: 'urn:h' }])
  store.applyOperations([{ kind: 'map.pin.move', id: b, beforeId: null }])
  store.applyOperations([{ kind: 'map-group.move', id: 'urn:h', beforeId: null }])
  assert.equal(store.getState(), settled)
  store.applyOperations([{ kind: 'map.group', id: b, groupId: 'urn:h' }])
  assert.deepEqual(layout(), [
    ['C', 'A', 'B'],
    ['H', 'D', 'B'],
    ['A', 'C'],
  ])
})

test('batched moves undo exactly and same-slot moves are no-ops', () => {
  const map = (id: string, groupId: string) => ({ id, name: id, groupId, members: [] })
  const { store } = createNessoStore(fixture(), {
    workspace: {
      activeMapId: null,
      pinnedMapIds: ['urn:a', 'urn:b', 'urn:c'],
      viewports: {},
      mapGroups: [
        { id: 'urn:g', name: 'G' },
        { id: 'urn:h', name: 'H' },
      ],
      maps: [
        map('urn:a', 'urn:g'),
        map('urn:x', 'urn:h'),
        map('urn:b', 'urn:g'),
        map('urn:c', 'urn:g'),
      ],
    },
  })
  const before = store.getState()
  store.applyOperations([{ kind: 'map.move', id: 'urn:a', groupId: 'urn:g', beforeId: 'urn:b' }])
  assert.equal(store.getState(), before)
  store.applyOperations([
    { kind: 'map.pin.move', id: 'urn:b', beforeId: 'urn:a' },
    { kind: 'map.pin.move', id: 'urn:c', beforeId: 'urn:b' },
  ])
  const after = store.getState().workspace
  assert.deepEqual(after.pinnedMapIds, ['urn:c', 'urn:b', 'urn:a'])
  store.undo()
  assert.deepEqual(store.getState().workspace, before.workspace)
  store.redo()
  assert.deepEqual(store.getState().workspace, after)
})

test('map metadata, membership reordering and removal round-trip without changing the graph', () => {
  const host = createNessoStore(fixture(), {
    workspace: {
      activeMapId: 'urn:v',
      pinnedMapIds: [],
      mapGroups: [],
      viewports: {},
      maps: [{ id: 'urn:v', name: 'Map', members: members(0, 1, 2, 3) }],
    },
  })
  const before = host.store.getState()
  host.store.applyOperations([
    { kind: 'map.membership', mapId: 'urn:v', conceptId: 'urn:n0', included: false },
    { kind: 'map.membership', mapId: 'urn:v', conceptId: 'urn:n0', included: true },
    { kind: 'map.rename', id: 'urn:v', name: 'Changed' },
    { kind: 'map.pin', id: 'urn:v', pinned: true },
  ])
  const changed = host.store.getState()
  host.store.deleteMap('urn:v')
  assert.deepEqual(host.store.getState().workspace.pinnedMapIds, [])
  host.store.undo()
  assert.deepEqual(host.store.getState().workspace.maps, changed.workspace.maps)
  assert.deepEqual(host.store.getState().workspace.pinnedMapIds, ['urn:v'])
  host.store.undo()
  assert.equal(host.store.getState().graph, before.graph)
  assert.deepEqual(host.store.getState().workspace.maps, before.workspace.maps)
  host.store.redo()
  assert.deepEqual(host.store.getState().workspace.maps, changed.workspace.maps)
  host.store.redo()
  assert.deepEqual(host.store.getState().workspace.maps, [])
})

test('history commands restore global edits through helpers and operations without recording new edits', () => {
  const host = createNessoStore(fixture())
  const store = host.store
  let notifications = 0
  host.store.subscribe(() => notifications++)
  const initial = host.store.getState()
  store.undo()
  store.redo()
  assert.equal(host.store.getState(), initial)
  assert.equal(notifications, 0)
  host.store.setConceptLabel('urn:n0', 'Changed')
  assert.deepEqual(host.store.getState().history, { canUndo: true, canRedo: false })
  store.undo()
  assert.equal(host.store.getState().graph.concepts[0].label, '0')
  assert.deepEqual(host.store.getState().history, { canUndo: false, canRedo: true })
  store.applyOperations([{ kind: 'history.redo' }])
  assert.equal(host.store.getState().graph.concepts[0].label, 'Changed')
  host.store.applyOperations([{ kind: 'history.undo' }], { historyGroup: 'ignored' })
  assert.equal(host.store.getState().graph.concepts[0].label, '0')
  store.redo()
  assert.equal(host.store.getState().graph.concepts[0].label, 'Changed')
  assert.deepEqual(host.store.getState().history, { canUndo: true, canRedo: false })
  const restored = host.store.getState()
  store.redo()
  assert.equal(host.store.getState(), restored)
  assert.equal(notifications, 5)
})

test('history operations reject mixed and multiple-operation batches without changing state or stacks', () => {
  const host = createNessoStore(fixture())
  host.store.setConceptLabel('urn:n0', 'First')
  host.store.setConceptLabel('urn:n1', 'Second')
  host.store.undo()
  const before = host.store.getState()
  let notifications = 0
  host.store.subscribe(() => notifications++)
  for (const kind of ['history.undo', 'history.redo'] as const) {
    const edit: NessoOperation = { kind: 'concept.label', id: 'urn:n0', value: 'Must not commit' }
    const batches: NessoOperation[][] = [
      [{ kind }, edit],
      [edit, { kind }],
      [{ kind }, { kind }],
      [{ kind }, { kind: kind === 'history.undo' ? 'history.redo' : 'history.undo' }],
      [{ kind: 'document.reset', id: 'urn:reset' }, { kind }],
    ]
    for (const operations of batches) {
      assert.throws(
        () => host.store.applyOperations(operations),
        (error: unknown) => error instanceof NessoError && error.issues[0].path === 'operations',
      )
      assert.equal(host.store.getState(), before)
    }
  }
  assert.equal(notifications, 0)
  host.store.undo()
  assert.deepEqual(host.store.getState().graph, fixture())
  host.store.redo()
  assert.deepEqual(host.store.getState().graph, before.graph)
  host.store.redo()
  assert.equal(host.store.getState().graph.concepts[1].label, 'Second')
  assert.equal(notifications, 3)
})

test('no-ops and failures preserve redo; new document edits clear it; reset clears all history', () => {
  const host = createNessoStore(fixture(), { workspace: viewed() })
  host.store.setConceptLabel('urn:n0', 'Changed')
  host.store.undo()
  const before = host.store.getState()
  host.store.setConceptLabel('urn:n0', '0')
  assert.throws(() => host.store.setConceptPosition('urn:n0', { x: NaN, y: 0 }), NessoError)
  assert.equal(host.store.getState(), before)
  host.store.setSectionOpen('sidebar', false)
  assert.equal(host.store.getState().history.canRedo, true)
  host.store.setConceptPosition('urn:n1', { x: 100, y: 200 })
  assert.equal(host.store.getState().history.canRedo, false)
  host.store.resetGraph()
  const reset = host.store.getState()
  assert.deepEqual(reset.history, { canUndo: false, canRedo: false })
  host.store.undo()
  host.store.redo()
  assert.equal(host.store.getState(), reset)
})

test('mixed structural batches round-trip and creation, placement and naming share one undo step', () => {
  const host = createNessoStore(fixture(), { workspace: viewed() })
  const before = host.store.getState().mapGraph
  host.store.applyOperations([
    { kind: 'concept.remove', id: 'urn:n1' },
    { kind: 'concept.add', id: 'urn:new' },
    { kind: 'concept.remove', id: 'urn:n0' },
    { kind: 'concept.label', id: 'urn:n3', value: 'Changed after shifting' },
  ])
  const after = host.store.getState().mapGraph
  host.store.undo()
  assert.deepEqual(host.store.getState().mapGraph, before)
  host.store.redo()
  assert.deepEqual(host.store.getState().mapGraph, after)
  host.store.applyOperations([{ kind: 'concept.add', id: 'urn:placed' }], {
    historyGroup: 'placement',
  })
  host.store.applyOperations(
    [{ kind: 'concept.position', id: 'urn:placed', value: { x: 80, y: 90 } }],
    { historyGroup: 'placement' },
  )
  host.store.applyOperations([{ kind: 'concept.label', id: 'urn:placed', value: 'Named' }], {
    historyGroup: 'placement',
  })
  const placed = host.store.getState().mapGraph
  host.store.setConceptLabel('urn:placed', 'Renamed')
  host.store.undo()
  assert.deepEqual(host.store.getState().mapGraph, placed)
  host.store.undo()
  assert.deepEqual(host.store.getState().mapGraph, after)
  host.store.redo()
  assert.deepEqual(host.store.getState().mapGraph, placed)
})

test('explicit text and drag groups merge adjacent edits, cancel net changes and separate sessions', () => {
  const host = createNessoStore(fixture(), { workspace: viewed() })
  for (const value of ['A', 'AB', 'ABC'])
    host.store.applyOperations([{ kind: 'concept.label', id: 'urn:n0', value }], {
      historyGroup: 'text-1',
    })
  for (const x of [10, 20, 30])
    host.store.applyOperations(
      [
        {
          kind: 'concept.positions',
          updates: [
            { id: 'urn:n0', position: { x, y: 0 } },
            { id: 'urn:n1', position: { x, y: 1 } },
          ],
        },
      ],
      { historyGroup: 'drag-1' },
    )
  host.store.undo()
  assert.equal(host.store.getState().graph.concepts[0].label, 'ABC')
  assert.deepEqual(host.store.getState().mapGraph.concepts[0].position, { x: 0, y: 0 })
  host.store.undo()
  assert.equal(host.store.getState().graph.concepts[0].label, '0')
  assert.equal(host.store.getState().history.canUndo, false)
  host.store.redo()
  host.store.redo()
  assert.deepEqual(host.store.getState().mapGraph.concepts[1].position, { x: 30, y: 1 })
  for (const value of ['Temporary', 'ABC'])
    host.store.applyOperations([{ kind: 'concept.label', id: 'urn:n0', value }], {
      historyGroup: 'text-2',
    })
  host.store.undo()
  assert.equal(host.store.getState().graph.concepts[0].label, 'ABC')
  assert.deepEqual(host.store.getState().mapGraph.concepts[0].position, { x: 0, y: 0 })
})

test('reusing a newly created concept preserves existing data, avoids duplicate links and undoes the complete creation', () => {
  for (const linked of [false, true]) {
    const graph = fixture()
    if (linked)
      graph.relations.push({ source: 'urn:n0', predicate: 'urn:custom', target: 'urn:n2' })
    graph.concepts[2].notes = 'Keep existing notes'
    const workspace = viewed()
    const host = createNessoStore(graph, {
      workspace: {
        ...workspace,
        maps: [{ ...workspace.maps[0], members: members(0, 1) }],
      },
    })
    host.registerVocab({
      id: 'vocab',
      defaultTypeId: 'urn:custom',
      relationTypes: graph.relationTypes,
    })
    host.store.setSelection([{ kind: 'concept', id: 'urn:n0' }])
    const before = host.store.getState()
    host.store.applyOperations(
      [{ kind: 'concept.add', id: 'urn:new', position: { x: 80, y: 90 } }],
      { historyGroup: 'reuse' },
    )
    host.store.applyOperations(reuseConceptOperations(host.store.getState(), 'urn:new', 'urn:n2'), {
      historyGroup: 'reuse',
    })
    const after = host.store.getState()
    assert.deepEqual(after.graph.concepts, before.graph.concepts)
    assert.equal(after.graph.concepts[2], before.graph.concepts[2])
    assert.equal(after.graph.relations.length, 2)
    assert.equal(new Set(after.graph.relations.map(relationKey)).size, 2)
    assert.deepEqual(after.mapGraph.concepts.at(-1)?.position, { x: 80, y: 90 })
    assert.deepEqual(after.selected, [{ kind: 'concept', id: 'urn:n2' }])
    host.store.undo()
    assert.deepEqual(host.store.getState().graph, before.graph)
    assert.deepEqual(host.store.getState().workspace.maps, before.workspace.maps)
    assert.equal(host.store.getState().history.canUndo, false)
    host.store.redo()
    assert.deepEqual(host.store.getState().graph, after.graph)
    assert.deepEqual(host.store.getState().mapGraph, after.mapGraph)
  }
})

test('grouped structural edits reconcile indices of surviving changes across removals', () => {
  const host = createNessoStore(fixture(), { workspace: viewed() })
  const before = host.store.getState()
  host.store.applyOperations(
    [
      { kind: 'concept.label', id: 'urn:n3', value: 'Changed' },
      { kind: 'concept.remove', id: 'urn:n0' },
    ],
    { historyGroup: 'structural' },
  )
  host.store.applyOperations(
    [
      { kind: 'concept.label', id: 'urn:n2', value: 'Also changed' },
      { kind: 'concept.remove', id: 'urn:n1' },
    ],
    { historyGroup: 'structural' },
  )
  const after = host.store.getState()
  host.store.undo()
  assert.deepEqual(host.store.getState().graph, before.graph)
  assert.deepEqual(host.store.getState().workspace.maps, before.workspace.maps)
  assert.equal(host.store.getState().history.canUndo, false)
  host.store.redo()
  assert.deepEqual(host.store.getState().graph, after.graph)
  assert.deepEqual(host.store.getState().mapGraph, after.mapGraph)
})

test('grouped relation edits restore order after reinserting a relation at the same index', () => {
  const graph = fixture()
  const [first] = graph.relations
  const [type] = graph.relationTypes
  const middle = { ...first, source: 'urn:n1', target: 'urn:n2' }
  const last = { ...first, source: 'urn:n2', target: 'urn:n3' }
  graph.relations.push(middle, last)
  const { store } = createNessoStore(graph, { workspace: viewed() })
  const apply = (...operations: HostOperation[]) =>
    store.applyOperations(operations, { historyGroup: 'relations' })
  const reconnect = (relation: typeof first, { source, target }: typeof first) =>
    apply({ kind: 'relation.reconnect', id: relationKey(relation), source, target })
  const reconnectedLast = { ...last, source: 'urn:n3', target: 'urn:n2' }
  const reconnectedMiddle = { ...middle, source: 'urn:n0', target: 'urn:n3' }
  reconnect(last, reconnectedLast)
  apply(
    { kind: 'relation.remove', id: relationKey(first) },
    { kind: 'relation.remove', id: relationKey(middle) },
    { kind: 'relation.connect', ...middle, type },
  )
  reconnect(middle, reconnectedMiddle)
  const edited = [reconnectedLast, reconnectedMiddle]
  assert.deepEqual(store.getState().mapGraph.relations, edited)
  store.setSelection([])
  store.undo()
  assert.deepEqual(store.getState().graph.relations, graph.relations)
  assert.deepEqual(store.getState().mapGraph.relations, graph.relations)
  store.redo()
  assert.deepEqual(store.getState().graph.relations, edited)
  assert.deepEqual(store.getState().mapGraph.relations, edited)
})

test('label edits reuse the concept index through undo and redo', () => {
  const { store } = createNessoStore(fixture(), { workspace: viewed() })
  const conceptIndex = () => indexOf(store.getState().graph.concepts, ({ id }) => id)
  const original = conceptIndex()
  store.setConceptLabel('urn:n0', 'Renamed')
  assert.equal(conceptIndex(), original)
  store.undo()
  assert.equal(conceptIndex(), original)
  store.redo()
  assert.equal(conceptIndex(), original)
})

test('removing a duplicated concept ID removes both copies and round-trips through history', () => {
  const { store } = createNessoStore(fixture(), { workspace: viewed() })
  const before = store.getState().graph
  store.applyOperations([
    { kind: 'concept.add', id: 'urn:n0' },
    { kind: 'concept.remove', id: 'urn:n0' },
  ])
  const after = store.getState().graph
  assert.deepEqual(after.concepts, before.concepts.slice(1))
  store.undo()
  assert.deepEqual(store.getState().graph, before)
  store.redo()
  assert.deepEqual(store.getState().graph, after)
})

test('map removal separates history groups before editing a shifted map', () => {
  const workspace = {
    ...viewed(),
    maps: [{ id: 'urn:first', name: 'First', members: [] }, ...viewed().maps],
  }
  const { store } = createNessoStore(fixture(), { workspace })
  store.applyOperations([{ kind: 'map.remove', id: 'urn:first' }], { historyGroup: 'maps' })
  const removed = store.getState().workspace.maps
  store.applyOperations([{ kind: 'concept.position', id: 'urn:n0', value: { x: 10, y: 0 } }], {
    historyGroup: 'maps',
  })
  store.undo()
  assert.deepEqual(store.getState().workspace.maps, removed)
  store.undo()
  assert.deepEqual(store.getState().workspace.maps, workspace.maps)
})

test('history is bounded and instance-local', () => {
  const a = createNessoStore(fixture())
  const b = createNessoStore(fixture())
  for (let i = 1; i <= historyLimit + 2; i++) a.store.setConceptLabel('urn:n0', `${i}`)
  for (let i = 0; i < historyLimit + 1; i++) a.store.undo()
  assert.equal(a.store.getState().graph.concepts[0].label, '2')
  assert.equal(a.store.getState().history.canUndo, false)
  assert.deepEqual(b.store.getState().history, { canUndo: false, canRedo: false })
})
