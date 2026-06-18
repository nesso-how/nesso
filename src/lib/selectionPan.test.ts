// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import { computeSelectionPan } from './selectionPan'

const VIS = { left: 100, top: 100, right: 500, bottom: 400 }
const VP = { x: 0, y: 0, zoom: 1 }

describe('computeSelectionPan', () => {
  it('returns null when the box already fits', () => {
    expect(
      computeSelectionPan({ left: 200, top: 200, right: 300, bottom: 300 }, VP, VIS),
    ).toBeNull()
  })

  it('pans left when the box overflows the right edge', () => {
    expect(computeSelectionPan({ left: 450, top: 200, right: 560, bottom: 300 }, VP, VIS)).toEqual({
      dx: -60,
      dy: 0,
    })
  })

  it('pans right when the box overflows the left edge', () => {
    expect(computeSelectionPan({ left: 40, top: 200, right: 90, bottom: 300 }, VP, VIS)).toEqual({
      dx: 60,
      dy: 0,
    })
  })

  it('pans up when the box overflows the bottom edge', () => {
    expect(computeSelectionPan({ left: 200, top: 380, right: 300, bottom: 480 }, VP, VIS)).toEqual({
      dx: 0,
      dy: -80,
    })
  })

  it('pans down when the box overflows the top edge', () => {
    expect(computeSelectionPan({ left: 200, top: 40, right: 300, bottom: 90 }, VP, VIS)).toEqual({
      dx: 0,
      dy: 60,
    })
  })

  it('lets the right edge win when the box is wider than the visible rect', () => {
    expect(computeSelectionPan({ left: 50, top: 200, right: 600, bottom: 300 }, VP, VIS)).toEqual({
      dx: -100,
      dy: 0,
    })
  })

  it('projects world coordinates through the viewport zoom and offset', () => {
    const vp = { x: 10, y: 0, zoom: 2 }
    expect(
      computeSelectionPan({ left: 100, top: 0, right: 150, bottom: 10 }, vp, {
        left: 0,
        top: 0,
        right: 300,
        bottom: 1000,
      }),
    ).toEqual({ dx: -10, dy: 0 })
  })

  it('returns null when the overflow is below the 0.5px threshold', () => {
    expect(
      computeSelectionPan({ left: 200, top: 200, right: 500.3, bottom: 300 }, VP, VIS),
    ).toBeNull()
  })

  it('skips an axis whose visible extent is inverted', () => {
    expect(
      computeSelectionPan({ left: 50, top: 380, right: 600, bottom: 480 }, VP, {
        left: 500,
        top: 100,
        right: 100,
        bottom: 400,
      }),
    ).toEqual({ dx: 0, dy: -80 })
  })
})
