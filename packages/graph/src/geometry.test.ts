// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest'
import {
  attachmentAt,
  attachmentPoint,
  anchoredArc,
  arcControlPoint,
  clampCurveOffset,
  connectionPreview,
  edgeArcGeometry,
  CURVE_OFFSET_LIMIT,
  nessoArcPath,
  nodeCenterX,
  nodeCenterY,
  quadraticPoint,
  rebaseArcAnchor,
  rectExit,
} from './geometry.js'

it('projects cursor positions onto the pill border and preserves attachments when a node moves', () => {
  const node = { cx: 0, cy: 0, w: 100, h: 32 }
  const left = attachmentAt(node, { x: -12, y: -4 })
  const right = attachmentAt(node, { x: 12, y: -4 })
  expect(attachmentPoint(node, right).x).toBeGreaterThan(attachmentPoint(node, left).x)
  const moved = { ...node, cx: 200, cy: 80 }
  expect(attachmentPoint(moved, left).x - attachmentPoint(node, left).x).toBeCloseTo(200)
  expect(attachmentPoint(moved, left).y - attachmentPoint(node, left).y).toBeCloseTo(80)
  const source = { cx: -200, cy: 0, w: 80, h: 32 }
  expect(edgeArcGeometry(source, node, { targetAttachment: left }).b).toEqual(
    attachmentPoint(node, left),
  )
})

describe('anchoredArc', () => {
  it('keeps an off-center grabbed point exactly under the pointer while both node exits move', () => {
    const source = { cx: 0, cy: 0, w: 80, h: 32 }
    const target = { cx: 200, cy: 0, w: 80, h: 32 }
    const t = 0.23
    const first = anchoredArc(source, target, { x: 60, y: 30, t })
    const moved = anchoredArc(source, target, { x: 110, y: -70, t })
    expect(
      quadraticPoint(moved.a.x, moved.a.y, moved.cpx, moved.cpy, moved.b.x, moved.b.y, t),
    ).toEqual({ x: 110, y: -70 })
    expect(moved.a).not.toEqual(first.a)
    expect(moved.b).not.toEqual(first.b)
    expect(moved.path).toMatch(/ Q /)
  })

  it('uses the same anchor geometry when previewing a different target box', () => {
    const source = { cx: 0, cy: 0, w: 80, h: 32 }
    const target = { cx: 240, cy: 80, w: 80, h: 32 }
    const anchor = { x: 95, y: -45, t: 0.27 }
    expect(edgeArcGeometry(source, target, { anchor }).path).toBe(
      anchoredArc(source, target, anchor).path,
    )
  })
})

describe('rebaseArcAnchor', () => {
  it('rotates and scales a dragged anchor with the prospective node chord', () => {
    const anchor = { x: 60, y: 30, t: 0.27 }
    const source = { cx: 0, cy: 0 }
    const target = { cx: 200, cy: 0 }
    const rotated = rebaseArcAnchor(anchor, source, target, source, { cx: 0, cy: 200 })
    expect(rotated).toEqual({ x: -30, y: 60, t: 0.27 })
    const shifted = rebaseArcAnchor(anchor, source, target, { cx: 40, cy: 10 }, { cx: 440, cy: 10 })
    expect(shifted).toEqual({ x: 160, y: 70, t: 0.27 })
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

describe('connectionPreview', () => {
  it('always draws straight for a new arc, bowed with the edge offset for a reconnect', () => {
    const straight = connectionPreview(0, 0, 80, 32, 200, 0, null, true)
    expect(straight.path).toMatch(/ L /)
    expect(straight.snapped).toBe(false)
    const shaped = connectionPreview(0, 0, 80, 32, 200, 0, null, false, -1.5, 0)
    expect(shaped.path).toMatch(/ Q /)
    const snapped = connectionPreview(0, 0, 80, 32, 200, 0, { cx: 200, cy: 0, w: 80, h: 32 }, true)
    expect(snapped.snapped).toBe(true)
    expect(snapped.path).toMatch(/ L /)
  })
})
