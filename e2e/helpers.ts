// SPDX-License-Identifier: MIT
import { expect, type Locator, type Page } from '@playwright/test'

export function nodeByText(page: Page, text: string): Locator {
  return page.locator('.react-flow__node', { hasText: text })
}

export const edges = (page: Page): Locator => page.locator('.react-flow__edge')
export const nodes = (page: Page): Locator => page.locator('.react-flow__node')

export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.react-flow__pane')).toBeVisible()
}

/** Switch to a fresh empty graph (the demo seed loads by default) and dismiss the inline rename. */
export async function newEmptyGraph(page: Page): Promise<void> {
  await page.getByTestId('sidebar-new-graph').click()
  await expect(nodes(page)).toHaveCount(0)
  await page.keyboard.press('Escape')
}

/** The pane spans the whole window (sidebar/top bar overlay it); click an empty patch to deselect. */
export async function deselect(page: Page): Promise<void> {
  const pane = page.locator('.react-flow__pane')
  const box = await pane.boundingBox()
  if (!box) throw new Error('canvas pane has no bounding box')
  await pane.click({ position: { x: box.width * 0.45, y: box.height * 0.18 } })
}

export async function createConceptAt(
  page: Page,
  xRatio: number,
  yRatio: number,
  text: string,
): Promise<void> {
  const pane = page.locator('.react-flow__pane')
  const box = await pane.boundingBox()
  if (!box) throw new Error('canvas pane has no bounding box')
  await pane.dblclick({ position: { x: box.width * xRatio, y: box.height * yRatio } })

  const input = page.locator('.react-flow__node input')
  await input.waitFor({ state: 'visible' })
  await input.fill(text)
  await input.press('Enter')
  await expect(nodeByText(page, text)).toBeVisible()
}

/** Two concepts at stable positions, left of where the inspector docks. */
export async function seedTwoConcepts(page: Page): Promise<void> {
  await createConceptAt(page, 0.28, 0.5, 'Alpha')
  await createConceptAt(page, 0.62, 0.5, 'Beta')
  await expect(nodes(page)).toHaveCount(2)
}

export async function dragConnect(page: Page, from: Locator, to: Locator): Promise<void> {
  const handle = await from.locator('.react-flow__handle-right').boundingBox()
  const target = await to.boundingBox()
  if (!handle || !target) throw new Error('node handle or target has no bounding box')
  const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }
  const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 6, start.y + 6)
  await page.mouse.move(end.x, end.y, { steps: 12 })
  await page.mouse.up()
}

/** Connect Alpha → Beta and pick a relation type from the picker. */
export async function connectAlphaBeta(page: Page, relationId = 'subtype-of'): Promise<void> {
  await deselect(page)
  await dragConnect(page, nodeByText(page, 'Alpha'), nodeByText(page, 'Beta'))
  await page.getByTestId(`relation-chip-${relationId}`).click()
  await expect(edges(page)).toHaveCount(1)
}

/** Select the single edge by clicking its always-on glyph badge (pointer-events: all). */
export async function selectEdge(page: Page): Promise<void> {
  await page.locator('.react-flow__edge circle').first().click()
}
