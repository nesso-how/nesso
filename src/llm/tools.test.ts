// SPDX-License-Identifier: MIT
import type { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { defaultConceptReviewFields, type ConceptNodeData } from '@/types/graph'
import type { MentorGraphState } from './tools'
import { getGraphOverview, searchConcepts } from './tools'

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
