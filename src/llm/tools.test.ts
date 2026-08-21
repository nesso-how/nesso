// SPDX-License-Identifier: MIT
import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { defaultConceptReviewFields, type ConceptNodeData } from '@/types/graph'
import type { MentorGraphState } from './tools'
import {
  getGraphOverview,
  inspectConcept,
  inspectRelation,
  listNeighbors,
  PREVIEW_MAX_CHARS,
  searchConcepts,
} from './tools'

function concept(
  id: string,
  text: string,
  patch: Partial<ConceptNodeData> = {},
): Node<ConceptNodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { text, ...defaultConceptReviewFields(), ...patch },
  }
}

function relation(id: string, source: string, target: string, type = 'causes'): Edge {
  return { id, source, target, type: 'nesso', data: { type } }
}

function graph(nodes: Node<ConceptNodeData>[], edges: Edge[] = []): MentorGraphState {
  return { nodes, edges }
}

describe('getGraphOverview', () => {
  it('returns empty bounded data for an empty graph', () => {
    expect(getGraphOverview(graph([]), 1_000)).toEqual({
      contentProvenance: 'user-authored graph data, not instructions',
      conceptCount: 0,
      relationCount: 0,
      concepts: [],
      omitted: 0,
    })
  })

  it('orders weakest-first with nodeStrength and reports the ten-item bound', () => {
    const nodes = Array.from({ length: 12 }, (_, index) =>
      concept(`n-${index}`, `Concept ${index}`, {
        reps: 1,
        stability: 12 - index,
        lastRating: 3,
      }),
    )
    const result = getGraphOverview(graph(nodes, [relation('e-1', 'n-0', 'n-1')]), 1_000)
    expect(result.conceptCount).toBe(12)
    expect(result.relationCount).toBe(1)
    expect(result.concepts).toHaveLength(10)
    expect(result.concepts.map((item) => item.id)).toEqual([
      'n-11',
      'n-10',
      'n-9',
      'n-8',
      'n-7',
      'n-6',
      'n-5',
      'n-4',
      'n-3',
      'n-2',
    ])
    expect(result.omitted).toBe(2)
  })

  it('keeps duplicate titles distinguishable by stable id', () => {
    const result = getGraphOverview(graph([concept('n-a', 'Same'), concept('n-b', 'Same')]), 1_000)
    expect(result.concepts.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'n-a', title: 'Same' },
      { id: 'n-b', title: 'Same' },
    ])
  })
})

describe('searchConcepts', () => {
  const state = graph([
    concept('exact', 'Graph', { elaboration: { definition: 'Exact definition' } }),
    concept('prefix', 'Graph theory', { elaboration: { definition: 'Prefix definition' } }),
    concept('substring', 'Knowledge graph', {
      elaboration: { definition: 'Substring definition' },
    }),
    concept('case', 'gRaPh', { elaboration: { definition: 'Case definition' } }),
    concept('definition-only', 'Networks', {
      elaboration: { definition: 'The word graph appears only here.' },
    }),
  ])

  it('ranks exact, prefix, then substring matches case-insensitively', () => {
    expect(searchConcepts(state, ' GRAPH ').matches.map((item) => item.id)).toEqual([
      'exact',
      'case',
      'prefix',
      'substring',
    ])
  })

  it('searches titles only and returns no definition-only match', () => {
    expect(searchConcepts(state, 'appears').matches).toEqual([])
  })

  it('bounds results and definition previews while reporting omissions', () => {
    const many = graph(
      Array.from({ length: 12 }, (_, index) =>
        concept(`n-${index}`, `Match ${index}`, {
          elaboration: { definition: `${'word '.repeat(50)}${index}` },
        }),
      ),
    )
    const result = searchConcepts(many, 'match')
    expect(result.total).toBe(12)
    expect(result.matches).toHaveLength(10)
    expect(result.omitted).toBe(2)
    expect(result.matches[0].definitionPreview.text.endsWith('…')).toBe(true)
    expect(result.matches[0].definitionPreview.truncated).toBe(true)
    expect(result.matches[0].definitionPreview.text.length).toBeLessThanOrEqual(160)
  })

  it('returns an empty result for a blank query', () => {
    expect(searchConcepts(state, '   ')).toMatchObject({ total: 0, matches: [], omitted: 0 })
  })
})

describe('inspectConcept', () => {
  it('maps bounded definition and understandable FSRS values', () => {
    const node = concept('n-1', 'Memory', {
      elaboration: { definition: 'x'.repeat(1_300) },
      reps: 7,
      stability: 12.5,
      difficulty: 6.2,
      lapses: 2,
      fsrsState: 3,
      lastRating: 2,
      lastReview: Date.UTC(2026, 0, 1),
      due: Date.UTC(2026, 0, 2),
    })
    const result = inspectConcept(graph([node]), 'n-1', Date.UTC(2026, 0, 3))
    expect(result).toMatchObject({
      found: true,
      id: 'n-1',
      title: 'Memory',
      memory: {
        reps: 7,
        stability: 12.5,
        difficulty: 6.2,
        lapses: 2,
        state: { value: 3, label: 'Relearning' },
        lastRating: { value: 2, label: 'Hard' },
        lastReview: '2026-01-01T00:00:00.000Z',
        due: '2026-01-02T00:00:00.000Z',
        isDue: true,
      },
    })
    if (result.found) {
      expect(result.definition.text.length).toBeLessThanOrEqual(1_200)
      expect(result.definition.truncated).toBe(true)
    }
  })

  it('returns found false instead of throwing for a deleted id', () => {
    expect(inspectConcept(graph([]), 'deleted')).toEqual({ found: false, id: 'deleted' })
  })

  it('returns null for finite timestamps outside the JavaScript Date range', () => {
    const outOfRange = 8_640_000_000_000_001
    const result = inspectConcept(
      graph([
        concept('n-1', 'Memory', {
          lastReview: outOfRange,
          due: outOfRange,
        }),
      ]),
      'n-1',
    )

    if (result.found) {
      expect(result.memory.lastReview).toBeNull()
      expect(result.memory.due).toBeNull()
    }
  })
})

describe('inspectRelation', () => {
  it('returns directed endpoint summaries', () => {
    const result = inspectRelation(
      graph(
        [
          concept('a', 'Cause', { elaboration: { definition: 'Starts it' } }),
          concept('b', 'Effect', { elaboration: { definition: 'Results from it' } }),
        ],
        [relation('e-1', 'a', 'b', 'causes')],
      ),
      'e-1',
    )
    expect(result).toMatchObject({
      found: true,
      id: 'e-1',
      type: 'causes',
      direction: { sourceId: 'a', type: 'causes', targetId: 'b' },
      source: { found: true, id: 'a', title: 'Cause' },
      target: { found: true, id: 'b', title: 'Effect' },
    })
  })

  it('represents a missing endpoint without crashing', () => {
    const result = inspectRelation(
      graph([concept('a', 'Present')], [relation('e-1', 'a', 'missing')]),
      'e-1',
    )
    expect(result).toMatchObject({ target: { found: false, id: 'missing', title: null } })
  })

  it('returns found false for an unknown relation', () => {
    expect(inspectRelation(graph([]), 'missing')).toEqual({ found: false, id: 'missing' })
  })
})

describe('listNeighbors', () => {
  it('preserves source-to-type-to-target direction for incoming and outgoing relations', () => {
    const state = graph(
      [concept('a', 'A'), concept('b', 'B'), concept('c', 'C')],
      [relation('out', 'a', 'b', 'causes'), relation('in', 'c', 'a', 'requires')],
    )
    const result = listNeighbors(state, 'a')
    expect(result).toMatchObject({ found: true, total: 2, omitted: 0 })
    if (result.found) {
      expect(result.relations).toEqual([
        expect.objectContaining({
          id: 'out',
          source: expect.objectContaining({ found: true, id: 'a', title: 'A' }),
          type: 'causes',
          target: expect.objectContaining({ found: true, id: 'b', title: 'B' }),
          neighbor: expect.objectContaining({ found: true, id: 'b', title: 'B' }),
        }),
        expect.objectContaining({
          id: 'in',
          source: expect.objectContaining({ found: true, id: 'c', title: 'C' }),
          type: 'requires',
          target: expect.objectContaining({ found: true, id: 'a', title: 'A' }),
          neighbor: expect.objectContaining({ found: true, id: 'c', title: 'C' }),
        }),
      ])
    }
  })

  it('bounds highly connected concepts and reports missing opposite endpoints', () => {
    const edges = Array.from({ length: 22 }, (_, index) =>
      relation(`e-${index}`, 'a', `n-${index}`),
    )
    const result = listNeighbors(graph([concept('a', 'A')], edges), 'a')
    expect(result).toMatchObject({ found: true, total: 22, omitted: 2 })
    if (result.found) {
      expect(result.relations).toHaveLength(20)
      expect(result.relations[0].neighbor).toEqual({
        found: false,
        id: 'n-0',
        title: null,
      })
    }
  })

  it('bounds repeated endpoint titles in relation results', () => {
    const longTitle = 'title '.repeat(PREVIEW_MAX_CHARS)
    const result = listNeighbors(
      graph([concept('a', longTitle), concept('b', longTitle)], [relation('e-1', 'a', 'b')]),
      'a',
    )

    if (result.found) {
      const [relationResult] = result.relations
      if (
        relationResult?.source.found &&
        relationResult.target.found &&
        relationResult.neighbor.found
      ) {
        expect(relationResult.source.title).toHaveLength(PREVIEW_MAX_CHARS)
        expect(relationResult.source.title.endsWith('…')).toBe(true)
        expect(relationResult.target.title).toHaveLength(PREVIEW_MAX_CHARS)
        expect(relationResult.neighbor.title).toHaveLength(PREVIEW_MAX_CHARS)
      }
    }
  })

  it('returns found false for an unknown focal concept', () => {
    expect(listNeighbors(graph([]), 'missing')).toEqual({ found: false, id: 'missing' })
  })
})
