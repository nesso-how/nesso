import assert from 'node:assert/strict'
import test from 'node:test'
import type { Selection } from '@nesso/plugin'
import { selectionFromChanges } from './selection.ts'

test('renderer selection batches retain every selected item and toggle only their own kind', () => {
  const original: Selection = [{ kind: 'concept', id: 'one' }, { kind: 'relation', id: 'edge' }]
  const selected = selectionFromChanges(original, 'concept', [
    { type: 'select', id: 'two', selected: true },
    { type: 'select', id: 'three', selected: true },
    { type: 'select', id: 'two', selected: true },
  ])
  assert.deepEqual(selected, [...original, { kind: 'concept', id: 'two' }, { kind: 'concept', id: 'three' }])
  assert.deepEqual(selectionFromChanges(selected, 'concept', [
    { type: 'select', id: 'one', selected: false },
    { type: 'select', id: 'two', selected: false },
  ]), [{ kind: 'relation', id: 'edge' }, { kind: 'concept', id: 'three' }])
  assert.equal(selectionFromChanges(selected, 'concept', [{ type: 'select', id: 'two', selected: true }]), selected)
  assert.equal(selectionFromChanges(selected, 'concept', [{ type: 'position', id: 'two', position: { x: 1, y: 2 } }]), selected)
  assert.deepEqual(original, [{ kind: 'concept', id: 'one' }, { kind: 'relation', id: 'edge' }])
})
