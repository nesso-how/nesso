// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  arcControlPoint,
  defaultCurveFlip,
  effectiveCurveFlip,
  nessoArcPath,
  nodeCenterX,
  nodeCenterY,
  rectExit,
} from './geometry.js'

describe('defaultCurveFlip', () => {
  it('flips only when the target is above-right or below-left of the source', () => {
    // target above and to the right -> above !== left -> flip
    expect(defaultCurveFlip(0, 0, 10, -10)).toBe(true)
    // target below and to the left -> flip
    expect(defaultCurveFlip(0, 0, -10, 10)).toBe(true)
    // target above and to the left -> no flip
    expect(defaultCurveFlip(0, 0, -10, -10)).toBe(false)
    // target below and to the right -> no flip
    expect(defaultCurveFlip(0, 0, 10, 10)).toBe(false)
  })
})

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

  it('mirrors the bend when curveFlip is set', () => {
    const a = arcControlPoint(0, 0, 100, 0, 0, false)
    const b = arcControlPoint(0, 0, 100, 0, 0, true)
    expect(b.cpy).toBeCloseTo(-a.cpy)
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
})

describe('effectiveCurveFlip', () => {
  it('computes the automatic flip when auto and not pinned', () => {
    expect(effectiveCurveFlip(true, false, false, 0, 0, 10, -10)).toBe(true)
  })

  it('honors the stored flip when pinned or not auto', () => {
    expect(effectiveCurveFlip(true, true, true, 0, 0, 10, 10)).toBe(true)
    expect(effectiveCurveFlip(false, false, false, 0, 0, 10, -10)).toBe(false)
  })
})
