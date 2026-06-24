// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { NessoGraphDocument } from '@nesso-how/vocab-learning'
import { documentToRenderGraph } from './documentToRenderGraph.js'

const doc: NessoGraphDocument = {
  version: 1,
  name: 'Test',
  concepts: [
    { id: 'n1', label: 'A', x: 0, y: 0 },
    { id: 'n2', label: 'B', x: 10, y: 10 },
  ],
  relations: [{ id: 'e1', source: 'n1', target: 'n2', type: 'causes', data: { curveFlip: true } }],
}

describe('documentToRenderGraph', () => {
  it('maps relation curve metadata to nesso edge data', () => {
    const { edges } = documentToRenderGraph(doc)
    expect(edges[0]).toMatchObject({
      id: 'e1',
      source: 'n1',
      target: 'n2',
      type: 'nesso',
      data: { type: 'causes', curveFlip: true },
    })
  })
})
