// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { ConceptNodeData } from '@/types/graph'
import { defaultConceptReviewFields } from '@/types/graph'
import { sortedDueConceptNodes } from './fsrsDueQueue'

function node(id: string, due: number): Node<ConceptNodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { text: id, ...defaultConceptReviewFields(), due },
  }
}

describe('sortedDueConceptNodes', () => {
  it('keeps only due nodes and orders them earliest-due first', () => {
    const now = Date.now()
    const a = node('a', now - 1_000)
    const b = node('b', now - 5_000)
    const future = node('c', now + 1_000_000)
    const out = sortedDueConceptNodes([a, future, b])
    expect(out.map((n) => n.id)).toEqual(['b', 'a'])
  })

  it('treats due=0 as due now', () => {
    expect(sortedDueConceptNodes([node('a', 0)]).map((n) => n.id)).toEqual(['a'])
  })

  it('excludes a node due in the future', () => {
    expect(sortedDueConceptNodes([node('a', Date.now() + 1_000_000)])).toEqual([])
  })

  it('does not mutate the input array', () => {
    const input = [node('a', 2), node('b', 1)]
    sortedDueConceptNodes(input)
    expect(input.map((n) => n.id)).toEqual(['a', 'b'])
  })
})
