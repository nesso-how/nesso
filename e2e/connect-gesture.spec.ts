// SPDX-License-Identifier: MIT
import { expect, test, type Page } from '@playwright/test'
import {
  connectAlphaBeta,
  createConceptAt,
  deselect,
  gotoApp,
  newEmptyGraph,
  nodeByText,
  edges,
  seedTwoConcepts,
  strokePoint,
} from './helpers'

/** Empty-canvas point (top-center) used to hold a drag without a destination. */
async function emptyPoint(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('.react-flow__pane').boundingBox()
  if (!box) throw new Error('canvas pane has no bounding box')
  return { x: box.width * 0.5, y: box.height * 0.15 }
}

async function handleCenter(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await nodeByText(page, name).locator('.nesso-node-handle').boundingBox()
  if (!box) throw new Error('source handle has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function nodeCenter(page: Page, name: string): Promise<{ x: number; y: number }> {
  const box = await nodeByText(page, name).boundingBox()
  if (!box) throw new Error('concept has no bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('starting a connection drag deselects the selected concept', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await createConceptAt(page, 0.45, 0.75, 'Gamma')

  await nodeByText(page, 'Gamma').click()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)

  // Drag from Alpha toward empty canvas and hold: only the drag start could
  // have cleared the selection, nothing new could have been selected.
  const start = await handleCenter(page, 'Alpha')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  const hold = await emptyPoint(page)
  await page.mouse.move(hold.x, hold.y, { steps: 6 })
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await page.mouse.up()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
})

test('the destination highlight is the selection ring, in creation and reconnect', async ({
  page,
}) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await createConceptAt(page, 0.45, 0.75, 'Gamma')
  await connectAlphaBeta(page)

  // Creation: hold over Beta. It shows the shared dashed ring; the old
  // dotted destination style is gone everywhere.
  const start = await handleCenter(page, 'Alpha')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  const beta = await nodeCenter(page, 'Beta')
  await page.mouse.move(beta.x, beta.y, { steps: 8 })
  const betaNode = nodeByText(page, 'Beta')
  await expect(betaNode.locator('div[style*="dashed"]')).toBeVisible()
  await expect(page.locator('div[style*="dotted"]')).toHaveCount(0)
  await page.mouse.up()
  await page.getByTestId('relation-chip-subtype-of').click()
  await expect(edges(page)).toHaveCount(2)

  // Reconnect: drag the target dot onto Gamma and hold. Same shared ring.
  await deselect(page)
  const hoverAt = await strokePoint(page, 0.5)
  await page.mouse.move(hoverAt.x, hoverAt.y)
  const dot = page.locator('[data-testid^="reconnect-target-"]')
  await expect(dot).toBeVisible()
  const dotBox = await dot.boundingBox()
  if (!dotBox) throw new Error('reconnect dot has no bounding box')
  await page.mouse.move(dotBox.x + dotBox.width / 2, dotBox.y + dotBox.height / 2)
  await page.mouse.down()
  const gamma = await nodeCenter(page, 'Gamma')
  await page.mouse.move(gamma.x, gamma.y, { steps: 8 })
  const gammaNode = nodeByText(page, 'Gamma')
  await expect(gammaNode.locator('div[style*="dashed"]')).toBeVisible()
  await expect(page.locator('div[style*="dotted"]')).toHaveCount(0)
  await page.mouse.up()
})

test('starting a reconnect drag deselects the selected concept', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)
  await createConceptAt(page, 0.45, 0.75, 'Gamma')
  await connectAlphaBeta(page)

  await nodeByText(page, 'Gamma').click()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)

  // Drag the target dot toward empty canvas and hold: the in-flight gesture
  // cleared the selection, and dropping nowhere commits nothing.
  const hoverAt = await strokePoint(page, 0.5)
  await page.mouse.move(hoverAt.x, hoverAt.y)
  const dot = page.locator('[data-testid^="reconnect-target-"]')
  await expect(dot).toBeVisible()
  const dotBox = await dot.boundingBox()
  if (!dotBox) throw new Error('reconnect dot has no bounding box')
  await page.mouse.move(dotBox.x + dotBox.width / 2, dotBox.y + dotBox.height / 2)
  await page.mouse.down()
  const hold = await emptyPoint(page)
  await page.mouse.move(hold.x, hold.y, { steps: 6 })
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await page.mouse.up()
  await expect(edges(page)).toHaveCount(1)
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
})
