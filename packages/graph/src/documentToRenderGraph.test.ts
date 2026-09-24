// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type {
  NessoGraphDocument,
  NessoRelationData,
  NotesDocument,
} from '@nesso-how/vocab-learning'
import { documentToRenderGraph } from './documentToRenderGraph.js'

function makeDoc(relations: NessoGraphDocument['relations']): NessoGraphDocument {
  return {
    version: 1,
    name: 'Test',
    concepts: [
      { id: 'n1', label: 'A', x: 0, y: 0 },
      { id: 'n2', label: 'B', x: 10, y: 10 },
    ],
    relations,
  }
}

describe('documentToRenderGraph', () => {
  it('translates a legacy flipped relation to a -1 curve offset, dropping the pin', () => {
    // Legacy documents predate curveOffset; their fields only exist at runtime.
    const legacy = {
      curveFlip: true,
      curveFlipPinned: true,
    } as unknown as NessoRelationData
    const { edges } = documentToRenderGraph(
      makeDoc([{ id: 'e1', source: 'n1', target: 'n2', type: 'causes', data: legacy }]),
    )
    expect(edges[0].data).toEqual({ type: 'causes', curveOffset: -1 })
  })

  it('maps legacy unflipped and offset-less relations to the default bow', () => {
    const legacy = { curveFlip: false } as unknown as NessoRelationData
    const { edges } = documentToRenderGraph(
      makeDoc([
        { id: 'e1', source: 'n1', target: 'n2', type: 'causes', data: legacy },
        { id: 'e2', source: 'n2', target: 'n1', type: 'causes' },
      ]),
    )
    expect(edges[0].data).toEqual({ type: 'causes' })
    expect(edges[1].data).toEqual({ type: 'causes' })
  })

  it('passes a stored curve offset through verbatim', () => {
    const { edges } = documentToRenderGraph(
      makeDoc([
        { id: 'e1', source: 'n1', target: 'n2', type: 'causes', data: { curveOffset: 1.5 } },
      ]),
    )
    expect(edges[0].data).toEqual({ type: 'causes', curveOffset: 1.5 })
  })

  it('preserves a full elaboration with notes verbatim on nodes', () => {
    const notes: NotesDocument = {
      type: 'doc',
      content: [
        {
          type: 'callout',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'n' }] }],
        },
      ],
    }
    const expectedElaboration = structuredClone({ definition: 'd', notes })
    const docWithNotes = {
      ...makeDoc([]),
      concepts: [
        { id: 'n1', label: 'A', x: 0, y: 0, data: { elaboration: { definition: 'd', notes } } },
      ],
    }
    const { nodes } = documentToRenderGraph(docWithNotes)
    expect(nodes[0].data.elaboration).toEqual(expectedElaboration)
  })
})
