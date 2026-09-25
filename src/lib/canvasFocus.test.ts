// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import { computeFocusNodeIds } from './canvasFocus'

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target } as Edge
}

describe('computeFocusNodeIds', () => {
  it('returns the selected relation endpoints', () => {
    expect(
      computeFocusNodeIds({ kind: 'edge', id: 'e1' }, { id: 'e1', source: 'a', target: 'b' }, [
        edge('a', 'b'),
        edge('b', 'c'),
      ]),
    ).toEqual(['a', 'b'])
  })

  it('returns the selected concept plus its direct neighbours', () => {
    expect(
      computeFocusNodeIds({ kind: 'node', id: 'b' }, null, [
        edge('a', 'b'),
        edge('b', 'c'),
        edge('c', 'd'),
      ]),
    ).toEqual(['b', 'a', 'c'])
  })

  it('returns null without a node or relation selection', () => {
    expect(computeFocusNodeIds(null, null, [edge('a', 'b')])).toBeNull()
    expect(computeFocusNodeIds(undefined, null, [edge('a', 'b')])).toBeNull()
  })
})
