// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData } from '@/types/graph'
import { buildReviewElaborationPrompt } from './context'

type Elaboration = NonNullable<ConceptNodeData['elaboration']>

function nodeWith(elaboration?: Partial<Elaboration>): Node<ConceptNodeData> {
  const elab = elaboration ? { definition: '', examples: '', notes: '', ...elaboration } : undefined
  return {
    id: 'n1',
    position: { x: 0, y: 0 },
    data: { text: 'Concept', elaboration: elab },
  } as unknown as Node<ConceptNodeData>
}

describe('buildReviewElaborationPrompt', () => {
  it('returns empty when there is no elaboration', () => {
    expect(buildReviewElaborationPrompt(nodeWith())).toBe('')
  })

  it('returns empty when the elaboration has no usable fields', () => {
    expect(
      buildReviewElaborationPrompt(nodeWith({ definition: '  ', examples: '\n', notes: '' })),
    ).toBe('')
  })

  it('labels the definition', () => {
    expect(buildReviewElaborationPrompt(nodeWith({ definition: 'A tree' }))).toBe(
      'Definition: A tree',
    )
  })

  it('joins definition, examples and notes on separate lines, trimming examples', () => {
    expect(
      buildReviewElaborationPrompt(
        nodeWith({ definition: 'A tree', examples: 'oak\n maple ', notes: 'deciduous' }),
      ),
    ).toBe('Definition: A tree\nExamples: oak; maple\nNotes: deciduous')
  })

  it('omits empty sections', () => {
    expect(buildReviewElaborationPrompt(nodeWith({ notes: 'just notes' }))).toBe(
      'Notes: just notes',
    )
  })

  it('truncates when over the token budget', () => {
    const long = 'word '.repeat(2000).trim()
    const out = buildReviewElaborationPrompt(nodeWith({ definition: long }))
    expect(out.length).toBeLessThan(long.length)
    expect(out.endsWith('…')).toBe(true)
  })
})
