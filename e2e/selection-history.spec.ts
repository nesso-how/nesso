// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import {
  connectAlphaBeta,
  deselect,
  edges,
  gotoApp,
  newEmptyGraph,
  nodeByText,
  nodes,
  seedTwoConcepts,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
})

test('undo and redo an edge creation', async ({ page }) => {
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await expect(edges(page)).toHaveCount(1)

  await deselect(page)
  await page.keyboard.press('ControlOrMeta+z')
  await expect(edges(page)).toHaveCount(0)
  await expect(nodes(page)).toHaveCount(2)

  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(edges(page)).toHaveCount(1)
})

test('multi-select two concepts and delete the selection', async ({ page }) => {
  await seedTwoConcepts(page)

  await nodeByText(page, 'Alpha').click()
  await nodeByText(page, 'Beta').click({ modifiers: ['ControlOrMeta'] })
  // Selection syncs to the store via requestAnimationFrame; wait for both nodes
  // to register as selected before deleting, else Delete sees a stale selection.
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2)
  await page.waitForTimeout(100)
  await page.keyboard.press('Delete')

  await expect(nodes(page)).toHaveCount(0)
})
