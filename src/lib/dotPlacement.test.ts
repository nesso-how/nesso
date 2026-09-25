// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { hoverDotCorner } from './dotPlacement'
import type { DotEdge, DotSnapshot } from './dotPlacement'

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
        targetAttachment: null,
      }),
    ]
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
