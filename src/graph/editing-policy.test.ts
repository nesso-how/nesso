import assert from 'node:assert/strict'
import test from 'node:test'
import { historyShortcut, historyTarget } from './editing-policy.ts'

test('history shortcuts preserve macOS and Windows/Linux undo and both redo combinations', () => {
  const key = (key: string, ctrlKey = false, metaKey = false, shiftKey = false) =>
    historyShortcut({ key, ctrlKey, metaKey, shiftKey })
  assert.equal(key('z', false, true), 'undo')
  assert.equal(key('Z', false, true, true), 'redo')
  assert.equal(key('z', true), 'undo')
  assert.equal(key('z', true, false, true), 'redo')
  assert.equal(key('y', true), 'redo')
  assert.equal(key('y', false, true), undefined)
  assert.equal(key('z'), undefined)
  assert.equal(key('a', true), undefined)
})

test('history follows editing focus and blocked workspaces never undo the document', () => {
  for (const [blocked, nativeEditing, documentEditing, expected] of [
    [false, false, false, 'document'],
    [false, true, true, 'document'],
    [false, true, false, 'native'],
    [true, false, false, 'none'],
    [true, true, false, 'native'],
    [true, true, true, 'native'],
  ] as const) {
    assert.equal(historyTarget({ blocked, nativeEditing, documentEditing }), expected)
  }
})
