// SPDX-License-Identifier: MIT
import { expect, test, type Page } from '@playwright/test'
import { connectAlphaBeta, gotoApp, newEmptyGraph, seedTwoConcepts } from './helpers'

/** Right-click the single edge at its midpoint to open the context menu. */
async function openEdgeContextMenu(page: Page) {
  const point = await page.evaluate(() => {
    const hit = document.querySelector('.react-flow__edge path')
    if (!(hit instanceof SVGPathElement)) throw new Error('edge hit path not found')
    const mid = hit.getPointAtLength(hit.getTotalLength() / 2)
    const ctm = hit.getScreenCTM()
    if (!ctm) throw new Error('edge hit path has no screen CTM')
    const screen = new DOMPoint(mid.x, mid.y).matrixTransform(ctm)
    return { x: screen.x, y: screen.y }
  })
  await page.mouse.click(point.x, point.y, { button: 'right' })
}

for (const [relationId, directed] of [
  ['subtype-of', true],
  ['similar-to', false],
] as const) {
  test(`edge context menu ${directed ? 'offers' : 'hides'} Flip direction for ${relationId}`, async ({
    page,
  }) => {
    await gotoApp(page)
    await newEmptyGraph(page)
    await seedTwoConcepts(page)
    await connectAlphaBeta(page, relationId)

    await openEdgeContextMenu(page)
    // Menu rows carry visible text; the inspector toolbar buttons have only a
    // title attribute, so hasText isolates the context menu.
    await expect(page.locator('button', { hasText: 'Delete' })).toBeVisible()
    await expect(page.locator('button', { hasText: 'Flip direction' })).toHaveCount(
      directed ? 1 : 0,
    )
  })
}
