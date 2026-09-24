// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import { connectAlphaBeta, gotoApp, newEmptyGraph, seedTwoConcepts, selectEdge } from './helpers'

/** Signed side of the quadratic control point relative to the edge chord. */
async function quadSide(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const paths = [...document.querySelectorAll('.react-flow__edge path')]
    const visible = paths.find((p) => p.getAttribute('stroke') !== 'transparent')
    if (!visible) throw new Error('visible edge path not found')
    const m = visible
      .getAttribute('d')
      ?.match(/M ([\d.-]+) ([\d.-]+) Q ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/)
    if (!m) throw new Error(`unexpected edge path: ${visible.getAttribute('d')}`)
    const [, sx, sy, cpx, cpy, tx, ty] = m.map(Number)
    const dx = tx - sx
    const dy = ty - sy
    // Projection of (control - chord midpoint) onto the chord normal (-dy, dx).
    return (cpx - (sx + tx) / 2) * -dy + (cpy - (sy + ty) / 2) * dx
  })
}

test('dragging the curve handle mirrors the arc and persists across reload', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await selectEdge(page)

  const handle = page.locator('[data-testid^="curve-handle-"]')
  await expect(handle).toBeVisible()

  const before = await quadSide(page)
  expect(before).not.toBe(0)

  // Drag the handle across the chord to the mirrored side.
  const box = await handle.boundingBox()
  if (!box) throw new Error('curve handle has no bounding box')
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const chordMid = await page.evaluate(() => {
    const hit = document.querySelector('.react-flow__edge path')
    if (!(hit instanceof SVGPathElement)) throw new Error('edge hit path not found')
    const len = hit.getTotalLength()
    const p0 = hit.getPointAtLength(0)
    const p1 = hit.getPointAtLength(len)
    const ctm = hit.getScreenCTM()
    if (!ctm) throw new Error('edge hit path has no screen CTM')
    const a = new DOMPoint(p0.x, p0.y).matrixTransform(ctm)
    const b = new DOMPoint(p1.x, p1.y).matrixTransform(ctm)
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  })
  const end = {
    x: chordMid.x + (chordMid.x - start.x) * 1.5,
    y: chordMid.y + (chordMid.y - start.y) * 1.5,
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()

  const after = await quadSide(page)
  expect(Math.sign(after)).toBe(-Math.sign(before))

  // Let the debounced autosave (500ms) flush to IndexedDB, then reload: the
  // custom bow must survive as a persisted curveOffset.
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.locator('.react-flow__pane')).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await selectEdge(page)
  await expect(page.locator('[data-testid^="curve-handle-"]')).toBeVisible()
  expect(Math.sign(await quadSide(page))).toBe(Math.sign(after))
})

test('double-clicking the curve handle resets the arc to the default bow', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await selectEdge(page)

  const handle = page.locator('[data-testid^="curve-handle-"]')
  await expect(handle).toBeVisible()

  const defaultSide = await quadSide(page)

  // Bend the arc to the mirrored side first (same gesture as above).
  const box = await handle.boundingBox()
  if (!box) throw new Error('curve handle has no bounding box')
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x, start.y - 160, { steps: 12 })
  await page.mouse.up()
  expect(Math.sign(await quadSide(page))).toBe(-Math.sign(defaultSide))

  await handle.dblclick()
  expect(Math.sign(await quadSide(page))).toBe(Math.sign(defaultSide))
})
