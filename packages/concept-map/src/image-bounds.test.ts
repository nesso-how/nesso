import assert from 'node:assert/strict'
import test from 'node:test'
import { imageBounds } from './image-bounds.ts'

test('image bounds pad the full rectangle extent, including negative coordinates', () => {
  assert.deepEqual(
    imageBounds(
      [
        { x: -120, y: -50, width: 100, height: 44 },
        { x: -150, y: -100, width: 400, height: 200 },
      ],
      2,
    ),
    { x: -182, y: -132, width: 464, height: 264 },
  )
})

test('image bounds reject empty, invalid, oversized and over-budget exports without scaling down', () => {
  for (const rects of [
    [],
    [{ x: Infinity, y: 0, width: 100, height: 44 }],
    [{ x: 0, y: 0, width: 5000, height: 44 }],
    [{ x: 0, y: 0, width: 3000, height: 3000 }],
  ])
    assert.throws(() => imageBounds(rects, 2))
})
