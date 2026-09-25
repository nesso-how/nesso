// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  anchorField,
  hoverDotCorner,
  incidentEndpoint,
  numberField,
  pointField,
} from './dotPlacement'
import type { DotBox, DotEdge, DotSnapshot } from './dotPlacement'

const MINE: DotSnapshot = { position: { x: 100, y: 50 }, measured: { width: 120, height: 32 } }
const OTHER: DotSnapshot = { position: { x: 400, y: 50 }, measured: { width: 120, height: 32 } }

function snapshotOf(id: string): DotSnapshot | undefined {
  if (id === 'mine') return MINE
  if (id === 'other') return OTHER
  return undefined
}

function edgeTo(data: Record<string, unknown> = {}): DotEdge {
  return { source: 'mine', target: 'other', data }
}

describe('field guards', () => {
  it('reads finite numbers with fallback', () => {
    expect(numberField({ a: 2 }, 'a', 1)).toBe(2)
    expect(numberField({ a: Number.NaN }, 'a', 1)).toBe(1)
    expect(numberField({ a: 'x' }, 'a', 1)).toBe(1)
    expect(numberField(undefined, 'a', 1)).toBe(1)
  })

  it('reads finite points', () => {
    expect(pointField({ p: { x: 1, y: 2 } }, 'p')).toEqual({ x: 1, y: 2 })
    expect(pointField({ p: { x: Number.NaN, y: 2 } }, 'p')).toBeUndefined()
    expect(pointField({ p: 'nope' }, 'p')).toBeUndefined()
    expect(pointField(undefined, 'p')).toBeUndefined()
  })

  it('reads reshape anchors', () => {
    expect(anchorField({ curveAnchor: { x: 0, y: -1, t: 0.5 } })).toEqual({ x: 0, y: -1, t: 0.5 })
    expect(anchorField({ curveAnchor: { x: 1 } })).toBeUndefined()
    expect(anchorField({})).toBeUndefined()
  })
})

describe('incidentEndpoint', () => {
  const myBox: DotBox = { x: 100, y: 50, w: 120, h: 32 }
  const boxOf = () => ({ x: 400, y: 50, w: 120, h: 32 })

  it('returns undefined for unrelated edges or unknown neighbours', () => {
    expect(
      incidentEndpoint({ source: 'a', target: 'b' }, 'mine', myBox, boxOf, false),
    ).toBeUndefined()
    expect(
      incidentEndpoint({ source: 'mine', target: 'ghost' }, 'mine', myBox, () => undefined, false),
    ).toBeUndefined()
  })
})

describe('hoverDotCorner', () => {
  it('keeps the top-left corner without incident edges', () => {
    expect(hoverDotCorner('mine', MINE, [], snapshotOf, 'arc')).toEqual({ left: 0, top: 0 })
  })

  it('ignores edges of other nodes', () => {
    const edges: DotEdge[] = [{ source: 'a', target: 'b', data: {} }]
    expect(hoverDotCorner('mine', MINE, edges, snapshotOf, 'arc')).toEqual({ left: 0, top: 0 })
  })

  it('falls back to the bottom-left when an arc ends on the top-left', () => {
    const attached = [edgeTo({ sourceAttachment: { x: -1, y: -1 } })]
    expect(hoverDotCorner('mine', MINE, attached, snapshotOf, 'arc')).toEqual({
      left: 0,
      top: 32,
    })
  })

  it('falls back to the primary corner when both corners are taken', () => {
    const snap: DotSnapshot = { position: { x: 0, y: 0 }, measured: { width: 40, height: 40 } }
    const of = () => snap
    const edges: DotEdge[] = [
      { source: 'n', target: 'n', data: { sourceAttachment: { x: -1, y: -1 } } },
      { source: 'n', target: 'n', data: { sourceAttachment: { x: -1, y: 1 } } },
    ]
    expect(hoverDotCorner('n', snap, edges, of, 'arc')).toEqual({ left: 0, top: 0 })
  })

  it('rejects malformed data fields without throwing', () => {
    const edges = [
      edgeTo({
        curveOffset: Number.NaN,
        siblingIdx: 'x',
        curveAnchor: { x: 1 },
        sourceAttachment: 'nope',
        targetAttachment: { x: Number.NaN, y: Number.NaN },
      }),
    ]
    expect(hoverDotCorner('mine', MINE, edges, snapshotOf, 'arc')).toEqual({ left: 0, top: 0 })
  })

  it('converts a saved curve anchor from the source box frame', () => {
    // Anchor at the top of the source padded box: the source end exits the
    // top edge, far from the top-left corner. A raw normalized anchor read
    // as flow coordinates would point near the canvas origin instead and
    // wrongly mark the corner taken.
    const edges = [edgeTo({ curveAnchor: { x: 0, y: -1, t: 0.5 } })]
    expect(hoverDotCorner('mine', MINE, edges, snapshotOf, 'arc')).toEqual({ left: 0, top: 0 })
  })

  it('matches the committed geometry in straight mode', () => {
    const attached = [edgeTo({ sourceAttachment: { x: -1, y: -1 } })]
    expect(hoverDotCorner('mine', MINE, attached, snapshotOf, 'straight')).toEqual({
      left: 0,
      top: 32,
    })
  })
})
