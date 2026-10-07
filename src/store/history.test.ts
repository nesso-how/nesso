import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoOperation } from '@nesso/plugin'
import { relationKey, SchemaError, type Graph } from '@nesso/schema'
import { createNessoStore } from './create.ts'
import { historyLimit } from './history.ts'
import { createPluginStore } from './commands.ts'
import { NessoError } from './errors.ts'
import { applyStateOperations } from './operations.ts'

const fixture = (): Graph => ({
  concepts: Array.from({ length: 4 }, (_, i) => ({ id: `urn:n${i}`, label: `${i}`, position: { x: i, y: 0 } })),
  relationTypes: [{ id: 'urn:custom', label: 'Custom' }],
  relations: [{ source: 'urn:n0', predicate: 'urn:custom', target: 'urn:n1' }],
})

test('undo and redo restore deletion, incident relations, custom types, memberships and order atomically', () => {
  const host = createNessoStore(fixture(), { workspace: { activeViewId: 'urn:v1', viewports: {}, savedViews: [
    { id: 'urn:v1', name: 'First', pinned: true, conceptIds: ['urn:n0', 'urn:n1', 'urn:n2'] },
    { id: 'urn:v2', name: 'Second', pinned: false, conceptIds: ['urn:n3', 'urn:n1'] },
  ] } })
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
  host.store.setView('urn:v2')
  host.store.setSelection([{ kind: 'concept', id: 'urn:n3' }])
  let notifications = 0
  host.store.subscribe(() => notifications++)
  host.store.undo()
  const undone = host.store.getState()
  assert.equal(notifications, 1)
  assert.deepEqual(undone.graph, before.graph)
  assert.deepEqual(undone.workspace.savedViews, before.workspace.savedViews)
  assert.equal(undone.workspace.activeViewId, 'urn:v2')
  assert.deepEqual(undone.selected, [{ kind: 'concept', id: 'urn:n3' }])
  assert.equal(undone.graph.concepts[0], before.graph.concepts[0])
  assert.equal(undone.graph.concepts[1], before.graph.concepts[1])
  assert.deepEqual(undone.history, { canUndo: false, canRedo: true })
  host.store.setSelection([...selected, { kind: 'concept', id: 'urn:n3' }])
  host.store.redo()
  assert.equal(notifications, 3)
  assert.deepEqual(host.store.getState().selected, [{ kind: 'concept', id: 'urn:n3' }])
  assert.deepEqual(host.store.getState().graph, after.graph)
  assert.deepEqual(host.store.getState().workspace.savedViews, after.workspace.savedViews)
  assert.deepEqual(before, snapshot)
})

test('mixed batches undo only document changes and replay recorded effects, not current selection or vocabulary', () => {
  const host = createNessoStore(fixture())
  host.registerVocab({ id: 'vocab', label: 'Vocab', defaultTypeId: 'urn:links', relationTypes: [{ id: 'urn:links', label: 'Links' }] })
  host.store.applyOperations([
    { kind: 'view.create', id: 'urn:v', name: 'View', conceptIds: ['urn:n0'] },
    { kind: 'selection.set', value: [{ kind: 'concept', id: 'urn:n0' }] },
    { kind: 'concept.add', id: 'urn:new' },
    { kind: 'view.rename', id: 'urn:v', name: 'Renamed' },
    { kind: 'view.pin', id: 'urn:v', pinned: true },
    { kind: 'preferences.section', id: 'sidebar', open: false },
  ])
  const after = host.store.getState()
  host.store.undo()
  assert.deepEqual(host.store.getState().graph, fixture())
  assert.deepEqual(host.store.getState().workspace.savedViews, [])
  assert.equal(host.store.getState().workspace.activeViewId, null)
  assert.equal(host.store.getState().preferences, after.preferences)
  assert.deepEqual(host.store.getState().selected, [])
  host.registerVocab({ id: 'other', label: 'Other', defaultTypeId: 'urn:other', relationTypes: [{ id: 'urn:other', label: 'Other' }] })
  host.store.setActiveVocab('other')
  host.store.setSelection([{ kind: 'concept', id: 'urn:n3' }])
  host.store.redo()
  assert.deepEqual(host.store.getState().graph, after.graph)
  assert.deepEqual(host.store.getState().workspace.savedViews, after.workspace.savedViews)
  assert.equal(host.store.getState().workspace.activeViewId, null)
  assert.deepEqual(host.store.getState().selected, [{ kind: 'concept', id: 'urn:n3' }])
  assert.equal(host.store.getState().preferences.activeVocabId, 'other')
})

test('membership deltas contain changed IDs rather than copies of all view members', () => {
  const host = createNessoStore(fixture(), { workspace: { activeViewId: 'urn:v', viewports: {}, savedViews: [
    { id: 'urn:v', name: 'View', pinned: false, conceptIds: ['urn:n0', 'urn:n1', 'urn:n2', 'urn:n3'] },
  ] } })
  const { delta } = applyStateOperations(host.store.getState(), [{ kind: 'concept.remove', id: 'urn:n0' }], { renderers: new Map(), themes: new Map() })
  assert.equal(delta.concepts.length, 1)
  assert.deepEqual(delta.views[0].members, [{ id: 'urn:n0', before: { index: 0, value: 'urn:n0' }, after: undefined }])
  assert.equal('conceptIds' in delta.views[0].before!.value, false)
})

test('view metadata, membership reordering and removal round-trip without changing the graph', () => {
  const host = createNessoStore(fixture(), { workspace: { activeViewId: 'urn:v', viewports: {}, savedViews: [
    { id: 'urn:v', name: 'View', pinned: false, conceptIds: ['urn:n0', 'urn:n1', 'urn:n2', 'urn:n3'] },
  ] } })
  const before = host.store.getState()
  host.store.applyOperations([
    { kind: 'view.membership', viewId: 'urn:v', conceptId: 'urn:n0', included: false },
    { kind: 'view.membership', viewId: 'urn:v', conceptId: 'urn:n0', included: true },
    { kind: 'view.rename', id: 'urn:v', name: 'Changed' },
    { kind: 'view.pin', id: 'urn:v', pinned: true },
  ])
  const changed = host.store.getState()
  host.store.deleteView('urn:v')
  host.store.undo()
  assert.deepEqual(host.store.getState().workspace.savedViews, changed.workspace.savedViews)
  host.store.undo()
  assert.equal(host.store.getState().graph, before.graph)
  assert.deepEqual(host.store.getState().workspace.savedViews, before.workspace.savedViews)
  host.store.redo()
  assert.deepEqual(host.store.getState().workspace.savedViews, changed.workspace.savedViews)
  host.store.redo()
  assert.deepEqual(host.store.getState().workspace.savedViews, [])
})

test('declared history commands restore global edits through helpers and operations without recording new edits', () => {
  const host = createNessoStore(fixture())
  const plugin = createPluginStore(host.store, ['history.undo', 'history.redo'])
  let notifications = 0
  host.store.subscribe(() => notifications++)
  const initial = host.store.getState()
  plugin.undo()
  plugin.redo()
  assert.equal(host.store.getState(), initial)
  assert.equal(notifications, 0)
  host.store.setConceptLabel('urn:n0', 'Changed')
  assert.deepEqual(host.store.getState().history, { canUndo: true, canRedo: false })
  assert.throws(() => createPluginStore(host.store, ['history.redo']).undo(), NessoError)
  plugin.undo()
  assert.equal(host.store.getState().graph.concepts[0].label, '0')
  assert.deepEqual(host.store.getState().history, { canUndo: false, canRedo: true })
  assert.throws(() => createPluginStore(host.store, ['history.undo']).redo(), NessoError)
  plugin.applyOperations([{ kind: 'history.redo' }])
  assert.equal(host.store.getState().graph.concepts[0].label, 'Changed')
  host.store.applyOperations([{ kind: 'history.undo' }], { historyGroup: 'ignored' })
  assert.equal(host.store.getState().graph.concepts[0].label, '0')
  plugin.redo()
  assert.equal(host.store.getState().graph.concepts[0].label, 'Changed')
  assert.deepEqual(host.store.getState().history, { canUndo: true, canRedo: false })
  const restored = host.store.getState()
  plugin.redo()
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
      assert.throws(() => host.store.applyOperations(operations), (error: unknown) =>
        error instanceof NessoError && error.issues[0].path === 'operations')
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
  const host = createNessoStore(fixture())
  host.store.setConceptLabel('urn:n0', 'Changed')
  host.store.undo()
  const before = host.store.getState()
  host.store.setConceptLabel('urn:n0', '0')
  assert.throws(() => host.store.setConceptPosition('urn:n0', { x: NaN, y: 0 }), SchemaError)
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

test('mixed structural batches restore original indices and merge a creation with its placement correction', () => {
  const host = createNessoStore(fixture())
  const before = host.store.getState().graph
  host.store.applyOperations([
    { kind: 'concept.remove', id: 'urn:n1' },
    { kind: 'concept.add', id: 'urn:new' },
    { kind: 'concept.remove', id: 'urn:n0' },
    { kind: 'concept.label', id: 'urn:n3', value: 'Changed after shifting' },
  ])
  const after = host.store.getState().graph
  host.store.undo()
  assert.deepEqual(host.store.getState().graph, before)
  host.store.redo()
  assert.deepEqual(host.store.getState().graph, after)
  host.store.applyOperations([{ kind: 'concept.add', id: 'urn:placed' }], { historyGroup: 'placement' })
  host.store.applyOperations([{ kind: 'concept.position', id: 'urn:placed', value: { x: 80, y: 90 } }], { historyGroup: 'placement' })
  const placed = host.store.getState().graph
  host.store.undo()
  assert.deepEqual(host.store.getState().graph, after)
  host.store.redo()
  assert.deepEqual(host.store.getState().graph, placed)
})

test('explicit text and drag groups merge adjacent edits, cancel net changes and separate sessions', () => {
  const host = createNessoStore(fixture())
  for (const value of ['A', 'AB', 'ABC']) host.store.applyOperations([{ kind: 'concept.label', id: 'urn:n0', value }], { historyGroup: 'text-1' })
  for (const x of [10, 20, 30]) host.store.applyOperations([{ kind: 'concept.positions', updates: [
    { id: 'urn:n0', position: { x, y: 0 } }, { id: 'urn:n1', position: { x, y: 1 } },
  ] }], { historyGroup: 'drag-1' })
  host.store.undo()
  assert.equal(host.store.getState().graph.concepts[0].label, 'ABC')
  assert.deepEqual(host.store.getState().graph.concepts[0].position, { x: 0, y: 0 })
  host.store.undo()
  assert.equal(host.store.getState().graph.concepts[0].label, '0')
  assert.equal(host.store.getState().history.canUndo, false)
  host.store.redo()
  host.store.redo()
  assert.deepEqual(host.store.getState().graph.concepts[1].position, { x: 30, y: 1 })
  for (const value of ['Temporary', 'ABC']) host.store.applyOperations([{ kind: 'concept.label', id: 'urn:n0', value }], { historyGroup: 'text-2' })
  host.store.undo()
  assert.equal(host.store.getState().graph.concepts[0].label, 'ABC')
  assert.deepEqual(host.store.getState().graph.concepts[0].position, { x: 0, y: 0 })
})

test('history is bounded, instance-local and plugin batches still enforce their allowlist', () => {
  const a = createNessoStore(fixture())
  const b = createNessoStore(fixture())
  const plugin = createPluginStore(a.store, ['concept.label'])
  for (let i = 1; i <= historyLimit + 2; i++) plugin.setConceptLabel('urn:n0', `${i}`)
  assert.throws(() => plugin.applyOperations([{ kind: 'relation.remove', id: relationKey(fixture().relations[0]) }], { historyGroup: 'denied' }))
  for (let i = 0; i < historyLimit + 1; i++) a.store.undo()
  assert.equal(a.store.getState().graph.concepts[0].label, '2')
  assert.equal(a.store.getState().history.canUndo, false)
  assert.deepEqual(b.store.getState().history, { canUndo: false, canRedo: false })
})
