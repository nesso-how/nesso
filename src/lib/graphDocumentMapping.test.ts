// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { defaultConceptReviewFields } from '@/types/graph'
import { deserialize, serialize } from '@nesso-how/vocab-learning'
import type { NotesDocument } from '@nesso-how/vocab-learning'
import { graphToDocument } from './graphDocumentMapping'
import type { NessoEdgeData } from '@nesso-how/graph'

describe('graphToDocument', () => {
  const display = {
    edgeEncoding: 'full' as const,
    showHeatmap: false,
    curveStyle: 'straight' as const,
    dimUnconnectedOnSelect: true,
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

  it('serializes relation curve offsets without FSRS or legacy fields', () => {
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
          // A runtime edge that somehow still carries a legacy field must not
          // leak it into the saved document.
          data: {
            type: 'causes',
            curveOffset: -1.5,
            curveFlip: true,
          } as unknown as NessoEdgeData,
        },
      ],
    })
    expect(file.relations[0]).toMatchObject({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      type: 'causes',
      data: { curveOffset: -1.5 },
    })
    expect(file.relations[0].data).not.toHaveProperty('curveFlip')
    expect(file.relations[0].data).not.toHaveProperty('curveFlipPinned')
  })

  it('omits relation data entirely when no curve offset is stored', () => {
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
      edges: [{ id: 'e1', source: 'n1', target: 'n2', type: 'nesso', data: { type: 'causes' } }],
    })
    expect(file.relations[0]).not.toHaveProperty('data')
  })

  it('round-trips elaboration notes without restructuring them', () => {
    const notes: NotesDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    }
    const expectedElaboration = structuredClone({ definition: 'd', notes })
    const file = graphToDocument({
      name: 'Notes',
      display,
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            text: 'A',
            ...defaultConceptReviewFields(),
            elaboration: { definition: 'd', notes },
          },
        },
      ],
      edges: [],
    })
    expect(file.concepts[0].data?.elaboration).toEqual(expectedElaboration)

    const roundTripped = deserialize(serialize(file))
    expect(roundTripped.concepts[0].data?.elaboration).toEqual(expectedElaboration)
  })
})
