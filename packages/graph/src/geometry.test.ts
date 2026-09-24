// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  arcControlPoint,
  clampCurveOffset,
  curveOffsetForPointer,
  CURVE_OFFSET_LIMIT,
  nessoArcPath,
  nodeCenterX,
  nodeCenterY,
  rectExit,
} from './geometry.js'

describe('nodeCenterX / nodeCenterY', () => {
  it('uses measured dimensions when present', () => {
    const node = { position: { x: 10, y: 20 }, measured: { width: 100, height: 40 } }
    expect(nodeCenterX(node)).toBe(60)
    expect(nodeCenterY(node)).toBe(40)
  })

  it('falls back to the default 80x32 box when unmeasured', () => {
    expect(nodeCenterX({ position: { x: 0 } })).toBe(40)
    expect(nodeCenterY({ position: { y: 0 } })).toBe(16)
  })
})

describe('rectExit', () => {
  it('returns the center when source and target coincide', () => {
    expect(rectExit(5, 5, 10, 10, 5, 5)).toEqual({ x: 5, y: 5 })
  })

  it('exits through the right edge for a horizontal target', () => {
    // half-width 10, pointing straight right -> x advances by 10
    expect(rectExit(0, 0, 20, 20, 100, 0)).toEqual({ x: 10, y: 0 })
  })

  it('exits through the bottom edge for a vertical target', () => {
    expect(rectExit(0, 0, 20, 20, 0, 100)).toEqual({ x: 0, y: 10 })
  })
})

describe('arcControlPoint', () => {
  it('bends perpendicular to the source->target line', () => {
    const { cpx, cpy } = arcControlPoint(0, 0, 100, 0)
    expect(cpx).toBe(50) // midpoint stays on the x axis
    expect(cpy).toBeGreaterThan(0) // bows downward (perpendicular)
  })

  it('mirrors the bend at offset -1 and flattens the arc at offset 0', () => {
    const a = arcControlPoint(0, 0, 100, 0, 0, 1)
    const b = arcControlPoint(0, 0, 100, 0, 0, -1)
    const flat = arcControlPoint(0, 0, 100, 0, 0, 0)
    expect(b.cpx).toBeCloseTo(a.cpx)
    expect(b.cpy).toBeCloseTo(-a.cpy)
    expect(flat.cpx).toBe(50)
    expect(flat.cpy).toBeCloseTo(0)
  })

  it('scales the bow with |offset| and keeps the sibling fan additive', () => {
    const base = arcControlPoint(0, 0, 100, 0, 0, 1)
    expect(arcControlPoint(0, 0, 100, 0, 0, 2).cpy).toBeCloseTo(base.cpy * 2)
    // fan = siblingIdx * 7, added after the offset scaling
    expect(arcControlPoint(0, 0, 100, 0, 1, 1).cpy).toBeCloseTo(base.cpy + 7)
  })

  it('clamps dragged offsets to the CURVE_OFFSET_LIMIT window', () => {
    expect(CURVE_OFFSET_LIMIT).toBe(3)
    expect(clampCurveOffset(10)).toBe(3)
    expect(clampCurveOffset(-10)).toBe(-3)
    expect(clampCurveOffset(1.5)).toBe(1.5)
    expect(clampCurveOffset(Number.NaN)).toBe(1)
    expect(clampCurveOffset(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

describe('curveOffsetForPointer', () => {
  // Horizontal chord (0,0) -> (100,0): normal points down (+y), default bend 22.
  it('inverts the bow mapping (+1 apex, -1 mirrored, 0 on the chord)', () => {
    expect(curveOffsetForPointer(50, 11, 0, 0, 100, 0)).toBeCloseTo(1, 1)
    expect(curveOffsetForPointer(50, -11, 0, 0, 100, 0)).toBeCloseTo(-1, 1)
    expect(curveOffsetForPointer(50, 0, 0, 0, 100, 0)).toBe(0)
  })

  it('clamps far pointers and falls back on a degenerate chord', () => {
    expect(curveOffsetForPointer(50, 500, 0, 0, 100, 0)).toBe(3)
    expect(curveOffsetForPointer(50, -500, 0, 0, 100, 0)).toBe(-3)
    expect(curveOffsetForPointer(5, 5, 10, 10, 10, 10, -1)).toBe(-1)
  })
})

describe('nessoArcPath', () => {
  it('draws a straight line and midpoint label when straight=true', () => {
    const r = nessoArcPath(0, 0, 100, 50, 0, true)
    expect(r.path).toBe('M 0 0 L 100 50')
    expect(r.labelX).toBe(50)
    expect(r.labelY).toBe(25)
    expect(r.arrowAngle).toBeCloseTo(Math.atan2(50, 100))
  })

  it('draws a quadratic curve when straight=false', () => {
    const r = nessoArcPath(0, 0, 100, 0)
    expect(r.path).toMatch(/^M 0 0 Q /)
    expect(r.path).toContain(' 100 0')
  })

  it('places the label at the line midpoint when the arc is flattened', () => {
    const r = nessoArcPath(0, 0, 100, 50, 0, false, 0)
    expect(r.labelX).toBe(50)
    expect(r.labelY).toBeCloseTo(25)
  })
})
