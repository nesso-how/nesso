import assert from 'node:assert/strict'
import test from 'node:test'
import { createNessoStore } from './create.ts'

test('group preference defaults on, validates atomically and stays outside document history', () => {
  const { store } = createNessoStore(null)
  const before = store.getState()
  assert.equal(before.preferences.relationGroups ?? true, true)
  store.applyOperations([{ kind: 'preferences.relationGroups', value: true }])
  assert.equal(store.getState(), before)
  store.applyOperations([{ kind: 'preferences.relationGroups', value: false }])
  const disabled = store.getState()
  assert.equal(disabled.preferences.relationGroups, false)
  assert.equal(disabled.graph, before.graph)
  assert.equal(disabled.history.canUndo, false)
  store.applyOperations([{ kind: 'preferences.relationGroups', value: false }])
  assert.equal(store.getState(), disabled)
  assert.throws(() =>
    store.applyOperations([
      { kind: 'preferences.relationGroups', value: 'invalid' as unknown as boolean },
    ]),
  )
  assert.equal(store.getState(), disabled)
})
