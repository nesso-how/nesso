// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { createConceptAt, gotoApp, newEmptyGraph, nodeByText, nodes } from './helpers'

async function createNamedGraph(
  page: import('@playwright/test').Page,
  name: string,
): Promise<void> {
  await page.getByTestId('sidebar-new-graph').click()
  // The new graph opens its sidebar row in inline rename, auto-focusing the input.
  const rename = page.locator('input:focus')
  await rename.waitFor({ state: 'visible' })
  await rename.fill(name)
  await rename.press('Enter')
  await expect(page.getByRole('button', { name })).toBeVisible()
}

test('create, switch and delete graphs from the sidebar', async ({ page }) => {
  await gotoApp(page)

  await createNamedGraph(page, 'Graph A')
  await createConceptAt(page, 0.4, 0.5, 'OnlyInA')
  // Let the debounced autosave persist Graph A before switching away from it.
  await page.waitForTimeout(700)

  await createNamedGraph(page, 'Graph B')
  await expect(nodes(page)).toHaveCount(0)

  // Switch back to A: its node returns. Then to B: empty again.
  await page.getByRole('button', { name: 'Graph A' }).click()
  await expect(nodeByText(page, 'OnlyInA')).toBeVisible()
  await expect(nodes(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'Graph B' }).click()
  await expect(nodes(page)).toHaveCount(0)

  // Delete A via its hover trash button + confirm dialog.
  await page.getByRole('button', { name: 'Graph A' }).hover()
  await page.getByRole('button', { name: 'Delete graph' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Graph A' })).toHaveCount(0)
})

test('export the current graph as JSON', async ({ page }) => {
  // Force the anchor-download fallback: Chromium exposes the File System Access
  // API (showSaveFilePicker), whose native picker Playwright cannot drive.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      writable: true,
      value: undefined,
    })
  })

  await gotoApp(page)
  await newEmptyGraph(page)
  await createConceptAt(page, 0.45, 0.5, 'ExportedConcept')

  await page.getByTestId('graph-io-menu').click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export graph', exact: true }).click(),
  ])

  const path = await download.path()
  const parsed = JSON.parse(await readFile(path, 'utf8')) as {
    concepts: { label?: string }[]
  }
  expect(parsed.concepts.some((c) => c.label === 'ExportedConcept')).toBe(true)
})

test('import a graph from a JSON file', async ({ page }) => {
  await gotoApp(page)

  await page.getByTestId('graph-io-menu').click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Import graph', exact: true }).click(),
  ])
  await chooser.setFiles(fileURLToPath(new URL('./fixtures/graph.json', import.meta.url)))

  await expect(nodeByText(page, 'Imported Alpha')).toBeVisible()
  await expect(nodeByText(page, 'Imported Beta')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imported Fixture' })).toBeVisible()
})
