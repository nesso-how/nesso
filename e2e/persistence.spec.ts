// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import { gotoApp, newEmptyGraph, nodeByText, nodes, seedTwoConcepts } from './helpers'

test('graph contents survive a page reload', async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
  await seedTwoConcepts(page)

  // Let the debounced autosave (500ms) flush to IndexedDB before reloading.
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.locator('.react-flow__pane')).toBeVisible()

  await expect(nodes(page)).toHaveCount(2)
  await expect(nodeByText(page, 'Alpha')).toBeVisible()
  await expect(nodeByText(page, 'Beta')).toBeVisible()
})
