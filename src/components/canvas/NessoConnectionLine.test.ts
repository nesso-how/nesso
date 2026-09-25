// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import { destinationBoxOf, hoveredNode, insideNode, siblingCount } from './NessoConnectionLine'

function node(id: string, x: number, y: number, w = 80, h = 32): Node {
  return { id, position: { x, y }, measured: { width: w, height: h } } as Node
}

describe('insideNode', () => {
  it('contains interior points and excludes exterior ones', () => {
    const n = node('a', 0, 0)
    expect(insideNode(n, { x: 40, y: 16 })).toBe(true)
    expect(insideNode(n, { x: -1, y: 16 })).toBe(false)
    expect(insideNode(n, { x: 40, y: 33 })).toBe(false)
  })

  it('falls back to default sizes without measurements', () => {
    const n = { id: 'a', position: { x: 0, y: 0 } } as Node
    expect(insideNode(n, { x: 79, y: 31 })).toBe(true)
    expect(insideNode(n, { x: 81, y: 16 })).toBe(false)
  })
})

describe('hoveredNode', () => {
  it('skips the drag origin and returns the node under the cursor', () => {
    const nodes = [node('a', 0, 0), node('b', 200, 0)]
    expect(hoveredNode(nodes, 'a', { x: 240, y: 16 })?.id).toBe('b')
    expect(hoveredNode(nodes, 'a', { x: 40, y: 16 })).toBeUndefined()
    expect(hoveredNode(nodes, 'a', { x: 500, y: 500 })).toBeUndefined()
  })
})

describe('destinationBoxOf', () => {
  it('centers the padded box on the node position', () => {
    expect(destinationBoxOf(node('b', 200, 100))).toEqual({ cx: 240, cy: 116, w: 80, h: 32 })
  })
})

describe('siblingCount', () => {
  it('counts edges on the unordered pair in both directions', () => {
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' },
      { source: 'a', target: 'c' },
    ]
    expect(siblingCount(edges, 'a', 'b')).toBe(2)
    expect(siblingCount(edges, 'a', 'c')).toBe(1)
    expect(siblingCount(edges, 'b', 'c')).toBe(0)
  })
})
