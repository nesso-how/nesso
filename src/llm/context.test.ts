// SPDX-License-Identifier: MIT
import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { ConceptElaboration, ConceptNodeData } from '@/types/graph'
import { defaultConceptReviewFields } from '@/types/graph'
import { buildFocalNeighborContext, nodeStrength, oneHopNeighborIds } from './context'

type NodeInit = Partial<Omit<ConceptNodeData, 'elaboration'>> & {
  elaboration?: Partial<ConceptElaboration>
}

// Elaboration fields are typed as required, but the renderers defend against
// malformed data with optional chaining (hand-edited JSON, older records). Tests
// pass partial elaboration on purpose to exercise those "field missing" branches,
// so the partial is cast rather than filled.
function node({ elaboration, ...rest }: NodeInit): Node<ConceptNodeData> {
  return {
    id: 'n',
    position: { x: 0, y: 0 },
    data: {
      text: '',
      ...defaultConceptReviewFields(),
      ...rest,
      ...(elaboration ? { elaboration: elaboration as ConceptElaboration } : {}),
    },
  }
}

describe('nodeStrength', () => {
  it('sorts an unreviewed node (reps 0) weakest with -Infinity', () => {
    expect(nodeStrength(node({ reps: 0, stability: 99 }))).toBe(-Infinity)
  })

  it('uses raw stability for a Good/Easy rating', () => {
    expect(nodeStrength(node({ reps: 1, stability: 10, lastRating: 3 }))).toBe(10)
  })

  it('discounts an Again rating by 0.86', () => {
    expect(nodeStrength(node({ reps: 1, stability: 10, lastRating: 1 }))).toBeCloseTo(8.6, 6)
  })

  it('discounts a Hard rating by 0.93', () => {
    expect(nodeStrength(node({ reps: 1, stability: 10, lastRating: 2 }))).toBeCloseTo(9.3, 6)
  })

  it('floors stability at a tiny positive value', () => {
    expect(nodeStrength(node({ reps: 1, stability: 0, lastRating: 3 }))).toBeCloseTo(1e-9, 12)
  })

  it('discounts an overdue node by 0.965', () => {
    expect(nodeStrength(node({ reps: 1, stability: 10, lastRating: 3, due: 1 }))).toBeCloseTo(
      9.65,
      6,
    )
  })

  it('does not discount a node due in the future', () => {
    expect(
      nodeStrength(node({ reps: 1, stability: 10, lastRating: 3, due: Date.now() + 1_000_000 })),
    ).toBe(10)
  })

  it('does not treat due=0 as overdue', () => {
    expect(nodeStrength(node({ reps: 1, stability: 10, lastRating: 3, due: 0 }))).toBe(10)
  })

  it('combines an Again discount with the overdue discount', () => {
    expect(nodeStrength(node({ reps: 1, stability: 10, lastRating: 1, due: 1 }))).toBeCloseTo(
      10 * 0.86 * 0.965,
      6,
    )
  })
})

describe('oneHopNeighborIds', () => {
  it('collects neighbors reachable in one hop in either direction, deduped', () => {
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'c', target: 'a' },
      { source: 'b', target: 'c' },
      { source: 'a', target: 'b' },
    ]
    expect(new Set(oneHopNeighborIds('a', edges))).toEqual(new Set(['b', 'c']))
  })

  it('returns an empty list for an isolated node', () => {
    expect(oneHopNeighborIds('x', [{ source: 'a', target: 'b' }])).toEqual([])
  })
})

describe('buildFocalNeighborContext', () => {
  it('returns empty strings for a null focal node', () => {
    expect(buildFocalNeighborContext(null, [])).toEqual({ focus: '', related: '' })
  })

  it('renders the focal elaboration as definition, examples, and notes', () => {
    const focal = node({
      text: 'F',
      elaboration: { definition: 'def of F', examples: 'e1\ne2', notes: 'n' },
    })
    expect(buildFocalNeighborContext(focal, []).focus).toBe(
      '"F": def of F Examples: e1; e2 Notes: n',
    )
  })

  it('omits focus when the focal node has no elaboration', () => {
    expect(buildFocalNeighborContext(node({ text: 'F' }), []).focus).toBe('')
  })

  it('includes only the elaboration fields that are present', () => {
    expect(
      buildFocalNeighborContext(node({ text: 'F', elaboration: { definition: 'just def' } }), [])
        .focus,
    ).toBe('"F": just def')
    expect(
      buildFocalNeighborContext(node({ text: 'F', elaboration: { examples: 'a\nb' } }), []).focus,
    ).toBe('"F": Examples: a; b')
    expect(
      buildFocalNeighborContext(node({ text: 'F', elaboration: { notes: 'just notes' } }), [])
        .focus,
    ).toBe('"F": Notes: just notes')
  })

  it('trims whitespace and drops blank example lines in focus', () => {
    expect(
      buildFocalNeighborContext(
        node({ text: 'F', elaboration: { definition: '  spaced  ', examples: 'a\n\n  \nb' } }),
        [],
      ).focus,
    ).toBe('"F": spaced Examples: a; b')
  })

  it('returns empty focus when every elaboration field is blank', () => {
    expect(
      buildFocalNeighborContext(
        node({ text: 'F', elaboration: { definition: ' ', examples: '\n', notes: '' } }),
        [],
      ).focus,
    ).toBe('')
  })

  it('sorts related neighbors strongest-first and skips ones without a definition', () => {
    const focal = node({ text: 'F', elaboration: { definition: 'd' } })
    const weak = node({ text: 'W', reps: 1, stability: 1, elaboration: { definition: 'weak' } })
    const strong = node({
      text: 'S',
      reps: 1,
      stability: 100,
      elaboration: { definition: 'strong' },
    })
    const noDef = node({ text: 'X', reps: 1, stability: 50 })
    const related = buildFocalNeighborContext(focal, [weak, strong, noDef]).related
    expect(related.indexOf('"S"')).toBeLessThan(related.indexOf('"W"'))
    expect(related).not.toContain('"X"')
  })

  it('joins related neighbors with "; " and trims their definitions', () => {
    const focal = node({ text: 'F', elaboration: { definition: 'd' } })
    const a = node({ text: 'A', reps: 1, stability: 10, elaboration: { definition: '  alpha  ' } })
    const b = node({ text: 'B', reps: 1, stability: 5, elaboration: { definition: 'beta' } })
    expect(buildFocalNeighborContext(focal, [a, b]).related).toBe('"A": alpha; "B": beta')
  })

  it('truncates an over-long focus body to a non-trivial length with an ellipsis', () => {
    const big = 'word '.repeat(500)
    const focus = buildFocalNeighborContext(
      node({ text: 'F', elaboration: { definition: big } }),
      [],
    ).focus
    expect(focus.endsWith('…')).toBe(true)
    expect(focus.length).toBeGreaterThan(1000)
    expect(focus.length).toBeLessThan(big.length)
  })

  it('stops adding related neighbors once the token budget is exhausted', () => {
    const focal = node({ text: 'F', elaboration: { definition: 'd' } })
    const neighbors = Array.from({ length: 30 }, (_, i) =>
      node({
        text: `N${i}`,
        reps: 1,
        stability: 30 - i,
        elaboration: { definition: 'x'.repeat(110) },
      }),
    )
    const count = (buildFocalNeighborContext(focal, neighbors).related.match(/": x/g) ?? []).length
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(30)
  })
})
