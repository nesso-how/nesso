// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import {
  connectAlphaBeta,
  createConceptAt,
  deselect,
  dragConnect,
  edges,
  gotoApp,
  newEmptyGraph,
  nodeByText,
  seedTwoConcepts,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
})

test('uses solid category-coloured strokes in non-minimal modes and grey in minimal', async ({
  page,
}) => {
  await seedTwoConcepts(page)
  await connectAlphaBeta(page, 'similar-to')

  const edge = edges(page).first()

  for (const encoding of ['Full', 'Cat.']) {
    await page.getByRole('button', { name: encoding, exact: true }).click()

    await expect(edge.locator('path[stroke-dasharray]')).toHaveCount(0)
    await expect(edge.locator('circle')).toHaveCount(0)
    await expect(edge.locator('path').nth(1)).toHaveAttribute('stroke', 'var(--cat-similarity)')
  }

  await page.getByRole('button', { name: 'Min.', exact: true }).click()

  await expect(edge.locator('path[stroke-dasharray]')).toHaveCount(0)
  await expect(edge.locator('circle')).toHaveCount(0)
  await expect(edge.locator('path').nth(1)).toHaveAttribute('stroke', 'var(--ink-3)')
})

test('selecting a concept dims unconnected edges and keeps connected ones at default', async ({
  page,
}) => {
  await seedTwoConcepts(page)
  await createConceptAt(page, 0.45, 0.75, 'Gamma')
  await connectAlphaBeta(page, 'subtype-of')

  await deselect(page)
  await dragConnect(page, nodeByText(page, 'Beta'), nodeByText(page, 'Gamma'))
  await page.getByTestId('relation-chip-subtype-of').click()
  await expect(edges(page)).toHaveCount(2)

  await nodeByText(page, 'Alpha').click()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)

  // Creation order is preserved: Alpha→Beta first, Beta→Gamma second.
  // The selected concept's own edges keep their default look; only the rest
  // of the map dims.
  const connected = edges(page).first()
  const unrelated = edges(page).nth(1)
  await expect(connected.locator('path').nth(1)).toHaveAttribute('stroke-width', '1.4')
  await expect(connected.locator('path').nth(1)).toHaveAttribute('opacity', '0.78')
  await expect(unrelated.locator('path').nth(1)).toHaveAttribute('stroke-width', '1.4')
  await expect(unrelated.locator('path').nth(1)).toHaveAttribute('opacity', '0.28')

  await deselect(page)
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await expect(connected.locator('path').nth(1)).toHaveAttribute('opacity', '0.78')
  await expect(unrelated.locator('path').nth(1)).toHaveAttribute('opacity', '0.78')

  // Per-map toggle off: selecting no longer dims anything.
  const dimSwitch = page
    .locator('div')
    .filter({ hasText: /^Focus$/ })
    .getByRole('switch')
  await dimSwitch.click()
  await expect(dimSwitch).toHaveAttribute('aria-checked', 'false')

  await nodeByText(page, 'Alpha').click()
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(1)
  await expect(connected.locator('path').nth(1)).toHaveAttribute('opacity', '0.78')
  await expect(unrelated.locator('path').nth(1)).toHaveAttribute('opacity', '0.78')

  await dimSwitch.click()
  await expect(dimSwitch).toHaveAttribute('aria-checked', 'true')
})

test('relation types dialog previews solid strokes without badges', async ({ page }) => {
  await page.getByTestId('graph-io-menu').click()

  const menu = page.getByRole('menu')
  await menu.getByRole('button', { name: 'Relation types', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('svg path[stroke-dasharray]')).toHaveCount(0)
  await expect(dialog.locator('svg[width="36"] > path')).toHaveCount(52)
  await expect(dialog.locator('svg[width="36"] > circle')).toHaveCount(0)
})
