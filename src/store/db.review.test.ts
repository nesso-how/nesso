// @vitest-environment jsdom
// SPDX-License-Identifier: MIT
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultConceptReviewFields } from '@/types/graph'
import {
  dbClearGraphs,
  dbDeleteReviewForGraph,
  dbGetReviewState,
  dbGetReviewStatesForGraph,
  dbPruneReviewStates,
  dbPutReviewState,
  dbPutReviewStatesForGraph,
  reviewStateKey,
} from './db'

const nodeId = 'n1'

function graphIdFor(testName: string): string {
  const n = testName.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
  return `g${String(Math.abs(n)).padStart(13, '0')}`
}

beforeEach(async () => {
  await dbClearGraphs()
})

describe('reviewStateKey', () => {
  it('joins graph and node ids', () => {
    expect(reviewStateKey('g1', 'n1')).toBe('g1:n1')
  })
})

describe('review store CRUD', () => {
  it('round-trips a single node review', async () => {
    const graphId = graphIdFor('round-trip')
    const params = { ...defaultConceptReviewFields(), stability: 42, due: 123 }
    await dbPutReviewState(graphId, nodeId, params)
    expect(await dbGetReviewState(graphId, nodeId)).toEqual(params)
    await dbClearGraphs()
    expect(await dbGetReviewState(graphId, nodeId)).toEqual(params)
  })

  it('returns undefined for missing entries', async () => {
    const graphId = graphIdFor('missing')
    expect(await dbGetReviewState(graphId, nodeId)).toBeUndefined()
  })

  it('bulk-puts and lists reviews for one graph', async () => {
    const graphId = graphIdFor('bulk')
    const a = { ...defaultConceptReviewFields(), reps: 1 }
    const b = { ...defaultConceptReviewFields(), reps: 2 }
    await dbPutReviewStatesForGraph(
      graphId,
      new Map([
        ['n1', a],
        ['n2', b],
      ]),
    )
    const map = await dbGetReviewStatesForGraph(graphId)
    expect(map.get('n1')).toEqual(a)
    expect(map.get('n2')).toEqual(b)
    expect(map.size).toBe(2)
  })

  it('does not return reviews from other graphs', async () => {
    const graphId = graphIdFor('isolated-a')
    const otherGraphId = graphIdFor('isolated-b')
    await dbPutReviewState(graphId, nodeId, defaultConceptReviewFields())
    await dbPutReviewState(otherGraphId, nodeId, { ...defaultConceptReviewFields(), reps: 9 })
    const map = await dbGetReviewStatesForGraph(graphId)
    expect(map.size).toBe(1)
    expect(map.get(nodeId)?.reps).toBe(0)
  })
})

describe('review store lifecycle', () => {
  it('dbDeleteReviewForGraph removes all entries for a graph', async () => {
    const graphId = graphIdFor('delete-graph')
    await dbPutReviewStatesForGraph(
      graphId,
      new Map([
        ['n1', defaultConceptReviewFields()],
        ['n2', defaultConceptReviewFields()],
      ]),
    )
    await dbDeleteReviewForGraph(graphId)
    expect((await dbGetReviewStatesForGraph(graphId)).size).toBe(0)
  })

  it('dbPruneReviewStates drops orphaned node ids', async () => {
    const graphId = graphIdFor('prune')
    await dbPutReviewStatesForGraph(
      graphId,
      new Map([
        ['n1', defaultConceptReviewFields()],
        ['n2', defaultConceptReviewFields()],
        ['gone', defaultConceptReviewFields()],
      ]),
    )
    await dbPruneReviewStates(graphId, new Set(['n1', 'n2']))
    const map = await dbGetReviewStatesForGraph(graphId)
    expect([...map.keys()].sort()).toEqual(['n1', 'n2'])
  })
})
