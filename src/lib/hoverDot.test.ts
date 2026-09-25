// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { hoverDotBox, hoverDotOffset } from './hoverDot'

const BOX = { x: 100, y: 50, w: 120, h: 32 }

describe('hoverDotBox', () => {
  it('reads the measured flow box', () => {
    expect(
      hoverDotBox(
        { position: { x: 100, y: 50 }, measured: { width: 120, height: 32 } },
        { w: 80, h: 32 },
      ),
    ).toEqual(BOX)
  })

  it('falls back without a node or measurement', () => {
    expect(hoverDotBox(undefined, { w: 80, h: 32 })).toEqual({ x: 0, y: 0, w: 80, h: 32 })
    expect(hoverDotBox({ position: { x: 10, y: 20 } }, { w: 80, h: 32 })).toEqual({
      x: 10,
      y: 20,
      w: 80,
      h: 32,
    })
  })
})

describe('hoverDotOffset', () => {
  it('sits on the left border for a cursor to the left', () => {
    const pos = hoverDotOffset(BOX, { x: 0, y: 66 })
    expect(pos.left).toBeCloseTo(-6, 5)
    expect(pos.top).toBeCloseTo(16, 5)
  })

  it('sits on the top border for a cursor above', () => {
    const pos = hoverDotOffset(BOX, { x: 160, y: 0 })
    expect(pos.left).toBeCloseTo(60, 5)
    expect(pos.top).toBeCloseTo(-6, 5)
  })

  it('sits on the border for a cursor inside the node', () => {
    const pos = hoverDotOffset(BOX, { x: 160, y: 66 })
    expect(pos.top).toBeCloseTo(-6, 5)
  })
})
