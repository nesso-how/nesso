import assert from 'node:assert/strict'
import test from 'node:test'
import type { NessoOperation } from '@nesso/plugin'
import { createPluginStore } from './commands.ts'
import { createNessoStore } from './create.ts'
import { NessoError } from './errors.ts'

test('plugin stores enforce isolated declaration snapshots for helpers and entire batches', () => {
  const host = createNessoStore(null)
  assert.throws(() => createPluginStore(host.store, undefined as never), NessoError)
  const id = host.store.getState().graph.concepts[0].id
  const allowed: NessoOperation['kind'][] = ['concept.label', 'view.create']
  const store = createPluginStore(host.store, allowed)
  const reader = createPluginStore(host.store, [])
  let notifications = 0
  const unsubscribe = store.subscribe(() => notifications++)
  store.setConceptLabel(id, 'Allowed')
  const viewId = store.createView('Allowed view', [id])
  assert.equal(reader.getState(), host.store.getState())
  assert.equal(reader.getViewGraph(viewId).concepts[0].label, 'Allowed')
  assert.equal(notifications, 2)
  allowed.push('selection.set', 'history.undo', 'history.redo')
  const before = host.store.getState()
  for (const write of [
    () => reader.setConceptLabel(id, 'Denied'),
    () => reader.reconnectRelation('missing', id, id),
    () => reader.undo(),
    () => reader.redo(),
    () => reader.setLocale('it'),
    () => store.setSelection([{ kind: 'concept', id }]),
    () => store.undo(),
    () => store.redo(),
    () => reader.applyOperations([{ kind: 'history.undo' }]),
    () => reader.applyOperations([{ kind: 'history.redo' }]),
    () => store.applyOperations([
      { kind: 'concept.label', id, value: 'Must not commit' },
      { kind: 'history.undo' },
    ]),
    () => store.applyOperations([
      { kind: 'concept.label', id, value: 'Must not commit' },
      { kind: 'view.remove', id: viewId },
    ]),
  ]) {
    assert.throws(write, (error: unknown) => error instanceof NessoError && error.issues[0].path === 'plugin.operations')
    assert.equal(host.store.getState(), before)
  }
  assert.equal(notifications, 2)
  unsubscribe()
})
