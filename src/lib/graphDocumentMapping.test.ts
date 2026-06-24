// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { defaultConceptReviewFields, VOCABULARY } from '@/types/graph'
import type { NessoGraphDocument } from '@nesso-how/vocab-learning'
import { documentToGraphFromReviews, graphToDocument } from './graphDocumentMapping'

const doc: NessoGraphDocument = {
  version: 1,
  vocabulary: { id: VOCABULARY.id, version: VOCABULARY.version },
  name: 'Test',
  concepts: [{ id: 'n1', label: 'A', x: 10, y: 20 }],
  relations: [],
}

describe('documentToGraphFromReviews', () => {
  it('merges review params when present', () => {
    const review = { ...defaultConceptReviewFields(), stability: 99, due: 5000 }
    const { nodes } = documentToGraphFromReviews(doc, new Map([['n1', review]]))
    expect(nodes[0].data.stability).toBe(99)
    expect(nodes[0].data.due).toBe(5000)
    expect(nodes[0].data.text).toBe('A')
  })

  it('defaults FSRS when review entry is absent', () => {
    const { nodes } = documentToGraphFromReviews(doc, new Map())
    expect(nodes[0].data).toMatchObject(defaultConceptReviewFields())
    expect(nodes[0].data.text).toBe('A')
  })
})

describe('graphToDocument', () => {
  const display = {
    edgeEncoding: 'full' as const,
    showHeatmap: false,
    curveStyle: 'straight' as const,
    autoCurveFlip: true,
  }

  it('omits FSRS from serialized concepts', () => {
    const file = graphToDocument({
      name: 'Test',
      display,
      nodes: [
        {
          id: 'n1',
          position: { x: 1, y: 2 },
          data: { text: 'A', ...defaultConceptReviewFields(), stability: 77 },
        },
      ],
      edges: [],
    })
    expect(file.concepts[0]).toMatchObject({ id: 'n1', label: 'A', x: 1, y: 2 })
    expect(file.concepts[0].data?.elaboration).toBeUndefined()
    expect((file.concepts[0].data as { stability?: number } | undefined)?.stability).toBeUndefined()
  })

  it('serializes relation curve metadata without FSRS', () => {
    const file = graphToDocument({
      name: 'Test',
      display,
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { text: 'A', ...defaultConceptReviewFields() },
        },
        {
          id: 'n2',
          position: { x: 1, y: 1 },
          data: { text: 'B', ...defaultConceptReviewFields() },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          type: 'nesso',
          data: { type: 'causes', curveFlip: true, curveFlipPinned: false },
        },
      ],
    })
    expect(file.relations[0]).toMatchObject({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      type: 'causes',
      data: { curveFlip: true, curveFlipPinned: false },
    })
  })
})
