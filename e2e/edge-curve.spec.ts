// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import {
  connectAlphaBeta,
  createConceptAt,
  gotoApp,
  newEmptyGraph,
  nodeByText,
  edges,
  seedTwoConcepts,
  selectEdge,
} from './helpers'

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

/** Screen point of the edge stroke at a fraction of its length. */
async function strokePoint(
  page: import('@playwright/test').Page,
  fraction: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate((f) => {
    const hit = document.querySelector('.react-flow__edge path')
    if (!(hit instanceof SVGPathElement)) throw new Error('edge hit path not found')
    const pt = hit.getPointAtLength(hit.getTotalLength() * f)
    const ctm = hit.getScreenCTM()
    if (!ctm) throw new Error('edge hit path has no screen CTM')
    const s = new DOMPoint(pt.x, pt.y).matrixTransform(ctm)
    return { x: s.x, y: s.y }
  }, fraction)
}

async function chordMid(page: import('@playwright/test').Page): Promise<{ x: number; y: number }> {
  const a = await strokePoint(page, 0)
  const b = await strokePoint(page, 1)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

test('dragging the arc middle mirrors the bow and persists across reload', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await selectEdge(page)

  const before = await quadSide(page)
  expect(before).not.toBe(0)

  // Grab the stroke middle and drag across the chord to the mirrored side.
  const start = await strokePoint(page, 0.5)
  const mid = await chordMid(page)
  const end = {
    x: mid.x + (mid.x - start.x) * 1.5,
    y: mid.y + (mid.y - start.y) * 1.5,
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
  expect(Math.sign(await quadSide(page))).toBe(Math.sign(after))
})

test('double-clicking the arc resets the default bow', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await selectEdge(page)

  const defaultSide = await quadSide(page)

  // Bend the arc to the mirrored side first (same gesture as above).
  const start = await strokePoint(page, 0.5)
  const mid = await chordMid(page)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(mid.x + (mid.x - start.x) * 1.5, mid.y + (mid.y - start.y) * 1.5, {
    steps: 12,
  })
  await page.mouse.up()
  expect(Math.sign(await quadSide(page))).toBe(-Math.sign(defaultSide))

  const reset = await strokePoint(page, 0.5)
  await page.mouse.dblclick(reset.x, reset.y)
  expect(Math.sign(await quadSide(page))).toBe(Math.sign(defaultSide))
})

test('dragging the target end dot retargets the edge onto another concept', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await createConceptAt(page, 0.45, 0.75, 'Gamma')
  await connectAlphaBeta(page)
  await selectEdge(page)

  const dot = page.locator('[data-testid^="reconnect-target-"]')
  await expect(dot).toBeVisible()
  const box = await dot.boundingBox()
  if (!box) throw new Error('reconnect dot has no bounding box')
  const gamma = await nodeByText(page, 'Gamma').boundingBox()
  if (!gamma) throw new Error('Gamma node has no bounding box')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(gamma.x + gamma.width / 2, gamma.y + gamma.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(edges(page)).toHaveCount(1)
  await selectEdge(page)
  const inspector = page.locator('[data-chrome]').filter({
    has: page.getByTestId('edge-current-relation'),
  })
  await expect(inspector).toHaveText(/Alpha.*subtype of.*Gamma/)
})
