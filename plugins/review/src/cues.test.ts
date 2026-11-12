import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ActionState } from '@nesso-how/plugin'
import { cues, relationTypeLabels } from './cues.ts'

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
    cues(id('a'), { viewGraph: graph, activeVocab: null, locale: 'en' }).map(
      ({ outgoing, label }) => [outgoing, label],
    ),
    [
      [true, 'causes'],
      [false, 'causes'],
    ],
  )
})

test('review uses Italian labels for cues and references without changing stored labels', () => {
  const type = { id: id('causes'), label: 'causes' }
  const state: Pick<ActionState, 'viewGraph' | 'activeVocab' | 'locale'> = {
    locale: 'it',
    activeVocab: {
      id: 'example',
      defaultTypeId: type.id,
      relationTypes: [{ ...type, translations: { it: 'causa' } }],
    },
    viewGraph: {
      concepts: [],
      relationTypes: [type],
      relations: [{ source: id('a'), predicate: type.id, target: id('b') }],
    },
  }
  assert.equal(relationTypeLabels(state).get(type.id), 'causa')
  assert.equal(cues(id('a'), state)[0].label, 'causa')
  assert.equal(state.viewGraph.relationTypes[0].label, 'causes')
})
