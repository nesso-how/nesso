// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import {
  connectAlphaBeta,
  edges,
  gotoApp,
  newEmptyGraph,
  nodes,
  seedTwoConcepts,
  selectEdge,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
})

test('create two concepts and connect them with a relation', async ({ page }) => {
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)
  await expect(edges(page)).toHaveCount(1)
})

test('change an edge relation type from the inspector', async ({ page }) => {
  await seedTwoConcepts(page)
  await connectAlphaBeta(page, 'subtype-of')

  await selectEdge(page)
  const current = page.getByTestId('edge-current-relation')
  await expect(current).toHaveText('subtype of')

  // Pick a sibling relation in the same (taxonomic) category from the inspector.
  await page.getByRole('button', { name: 'instance of', exact: true }).click()
  await expect(current).toHaveText('instance of')
})

test('delete an edge with the keyboard, keeping its nodes', async ({ page }) => {
  await seedTwoConcepts(page)
  await connectAlphaBeta(page)

  await selectEdge(page)
  await page.keyboard.press('Delete')
  await expect(edges(page)).toHaveCount(0)
  await expect(nodes(page)).toHaveCount(2)
})
