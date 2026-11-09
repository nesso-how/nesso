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
    { x: -182, y: -132, width: 464, height: 264, scale: 2 },
  )
})

test('image bounds lower the scale until the export fits the budget', () => {
  for (const [size, maxScale, scale] of [
    [400, 4, 4],
    [1500, 4, 2],
    [3000, 4, 1],
    [400, 2, 2],
  ])
    assert.equal(imageBounds([{ x: 0, y: 0, width: size, height: size }], maxScale).scale, scale)
})

test('image bounds reject empty, invalid and exports over budget at scale 1', () => {
  for (const rects of [
    [],
    [{ x: Infinity, y: 0, width: 100, height: 44 }],
    [{ x: 0, y: 0, width: 9000, height: 44 }],
    [{ x: 0, y: 0, width: 4500, height: 4500 }],
  ])
    assert.throws(() => imageBounds(rects, 4))
})
