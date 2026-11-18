import assert from 'node:assert/strict'
import test from 'node:test'
import { getBezierPath, Position } from '@xyflow/react'
import { draggedBend, relationCurve } from './relation-curve.ts'

test('zero bend reproduces automatic Bezier geometry for every attachment side', () => {
  for (const sourcePosition of Object.values(Position))
    for (const targetPosition of Object.values(Position)) {
      const source = { x: 10, y: 20 }
      const target = { x: 240, y: 130 }
      const curve = relationCurve({ source, target, sourcePosition, targetPosition })
      const [path, x, y] = getBezierPath({
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        sourcePosition,
        targetPosition,
      })
      assert.equal(curve.path.replaceAll(/\s/g, ''), path.replaceAll(/\s/g, ''))
      assert.ok(Math.abs(curve.midpoint.x - x) < 1e-10)
      assert.ok(Math.abs(curve.midpoint.y - y) < 1e-10)
    }
})

test('bends follow rotation and inverse dragging uses the segment normal', () => {
  const endpoints = {
    source: { x: 0, y: 0 },
    target: { x: 200, y: 0 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }
  const bent = relationCurve(endpoints, 0.25)
  assert.deepEqual(bent.midpoint, { x: 100, y: 50 })
  assert.equal(draggedBend(endpoints.source, endpoints.target, { x: 90, y: 50 }, 0), 0.25)
  assert.deepEqual(
    relationCurve(
      {
        source: { x: 0, y: 0 },
        target: { x: 0, y: 200 },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      },
      0.25,
    ).midpoint,
    { x: -50, y: 100 },
  )
  assert.equal(draggedBend(endpoints.source, endpoints.source, { x: 50, y: 50 }, 0.2), 0.2)
})

test('changing attachment sides preserves the bend handle position', () => {
  const endpoints = {
    source: { x: 0, y: 7 },
    target: { x: 200, y: -7 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }
  const routed = {
    source: { x: -50, y: 25 },
    target: { x: 250, y: 25 },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Bottom,
  }
  assert.deepEqual(
    relationCurve(routed, 0.25, endpoints).midpoint,
    relationCurve(endpoints, 0.25).midpoint,
  )
})
