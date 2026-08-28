// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { createConceptAt, gotoApp, newEmptyGraph, nodeByText, nodes } from './helpers'

interface VercelHeaderConfig {
  headers?: Array<{
    source?: string
    headers?: Array<{ key?: string; value?: string }>
  }>
}

interface BlockedExportResource {
  blockedURI: string
  effectiveDirective: string
}

function parseCspDirectives(policy: string): Map<string, Set<string>> {
  const directives = new Map<string, Set<string>>()
  for (const directive of policy.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/)
    if (!name) continue
    directives.set(name.toLowerCase(), new Set(sources))
  }
  return directives
}

async function installProductionCsp(page: Page): Promise<string> {
  const config = JSON.parse(
    await readFile(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8'),
  ) as VercelHeaderConfig
  const csp = config.headers
    ?.find((route) => route.source === '/(.*)')
    ?.headers?.find((header) => header.key === 'Content-Security-Policy')?.value
  if (!csp) throw new Error('vercel.json has no catch-all Content-Security-Policy header')

  // Vite's development React-refresh preamble is inline and is intentionally
  // blocked by the production script policy. Supply its no-op hooks so the
  // dev server can boot and this test can reach the PNG rendering path.
  await page.addInitScript(() => {
    const win = window as typeof window & {
      $RefreshReg$: () => void
      $RefreshSig$: () => <T>(type: T) => T
      __vite_plugin_react_preamble_installed__: boolean
    }
    win.$RefreshReg$ = () => {}
    win.$RefreshSig$ = () => (type) => type
    win.__vite_plugin_react_preamble_installed__ = true
  })
  await page.addInitScript(() => {
    const blockedExportResources: Array<{
      blockedURI: string
      effectiveDirective: string
    }> = []
    document.addEventListener('securitypolicyviolation', (event) => {
      // Chromium redacts blocked `data:` URLs to the literal "data" in
      // blockedURI, so filter on the effective directive instead.
      if (event.effectiveDirective === 'img-src' || event.effectiveDirective === 'font-src') {
        blockedExportResources.push({
          blockedURI: event.blockedURI,
          effectiveDirective: event.effectiveDirective,
        })
      }
    })
    Object.defineProperty(window, '__nessoExportCspViolations', {
      configurable: true,
      value: blockedExportResources,
    })
  })

  await page.route('http://localhost:5173/', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': csp,
      },
    })
  })
  return csp
}

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

test('export the current graph as PNG under the production CSP', async ({ page }) => {
  const csp = await installProductionCsp(page)

  await gotoApp(page)
  await newEmptyGraph(page)
  await createConceptAt(page, 0.45, 0.5, 'ExportedPngConcept')

  await page.getByTestId('graph-io-menu').click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5_000 }),
    page.getByRole('button', { name: 'Export graph (.png)', exact: true }).click(),
  ])

  const cspDirectives = parseCspDirectives(csp)
  expect(cspDirectives.get('img-src')).toEqual(new Set(["'self'", 'data:', 'blob:']))
  expect(cspDirectives.get('font-src')).toEqual(
    new Set(["'self'", 'data:', 'https://fonts.gstatic.com']),
  )
  expect(download.suggestedFilename()).toMatch(/\.png$/)
  expect(await download.failure()).toBeNull()
  const png = await readFile(await download.path())
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const blockedExportResources = await page.evaluate(() => {
    const win = window as typeof window & {
      __nessoExportCspViolations?: BlockedExportResource[]
    }
    return win.__nessoExportCspViolations ?? []
  })
  expect(blockedExportResources).toEqual([])
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
