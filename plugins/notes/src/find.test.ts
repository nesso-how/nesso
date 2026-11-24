import assert from 'node:assert/strict'
import test from 'node:test'
import { EditorState } from '@codemirror/state'
import { noteSearch, setNoteSearch } from './find.ts'

test('find matches literal text regardless of case and updates when the note changes', () => {
  const initial = EditorState.create({ doc: '💡 Idea. IDEAS idea.', extensions: noteSearch })
  const state = initial.update({ effects: setNoteSearch.of({ query: 'idea.', index: 1 }) }).state
  assert.deepEqual(
    state.field(noteSearch)?.matches.map(({ from, to }) => [from, to]),
    [
      [3, 8],
      [15, 20],
    ],
  )
  const updated = state.update({ changes: { from: 0, to: 8 } }).state.field(noteSearch)
  assert.equal(updated?.matches.length, 1)
  assert.equal(updated?.index, 0)
})
