// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { defaultConceptReviewFields } from '@/types/graph'
import { fillConceptNodeParams } from '@/data/conceptNodes'

describe('fillConceptNodeParams', () => {
  it('fills missing private params while preserving persisted values', () => {
    const nodes: Node<Record<string, unknown>>[] = [
      {
        id: 'n1',
        position: { x: 0, y: 0 },
        data: { text: 'A', stability: 12, reps: 3 },
      },
    ]
    const [filled] = fillConceptNodeParams(nodes)
    expect(filled.data.stability).toBe(12)
    expect(filled.data.reps).toBe(3)
    expect(filled.data.difficulty).toBe(0)
  })

  it('coerces non-string text to an empty string', () => {
    const nodes: Node<Record<string, unknown>>[] = [
      { id: 'n1', position: { x: 0, y: 0 }, data: { text: 42 } },
    ]
    expect(fillConceptNodeParams(nodes)[0].data.text).toBe('')
  })

  it('ignores a non-object node data blob', () => {
    const nodes = [{ id: 'n1', position: { x: 0, y: 0 }, data: 'oops' }] as unknown as Node<
      Record<string, unknown>
    >[]
    const data = fillConceptNodeParams(nodes)[0].data
    expect(data.text).toBe('')
    expect(data).toMatchObject(defaultConceptReviewFields())
  })
})
