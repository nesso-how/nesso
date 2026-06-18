// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'
import { styleEdges } from './styleEdges'

const edge = (id: string, source: string, target: string, data?: Edge['data']): Edge =>
  ({ id, source, target, ...(data ? { data } : {}) }) as Edge

describe('styleEdges', () => {
  it('assigns siblingIdx 0 to a lone edge', () => {
    const [e] = styleEdges([edge('e1', 'a', 'b')])
    expect(e.data?.siblingIdx).toBe(0)
  })

  it('increments siblingIdx across edges sharing a node pair', () => {
    const out = styleEdges([edge('e1', 'a', 'b'), edge('e2', 'a', 'b'), edge('e3', 'a', 'b')])
    expect(out.map((e) => e.data?.siblingIdx)).toEqual([0, 1, 2])
  })

  it('treats reversed direction as the same pair', () => {
    const out = styleEdges([edge('e1', 'a', 'b'), edge('e2', 'b', 'a')])
    expect(out.map((e) => e.data?.siblingIdx)).toEqual([0, 1])
  })

  it('counts distinct pairs independently', () => {
    const out = styleEdges([edge('e1', 'a', 'b'), edge('e2', 'c', 'd'), edge('e3', 'a', 'b')])
    expect(out.map((e) => e.data?.siblingIdx)).toEqual([0, 0, 1])
  })

  it('returns the same object reference when siblingIdx is already correct', () => {
    const stable = edge('e1', 'a', 'b', { siblingIdx: 0 })
    const [out] = styleEdges([stable])
    expect(out).toBe(stable)
  })

  it('preserves other edge data when adding siblingIdx', () => {
    const [out] = styleEdges([edge('e1', 'a', 'b', { type: 'causes' })])
    expect(out.data).toMatchObject({ type: 'causes', siblingIdx: 0 })
  })
})
