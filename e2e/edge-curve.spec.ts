// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import {
  connectAlphaBeta,
  createConceptAt,
  deselect,
  gotoApp,
  newEmptyGraph,
  nodeByText,
  edges,
  seedTwoConcepts,
  selectEdge,
  waitForCurveAnchorSaved,
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

for (const style of ['Arc', 'Line'] as const) {
  test(`new edge preview in ${style} mode matches the created edge without endpoint dots`, async ({
    page,
  }) => {
    await gotoApp(page)
    await newEmptyGraph(page)
    await seedTwoConcepts(page)
    if (style === 'Line') await page.getByRole('button', { name: 'Line', exact: true }).click()
    await deselect(page)

    const start = await nodeByText(page, 'Alpha').locator('.react-flow__handle-right').boundingBox()
    const end = await nodeByText(page, 'Beta').boundingBox()
    if (!start || !end) throw new Error('connection nodes not measured')
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(start.x + start.width / 2 + 6, start.y + start.height / 2 + 6)
    await expect(page.locator('[data-testid^="creation-"]')).toHaveCount(0)
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 })

    const connectionPath = page.locator('.react-flow__connectionline path[stroke="var(--accent)"]')
    const numbers = (path: string | null) => path?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    await page.mouse.move(end.x + end.width * 0.35, end.y + 5)
    const left = numbers(await connectionPath.getAttribute('d'))
    await page.mouse.move(end.x + end.width * 0.65, end.y + 5)
    const right = numbers(await connectionPath.getAttribute('d'))
    expect(right[right.length - 2] - left[left.length - 2]).toBeGreaterThan(5)

    const preview = await connectionPath.getAttribute('d')
    expect(preview).toContain(style === 'Arc' ? ' Q ' : ' L ')
    const points = numbers(preview)
    await expect(page.locator('[data-testid^="creation-"]')).toHaveCount(0)

    await page.mouse.up()
    await page.getByTestId('relation-chip-subtype-of').click()
    await expect(edges(page)).toHaveCount(1)
    const final = await page
      .locator('.react-flow__edge path[stroke="transparent"]')
      .getAttribute('d')
    const finalPoints = final?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    expect(finalPoints).toHaveLength(points.length)
    for (let i = 0; i < points.length; i++) expect(finalPoints[i]).toBeCloseTo(points[i], 3)
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

/** Smallest screen distance from a point to the visible edge stroke. */
async function cursorGap(
  page: import('@playwright/test').Page,
  cx: number,
  cy: number,
): Promise<number> {
  return page.evaluate(
    ({ cx, cy }) => {
      const paths = [...document.querySelectorAll('.react-flow__edge path')]
      const v = paths.find((p) => p.getAttribute('stroke') !== 'transparent')
      if (!(v instanceof SVGPathElement)) throw new Error('visible edge path not found')
      const ctm = v.getScreenCTM()
      if (!ctm) throw new Error('edge path has no screen CTM')
      const len = v.getTotalLength()
      let best = Infinity
      for (let i = 0; i <= 60; i++) {
        const pt = v.getPointAtLength((len * i) / 60)
        const s = new DOMPoint(pt.x, pt.y).matrixTransform(ctm)
        best = Math.min(best, Math.hypot(s.x - cx, s.y - cy))
      }
      return best
    },
    { cx, cy },
  )
}

/**
 * The canvas viewport animates briefly after load (fitView settling); pixel
 * gap assertions wait it out so they measure the drag, not the animation.
 */
async function waitForViewportSettled(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const read = () =>
          document.querySelector('.react-flow__viewport')?.getAttribute('style') ?? ''
        const first = read()
        setTimeout(() => resolve(read() === first), 300)
      }),
    undefined,
    { timeout: 8000 },
  )
}

test('clicking an edge selects it without moving the curve', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await waitForViewportSettled(page)

  const point = await strokePoint(page, 0.27)
  await page.mouse.move(point.x, point.y)
  const hit = page.locator('.react-flow__edge path').first()
  const before = await hit.getAttribute('d')
  await page.mouse.down()
  await expect(hit).toHaveAttribute('d', before ?? '')
  await page.mouse.up()
  await expect(page.getByTestId('edge-current-relation')).toBeVisible()
  await expect(hit).toHaveAttribute('d', before ?? '')
})

test('dragging an off-center arc point tracks the pointer and preserves a chosen attachment', async ({
  page,
}) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await selectEdge(page)
  await waitForViewportSettled(page)

  const before = await quadSide(page)
  expect(before).not.toBe(0)

  // Shift along AND across the chord: a signed bow offset cannot follow both.
  const start = await strokePoint(page, 0.27)
  const sourceBefore = await strokePoint(page, 0)
  const targetBefore = await strokePoint(page, 1)
  const mid = await chordMid(page)
  const end = {
    x: mid.x + (mid.x - start.x) * 0.6 + 28,
    y: mid.y + (mid.y - start.y) * 1.2,
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()

  const after = await quadSide(page)
  expect(Math.sign(after)).toBe(-Math.sign(before))
  // No snap on release: the local preview stays where the cursor left it.
  await page.waitForTimeout(400)
  expect(await cursorGap(page, end.x, end.y)).toBeLessThan(4)
  const sourceAfter = await strokePoint(page, 0)
  const targetAfter = await strokePoint(page, 1)
  expect(
    Math.hypot(sourceAfter.x - sourceBefore.x, sourceAfter.y - sourceBefore.y),
  ).toBeGreaterThan(1)
  expect(Math.hypot(targetAfter.x - targetBefore.x, targetAfter.y - targetBefore.y)).toBeLessThan(1) // creation placed the target explicitly on its border

  // The reshaped curve must survive a reload, not just the local state.
  await waitForCurveAnchorSaved(page)
  await page.reload()
  await expect(page.locator('.react-flow__pane')).toBeVisible()
  await expect(edges(page)).toHaveCount(1)
  await waitForViewportSettled(page)
  expect(Math.sign(await quadSide(page))).toBe(Math.sign(after))
})

test('double-clicking the arc resets the default bow', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await selectEdge(page)
  await waitForViewportSettled(page)

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

  // Let the release glide (160ms) land so the click point below is fresh.
  await page.waitForTimeout(300)
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
  await waitForViewportSettled(page)
  // Reconnect dots show on hover only (like the concept side handles).
  const hoverAt = await strokePoint(page, 0.5)
  await page.mouse.move(hoverAt.x, hoverAt.y)

  const dot = page.locator('[data-testid^="reconnect-target-"]')
  await expect(dot).toBeVisible()
  const box = await dot.boundingBox()
  if (!box) throw new Error('reconnect dot has no bounding box')
  const gamma = await nodeByText(page, 'Gamma').boundingBox()
  if (!gamma) throw new Error('Gamma node has no bounding box')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const originalPath = await page
    .locator('.react-flow__edge path[stroke="transparent"]')
    .getAttribute('d')
  await page.mouse.down()
  const pressedPath = await page
    .locator('.react-flow__edge path[stroke="var(--accent)"]')
    .getAttribute('d')
  const numbers = (path: string | null) => path?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const originalPoints = numbers(originalPath)
  const pressedPoints = numbers(pressedPath)
  expect(pressedPoints).toHaveLength(originalPoints.length)
  for (let i = 0; i < originalPoints.length; i++)
    expect(pressedPoints[i]).toBeCloseTo(originalPoints[i], 3)
  await page.mouse.move(gamma.x + gamma.width / 2, gamma.y + gamma.height / 2, { steps: 12 })

  // Mid-drag, before release: Gamma shows the dotted destination border
  // (same as creating an arc) and the dashed preview keeps the edge's bow.
  const gammaNode = nodeByText(page, 'Gamma')
  await expect(gammaNode.locator('div[style*="dotted"]')).toBeVisible()
  const preview = await page.evaluate(() => {
    const paths = [...document.querySelectorAll('.react-flow__edge path')]
    return paths.map((p) => p.getAttribute('d')).join(' | ')
  })
  expect(preview).toMatch(/Q/)
  await page.mouse.up()

  await expect(edges(page)).toHaveCount(1)
  await selectEdge(page)
  const inspector = page.locator('[data-chrome]').filter({
    has: page.getByTestId('edge-current-relation'),
  })
  await expect(inspector).toHaveText(/Alpha.*subtype of.*Gamma/)
})

for (const side of ['source', 'target'] as const) {
  test(`reconnect ${side} preview lands exactly on the final arc`, async ({ page }) => {
    await gotoApp(page)
    await newEmptyGraph(page)
    await seedTwoConcepts(page)
    await createConceptAt(page, 0.45, 0.75, 'Gamma')
    await connectAlphaBeta(page)
    await waitForViewportSettled(page)

    // First reshape the arc locally; the preview must follow that shape too.
    const grab = await strokePoint(page, 0.27)
    await page.mouse.move(grab.x, grab.y)
    await page.mouse.down()
    await page.mouse.move(grab.x + 24, grab.y - 38, { steps: 8 })
    await page.mouse.up()

    const mid = await strokePoint(page, 0.5)
    await page.mouse.move(mid.x, mid.y)
    const original = await page
      .locator('.react-flow__edge path[stroke="transparent"]')
      .getAttribute('d')
    const dot = page.locator(`[data-testid^="reconnect-${side}-"]`)
    await expect(dot).toBeVisible()
    const box = await dot.boundingBox()
    const gamma = await nodeByText(page, 'Gamma').boundingBox()
    if (!box || !gamma) throw new Error('reconnect target not measured')
    // The centered node handle can overlap the endpoint dot; grab the
    // outward part of its 22px hit area, as a user can on the canvas.
    await page.mouse.move(
      side === 'target' ? box.x + 3 : box.x + box.width - 3,
      box.y + box.height / 2,
    )
    await page.mouse.down()
    const pressPreview = await page
      .locator('.react-flow__edge path[stroke="var(--accent)"]')
      .getAttribute('d')
    const numbers = (path: string | null) => path?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    const originalPoints = numbers(original)
    const pressedPoints = numbers(pressPreview)
    expect(pressedPoints).toHaveLength(originalPoints.length)
    for (let i = 0; i < originalPoints.length; i++)
      expect(pressedPoints[i]).toBeCloseTo(originalPoints[i], 3)
    // Hiding the dot at drag start must be immediate; only hover changes may
    // use the visual opacity transition.
    await expect(dot.locator('xpath=..')).toHaveCSS('transition-duration', '0s')
    await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 4 })
    await expect(dot.locator('xpath=..')).toHaveCSS('opacity', '0')
    await page.mouse.move(gamma.x + gamma.width / 2, gamma.y + gamma.height / 2, { steps: 12 })

    await expect(
      page.locator(`[data-testid^="reconnect-${side === 'source' ? 'target' : 'source'}-"]`),
    ).toHaveCount(0)

    const previewPath = page.locator('.react-flow__edge path[stroke="var(--accent)"]')
    const endpoint = side === 'source' ? 0 : 4
    await page.mouse.move(gamma.x + gamma.width * 0.35, gamma.y + 5)
    const left = numbers(await previewPath.getAttribute('d'))
    await page.mouse.move(gamma.x + gamma.width * 0.65, gamma.y + 5)
    const right = numbers(await previewPath.getAttribute('d'))
    expect(right[endpoint] - left[endpoint]).toBeGreaterThan(5)

    const preview = await page
      .locator('.react-flow__edge path[stroke="var(--accent)"]')
      .getAttribute('d')
    expect(preview).toMatch(/ Q /)
    const previewPoints = numbers(preview)
    expect(Number(await dot.getAttribute('cx'))).toBeCloseTo(previewPoints[endpoint], 3)
    expect(Number(await dot.getAttribute('cy'))).toBeCloseTo(previewPoints[endpoint + 1], 3)
    await expect(dot.locator('xpath=..')).toHaveCSS('opacity', '0')
    await page.mouse.up()
    const final = await page
      .locator('.react-flow__edge path[stroke="transparent"]')
      .getAttribute('d')
    const before = numbers(preview)
    const after = numbers(final)
    const old = numbers(original)
    // An auto-placed fixed end follows the reshaped arc; an explicitly
    // attached end (created at the cursor) stays at its chosen border point.
    const fixed = side === 'target' ? 0 : 4
    const fixedDelta = Math.hypot(before[fixed] - old[fixed], before[fixed + 1] - old[fixed + 1])
    if (side === 'source') expect(fixedDelta).toBeLessThan(1)
    else expect(fixedDelta).toBeGreaterThan(2)
    const center = (points: number[]) => ({
      x: (points[0] + 2 * points[2] + points[4]) / 4,
      y: (points[1] + 2 * points[3] + points[5]) / 4,
    })
    const oldCenter = center(old)
    const newCenter = center(before)
    expect(Math.hypot(newCenter.x - oldCenter.x, newCenter.y - oldCenter.y)).toBeGreaterThan(5)
    expect(after).toHaveLength(before.length)
    for (let i = 0; i < before.length; i++) expect(after[i]).toBeCloseTo(before[i], 3)
  })
}
