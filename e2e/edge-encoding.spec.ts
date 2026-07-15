// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import { connectAlphaBeta, edges, gotoApp, newEmptyGraph, seedTwoConcepts } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
})

test('uses solid paths while preserving glyph visibility in non-minimal modes', async ({
  page,
}) => {
  await seedTwoConcepts(page)
  await connectAlphaBeta(page, 'similar-to')

  const edge = edges(page).first()

  for (const encoding of ['Full', 'Cat.']) {
    await page.getByRole('button', { name: encoding, exact: true }).click()

    await expect(edge.locator('path[stroke-dasharray]')).toHaveCount(0)
    await expect(edge.locator('circle')).toHaveCount(1)
    await expect(edge.locator('path').nth(1)).toHaveAttribute('stroke', 'var(--cat-similarity)')
  }

  await page.getByRole('button', { name: 'Min.', exact: true }).click()

  await expect(edge.locator('path[stroke-dasharray]')).toHaveCount(0)
  await expect(edge.locator('circle')).toHaveCount(0)
})

test('relation types dialog previews solid strokes and glyphs', async ({ page }) => {
  await page.getByTestId('graph-io-menu').click()

  const menu = page.getByRole('menu')
  await menu.getByRole('button', { name: 'Relation types', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('svg path[stroke-dasharray]')).toHaveCount(0)
  await expect(dialog.locator('svg[width="36"] > circle')).toHaveCount(52)
})
