import assert from 'node:assert/strict'
import test from 'node:test'
import { createTranslator } from '@nesso/i18n'
import type { AiEffects, AiToolResults } from '@nesso/ai'
import type { Graph } from '@nesso/schema'
import { relationKey } from '@nesso/schema'
import en from '../i18n/en.json' with { type: 'json' }
import { createNotifications } from '../notifications/create.ts'
import { createNessoStore } from '../store/create.ts'
import { NessoError } from '../store/errors.ts'
import { createAiApproval } from './approval.ts'
import { createAiTurn } from './turn.ts'

const fixture = (count = 3) => {
  const graph: Graph = {
    concepts: Array.from({ length: count }, (_, index) => ({ id: `urn:n${index}`, label: `Node ${index}`, position: { x: index, y: 0 } })),
    relations: [{ source: 'urn:n0', predicate: 'urn:links', target: 'urn:n1' }],
    relationTypes: [{ id: 'urn:links', label: 'links' }],
  }
  const host = createNessoStore(graph)
  host.registerVocab({ id: 'vocab', label: 'Vocabulary', defaultTypeId: 'urn:links', relationTypes: graph.relationTypes })
  return host
}

test('staged edits stay private and apply as one undoable document edit', async () => {
  const host = fixture()
  const view = host.store.createView('Pair', ['urn:n0', 'urn:n1'])
  host.store.setSelection([{ kind: 'concept', id: 'urn:n0' }])
  const before = host.store.getState()
  let publications = 0
  host.store.subscribe(() => publications++)
  const turn = createAiTurn(host, async () => assert.fail('Unexpected approval'))
  turn.execute('edit', { operations: [{ kind: 'concept.add', id: 'urn:new' }] })
  turn.execute('edit', { operations: [{ kind: 'concept.label', id: 'urn:new', value: 'New concept' }, { kind: 'view.rename', id: view, name: 'Renamed' }] })
  assert.equal(host.store.getState(), before)
  const staged = turn.execute('concepts', { ids: ['urn:new'] }) as AiToolResults['concepts']
  assert.equal(staged.items[0].label, 'New concept')
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
    const turn = createAiTurn(host, async () => true)
    turn.execute('edit', { operations: [{ kind: 'concept.label', id: 'urn:n0', value: 'Staged' }] })
    assert.throws(() => turn.execute('edit', { operations: [operation] }), NessoError)
    await assert.rejects(turn.commit(), NessoError)
    assert.equal(host.store.getState(), before)
  }
  const mixed = createAiTurn(host, async () => true)
  mixed.execute('history', { action: 'undo' })
  assert.throws(() => mixed.execute('edit', { operations: [{ kind: 'concept.remove', id: 'urn:n0' }] }), /only write/)
  const controller = new AbortController()
  const cancelled = createAiTurn(host, async () => true, controller.signal)
  cancelled.execute('edit', { operations: [{ kind: 'concept.label', id: 'urn:n0', value: 'Staged' }] })
  controller.abort()
  await assert.rejects(cancelled.commit(), NessoError)
  assert.equal(host.store.getState(), before)
})

test('approval covers more than ten updates, not additions or a retyped relation', async () => {
  const host = fixture(12)
  let approvals = 0
  const begin = () => createAiTurn(host, async () => { approvals++; return true })
  for (const count of [10, 11]) {
    const turn = begin()
    turn.execute('edit', { operations: host.store.getState().graph.concepts.slice(0, count).map(({ id }) => ({ kind: 'concept.label', id, value: `Updated ${count}` })) })
    await turn.commit()
    assert.equal(approvals, count === 11 ? 1 : 0)
  }
  const edge = relationKey(host.store.getState().graph.relations[0])
  const retype = begin()
  const effects = retype.execute('edit', { operations: [{ kind: 'relation.type.create', id: edge, typeId: 'urn:custom', label: 'Custom' }] }) as AiEffects
  assert.deepEqual(effects.relations, { added: 0, updated: 1, removed: 0 })
  await retype.commit()
  assert.equal(approvals, 1)
  host.store.createView('Bulk', ['urn:n0'])
  const additions = begin()
  additions.execute('edit', { operations: Array.from({ length: 12 }, (_, index) => ({ kind: 'concept.add', id: `urn:new${index}` })) })
  await additions.commit()
  assert.equal(approvals, 1)
})

test('deletion requires host consent; reset, selection and navigation are rejected', async () => {
  const host = fixture()
  host.store.createView('Pair', ['urn:n0', 'urn:n1'])
  const notifications = createNotifications()
  const t = createTranslator(en)('en')
  const approve = createAiApproval(notifications.api, () => t)
  for (const decision of ['deny', 'stop', 'approve'] as const) {
    const before = host.store.getState()
    const turn = createAiTurn(host, approve)
    turn.execute('edit', { operations: [{ kind: 'concept.remove', id: 'urn:n0' }] })
    const pending = turn.commit()
    const notification = notifications.getSnapshot()[0]
    assert.equal(host.store.getState(), before)
    if (notification.tone !== 'confirmation') assert.fail('Expected confirmation')
    if (decision === 'deny') notification.cancelAction.onClick()
    else if (decision === 'stop') turn.cancel()
    else notification.action.onClick()
    assert.equal((await pending).status, decision === 'approve' ? 'applied' : 'cancelled')
    assert.equal(notifications.getSnapshot().length, 0)
    if (decision === 'deny' || decision === 'stop') assert.equal(host.store.getState(), before)
  }
  assert.deepEqual(host.store.getState().graph.concepts.map(({ id }) => id), ['urn:n1', 'urn:n2'])
  for (const operations of [
    [{ kind: 'document.reset', id: 'urn:fresh' }],
    [{ kind: 'selection.set', value: [] }],
    [{ kind: 'view.activate', id: null }],
  ]) {
    const rejected = createAiTurn(host, async () => assert.fail('Unexpected approval'))
    assert.throws(() => rejected.execute('edit', { operations }), NessoError)
  }
})

test('selection reads page through the full selection', () => {
  const host = fixture(5)
  host.store.setSelection([
    { kind: 'concept', id: 'urn:n0' }, { kind: 'concept', id: 'urn:n1' }, { kind: 'concept', id: 'urn:n2' },
    { kind: 'concept', id: 'urn:n3' }, { kind: 'concept', id: 'urn:n4' },
  ])
  const turn = createAiTurn(host, async () => assert.fail('Unexpected approval'))
  const first = turn.execute('selection', { offset: 0, limit: 2 }) as AiToolResults['selection']
  assert.deepEqual(first.items.map(({ id }) => id), ['urn:n0', 'urn:n1'])
  assert.equal(first.total, 5)
  assert.equal(first.nextOffset, 2)
  const rest = turn.execute('selection', { offset: 2, limit: 10 }) as AiToolResults['selection']
  assert.deepEqual(rest.items.map(({ id }) => id), ['urn:n2', 'urn:n3', 'urn:n4'])
  assert.equal(rest.nextOffset, null)
})

test('changes during generation or approval reject stale plans without overwriting user edits', async () => {
  const host = fixture()
  const generating = createAiTurn(host, async () => true)
  generating.execute('edit', { operations: [{ kind: 'concept.label', id: 'urn:n0', value: 'Staged' }] })
  host.store.setSelection([{ kind: 'concept', id: 'urn:n1' }])
  await assert.rejects(generating.commit(), /start a new turn/)
  const editing = createAiTurn(host, async () => {
    host.store.setConceptLabel('urn:n2', 'User edit')
    return true
  })
  editing.execute('edit', { operations: [{ kind: 'concept.remove', id: 'urn:n0' }] })
  await assert.rejects(editing.commit(), /start a new turn/)
  assert.equal(host.store.getState().graph.concepts.length, 3)
  assert.equal(host.store.getState().graph.concepts[2].label, 'User edit')
})
