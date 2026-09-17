// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { isEdgeConnectedToNode, resolveEdgeVisual } from './edgeHighlight.js'

describe('isEdgeConnectedToNode', () => {
  it('returns false without a selected node', () => {
    expect(isEdgeConnectedToNode('a', 'b', null)).toBe(false)
    expect(isEdgeConnectedToNode('a', 'b', undefined)).toBe(false)
  })

  it('matches incoming and outgoing edges', () => {
    expect(isEdgeConnectedToNode('a', 'b', 'a')).toBe(true)
    expect(isEdgeConnectedToNode('a', 'b', 'b')).toBe(true)
  })

  it('rejects unrelated edges', () => {
    expect(isEdgeConnectedToNode('a', 'b', 'c')).toBe(false)
  })
})

describe('resolveEdgeVisual', () => {
  it('preserves the default unselected look without a node selection', () => {
    expect(
      resolveEdgeVisual({
        isSelected: false,
        hovered: false,
        isConnected: false,
        hasSelection: false,
      }),
    ).toEqual({ width: 1.4, opacity: 0.78, dimmed: false })
  })

  it('emphasizes edges connected to the selected node', () => {
    expect(
      resolveEdgeVisual({
        isSelected: false,
        hovered: false,
        isConnected: true,
        hasSelection: true,
      }),
    ).toEqual({ width: 2, opacity: 1, dimmed: false })
  })

  it('dims unconnected edges while a node is selected', () => {
    const visual = resolveEdgeVisual({
      isSelected: false,
      hovered: false,
      isConnected: false,
      hasSelection: true,
    })
    expect(visual.width).toBe(1.4)
    expect(visual.dimmed).toBe(true)
    expect(visual.opacity).toBeLessThan(0.4)
  })

  it('lets direct selection win over dimming', () => {
    expect(
      resolveEdgeVisual({
        isSelected: true,
        hovered: false,
        isConnected: false,
        hasSelection: true,
      }),
    ).toEqual({ width: 2, opacity: 1, dimmed: false })
  })

  it('lets hover win over dimming without widening', () => {
    expect(
      resolveEdgeVisual({
        isSelected: false,
        hovered: true,
        isConnected: false,
        hasSelection: true,
      }),
    ).toEqual({ width: 1.4, opacity: 1, dimmed: false })
  })
})
