import assert from 'node:assert/strict'
import test from 'node:test'
import type { AiEffects, AiToolResults } from '@nesso-how/ai'
import type { Graph } from '@nesso-how/schema'
import { relationKey } from '@nesso-how/schema'
import { createNessoStore } from '../store/create.ts'
import { NessoError } from '@nesso-how/errors'
import { createAiTurn } from './turn.ts'

const fixture = (count = 3) => {
  const graph: Graph = {
    concepts: Array.from({ length: count }, (_, index) => ({
      id: `urn:n${index}`,
      label: `Node ${index}`,
      position: { x: index, y: 0 },
    })),
    relations: [{ source: 'urn:n0', predicate: 'urn:links', target: 'urn:n1' }],
    relationTypes: [{ id: 'urn:links', label: 'links' }],
  }
  const host = createNessoStore(graph)
  host.registerVocab({
    id: 'vocab',
    defaultTypeId: 'urn:links',
    relationTypes: graph.relationTypes,
  })
  return host
}

test('staged edits stay private and apply as one undoable document edit', async () => {
  const host = fixture()
  const view = host.store.createView('Pair', ['urn:n0', 'urn:n1'])
  host.store.setSelection([{ kind: 'concept', id: 'urn:n0' }])
  const before = host.store.getState()
  let publications = 0
  host.store.subscribe(() => publications++)
  const turn = createAiTurn(host)
  turn.execute('edit', { operations: [{ kind: 'concept.add', id: 'urn:new' }] })
  turn.execute('edit', {
    operations: [
      { kind: 'concept.label', id: 'urn:new', value: 'New concept' },
      { kind: 'concept.notes', id: 'urn:new', value: 'Definition\nExample' },
      { kind: 'view.rename', id: view, name: 'Renamed' },
    ],
  })
  assert.equal(host.store.getState(), before)
  const staged = turn.execute('concepts', { ids: ['urn:new'] }) as AiToolResults['concepts']
  assert.equal(staged.items[0].label, 'New concept')
  assert.equal(staged.items[0].notes, 'Definition\nExample')
  assert.equal((await turn.commit()).status, 'applied')
  assert.equal(publications, 1)
  host.store.undo()
  assert.deepEqual(host.store.getState().graph, before.graph)
  assert.deepEqual(host.store.getState().workspace.savedViews, before.workspace.savedViews)
})

test('invalid operations and cancellation discard all staged writes', async () => {
  const host = fixture()
  const before = host.store.getState()
  for (const operation of [
    { kind: 'preferences.theme', id: 'dark' },
    { kind: 'relation.connect', source: 'urn:n0', target: 'urn:missing' },
  ]) {
    const turn = createAiTurn(host)
    turn.execute('edit', { operations: [{ kind: 'concept.label', id: 'urn:n0', value: 'Staged' }] })
    assert.throws(() => turn.execute('edit', { operations: [operation] }), NessoError)
    await assert.rejects(turn.commit(), NessoError)
    assert.equal(host.store.getState(), before)
  }
  const mixed = createAiTurn(host)
  mixed.execute('history', { action: 'undo' })
  assert.throws(
    () => mixed.execute('edit', { operations: [{ kind: 'concept.remove', id: 'urn:n0' }] }),
    /only write/,
  )
  const controller = new AbortController()
  const cancelled = createAiTurn(host, controller.signal)
  cancelled.execute('edit', {
    operations: [{ kind: 'concept.label', id: 'urn:n0', value: 'Staged' }],
  })
  controller.abort()
  await assert.rejects(cancelled.commit(), NessoError)
  assert.equal(host.store.getState(), before)
})

test('edits apply directly without approval, including bulk updates and additions', async () => {
  const host = fixture(12)
  const begin = () => createAiTurn(host)
  for (const count of [10, 11]) {
    const turn = begin()
    turn.execute('edit', {
      operations: host.store
        .getState()
        .graph.concepts.slice(0, count)
        .map(({ id }) => ({ kind: 'concept.label', id, value: `Updated ${count}` })),
    })
    assert.equal((await turn.commit()).status, 'applied')
  }
  const edge = relationKey(host.store.getState().graph.relations[0])
  const retype = begin()
  const effects = retype.execute('edit', {
    operations: [{ kind: 'relation.type.create', id: edge, typeId: 'urn:custom', label: 'Custom' }],
  }) as AiEffects
  assert.deepEqual(effects.relations, { added: 0, updated: 1, removed: 0 })
  assert.equal((await retype.commit()).status, 'applied')
  host.store.createView('Bulk', ['urn:n0'])
  const additions = begin()
  additions.execute('edit', {
    operations: Array.from({ length: 12 }, (_, index) => ({
      kind: 'concept.add',
      id: `urn:new${index}`,
    })),
  })
  assert.equal((await additions.commit()).status, 'applied')
})

test('deletion applies directly without host consent; reset, selection and navigation are rejected', async () => {
  const host = fixture()
  host.store.createView('Pair', ['urn:n0', 'urn:n1'])
  const turn = createAiTurn(host)
  turn.execute('edit', { operations: [{ kind: 'concept.remove', id: 'urn:n0' }] })
  assert.equal((await turn.commit()).status, 'applied')
  assert.deepEqual(
    host.store.getState().graph.concepts.map(({ id }) => id),
    ['urn:n1', 'urn:n2'],
  )
  for (const operations of [
    [{ kind: 'document.reset', id: 'urn:fresh' }],
    [{ kind: 'selection.set', value: [] }],
    [{ kind: 'view.activate', id: null }],
  ]) {
    const rejected = createAiTurn(host)
    assert.throws(() => rejected.execute('edit', { operations }), NessoError)
  }
})

test('selection reads page through the full selection', () => {
  const host = fixture(5)
  host.store.setSelection([
    { kind: 'concept', id: 'urn:n0' },
    { kind: 'concept', id: 'urn:n1' },
    { kind: 'concept', id: 'urn:n2' },
    { kind: 'concept', id: 'urn:n3' },
    { kind: 'concept', id: 'urn:n4' },
  ])
  const turn = createAiTurn(host)
  const first = turn.execute('selection', { offset: 0, limit: 2 }) as AiToolResults['selection']
  assert.deepEqual(
    first.items.map(({ id }) => id),
    ['urn:n0', 'urn:n1'],
  )
  assert.equal(first.total, 5)
  assert.equal(first.nextOffset, 2)
  const rest = turn.execute('selection', { offset: 2, limit: 10 }) as AiToolResults['selection']
  assert.deepEqual(
    rest.items.map(({ id }) => id),
    ['urn:n2', 'urn:n3', 'urn:n4'],
  )
  assert.equal(rest.nextOffset, null)
})

test('changes during generation reject stale plans without overwriting user edits', async () => {
  const host = fixture()
  const generating = createAiTurn(host)
  generating.execute('edit', {
    operations: [{ kind: 'concept.label', id: 'urn:n0', value: 'Staged' }],
  })
  host.store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
  await assert.rejects(generating.commit(), /start a new turn/)
  const editing = createAiTurn(host)
  editing.execute('edit', { operations: [{ kind: 'concept.remove', id: 'urn:n0' }] })
  host.store.setConceptLabel('urn:n2', 'User edit')
  await assert.rejects(editing.commit(), /start a new turn/)
  assert.equal(host.store.getState().graph.concepts.length, 3)
  assert.equal(host.store.getState().graph.concepts[2].label, 'User edit')
})
