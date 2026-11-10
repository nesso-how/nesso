import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ActionState } from '@nesso-how/plugin'
import { cues } from './cues.ts'

const id = (name: string) => `https://example.com/${name}`

test('cues show one row per relation type and direction, hiding how many concepts match', () => {
  const graph: ActionState['viewGraph'] = {
    concepts: [],
    relationTypes: [{ id: id('causes'), label: 'causes' }],
    relations: [
      { source: id('a'), predicate: id('causes'), target: id('b') },
      { source: id('c'), predicate: id('causes'), target: id('a') },
      { source: id('a'), predicate: id('causes'), target: id('c') },
    ],
  }
  assert.deepEqual(
    cues(id('a'), graph).map(({ outgoing, label }) => [outgoing, label]),
    [
      [true, 'causes'],
      [false, 'causes'],
    ],
  )
})
