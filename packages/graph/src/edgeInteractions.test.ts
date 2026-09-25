// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { resolveLiveAnchor } from './edgeInteractions.js'

const sourceBox = { cx: 0, cy: 0, w: 80, h: 32 }

describe('resolveLiveAnchor', () => {
  it('lets the in-flight drag anchor win over a committed one', () => {
    const drag = { x: 60, y: 30, t: 0.27 }
    // Regression: re-dragging an already reshaped arc must follow the cursor,
    // not freeze on the committed shape.
    expect(resolveLiveAnchor({ x: 0.1, y: -0.5, t: 0.4 }, sourceBox, drag)).toBe(drag)
  })

  it('denormalizes the committed anchor relative to the source box', () => {
    // 80x32 box + 6px pad: half extents 46 x 22 around the center.
    expect(resolveLiveAnchor({ x: 1, y: -1, t: 0.4 }, sourceBox, null)).toEqual({
      x: 46,
      y: -22,
      t: 0.4,
    })
  })

  it('returns null without any anchor', () => {
    expect(resolveLiveAnchor(undefined, sourceBox, null)).toBeNull()
  })
})
