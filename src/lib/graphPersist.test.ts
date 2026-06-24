// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import type { ConceptNodeData, GraphDisplaySettings } from '@/types/graph'
import { defaultConceptReviewFields } from '@/types/graph'
import { graphContentFingerprint, reviewStateFingerprint } from '@/lib/graphPersist'

const display: GraphDisplaySettings = {
  edgeEncoding: 'full',
  showHeatmap: false,
  curveStyle: 'straight',
  autoCurveFlip: true,
}

function node(
  over: Partial<ConceptNodeData> & { id?: string; x?: number; y?: number } = {},
): Node<ConceptNodeData> {
  const { id = 'n1', x = 0, y = 0, ...data } = over
  return {
    id,
    position: { x, y },
    data: { text: 'A', ...defaultConceptReviewFields(), ...data },
  }
}

describe('graphContentFingerprint', () => {
  it('ignores FSRS state', () => {
    const base = graphContentFingerprint([node()], [], display)
    expect(
      graphContentFingerprint([node({ stability: 999, due: 123, reps: 7 })], [], display),
    ).toBe(base)
  })

  it('changes on text, elaboration and position', () => {
    const base = graphContentFingerprint([node()], [], display)
    expect(graphContentFingerprint([node({ text: 'B' })], [], display)).not.toBe(base)
    expect(
      graphContentFingerprint(
        [node({ elaboration: { definition: 'd', examples: '', notes: '' } })],
        [],
        display,
      ),
    ).not.toBe(base)
    expect(graphContentFingerprint([node({ x: 50 })], [], display)).not.toBe(base)
  })
})

describe('reviewStateFingerprint', () => {
  it('changes on FSRS state', () => {
    const base = reviewStateFingerprint([node()])
    expect(reviewStateFingerprint([node({ stability: 999 })])).not.toBe(base)
  })

  it('ignores text and position', () => {
    const base = reviewStateFingerprint([node()])
    expect(reviewStateFingerprint([node({ text: 'B', x: 99 })])).toBe(base)
  })

  it('is order-independent across nodes', () => {
    const a = reviewStateFingerprint([node({ id: 'n1' }), node({ id: 'n2', stability: 5 })])
    const b = reviewStateFingerprint([node({ id: 'n2', stability: 5 }), node({ id: 'n1' })])
    expect(a).toBe(b)
  })
})
