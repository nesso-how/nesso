import assert from 'node:assert/strict'
import test from 'node:test'
import type { Selection } from '@nesso/plugin'
import { selectionForContextMenu, selectionFromChanges } from './selection.ts'

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

test('context menus preserve a selected group and replace it for an unselected target', () => {
  const selected: Selection = [{ kind: 'concept', id: 'one' }, { kind: 'relation', id: 'edge' }]
  assert.equal(selectionForContextMenu(selected, { kind: 'concept', id: 'one' }), selected)
  assert.equal(selectionForContextMenu(selected, { kind: 'relation', id: 'edge' }), selected)
  assert.deepEqual(selectionForContextMenu(selected, { kind: 'concept', id: 'two' }), [{ kind: 'concept', id: 'two' }])
  assert.deepEqual(selectionForContextMenu(selected, { kind: 'relation', id: 'one' }), [{ kind: 'relation', id: 'one' }])
  assert.deepEqual(selectionForContextMenu([], { kind: 'concept', id: 'one' }), [{ kind: 'concept', id: 'one' }])
})
