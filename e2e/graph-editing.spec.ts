// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import {
  connectAlphaBeta,
  deselect,
  dragConnect,
  edges,
  gotoApp,
  newEmptyGraph,
  nodeByText,
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

/**
 * Waits for a specific node's inline edit `<input>` to receive keyboard focus.
 * The focus is applied asynchronously (retried across animation frames) to
 * survive React StrictMode double-mount and React Flow viewport animations.
 */
async function waitForNodeInputFocus(node: import('@playwright/test').Locator) {
  await expect(node.locator('input')).toBeFocused()
}

test('new node gets keyboard focus after double-click on canvas', async ({ page }) => {
  const pane = page.locator('.react-flow__pane')
  const box = await pane.boundingBox()
  if (!box) throw new Error('pane has no bounding box')
  await pane.dblclick({ position: { x: box.width * 0.5, y: box.height * 0.5 } })

  const node = nodes(page).last()
  await expect(node).toBeVisible()

  await waitForNodeInputFocus(node)

  await page.keyboard.type('hello')
  await page.keyboard.press('Enter')

  await expect(page.locator('.react-flow__node', { hasText: 'hello' })).toBeVisible()
})

test('new node gets keyboard focus after N shortcut', async ({ page }) => {
  await page.keyboard.press('n')

  const node = nodes(page).last()
  await expect(node).toBeVisible()

  await waitForNodeInputFocus(node)

  await page.keyboard.type('hello')
  await page.keyboard.press('Enter')

  await expect(page.locator('.react-flow__node', { hasText: 'hello' })).toBeVisible()
})

test('new node gets keyboard focus after context menu "Add concept here"', async ({ page }) => {
  const pane = page.locator('.react-flow__pane')
  const box = await pane.boundingBox()
  if (!box) throw new Error('pane has no bounding box')
  await pane.click({ button: 'right', position: { x: box.width * 0.5, y: box.height * 0.5 } })

  await page.getByRole('button', { name: 'Add concept here' }).click()

  const node = nodes(page).last()
  await expect(node).toBeVisible()

  await waitForNodeInputFocus(node)

  await page.keyboard.type('context-hello')
  await page.keyboard.press('Enter')

  await expect(page.locator('.react-flow__node', { hasText: 'context-hello' })).toBeVisible()
})

test('focus works on the next creation after committing with Enter', async ({ page }) => {
  // First node via double-click
  const pane = page.locator('.react-flow__pane')
  const box = await pane.boundingBox()
  if (!box) throw new Error('pane has no bounding box')
  await pane.dblclick({ position: { x: box.width * 0.5, y: box.height * 0.5 } })

  const node1 = nodes(page).last()
  await expect(node1).toBeVisible()

  await waitForNodeInputFocus(node1)
  await page.keyboard.type('first')
  await page.keyboard.press('Enter')

  await expect(page.locator('.react-flow__node', { hasText: 'first' })).toBeVisible()

  // Second node via N shortcut — focus must land on this new node, not the old one
  await page.keyboard.press('n')

  const node2 = nodes(page).last()
  await expect(node2).toBeVisible()

  await waitForNodeInputFocus(node2)
  await page.keyboard.type('second')
  await page.keyboard.press('Enter')

  await expect(page.locator('.react-flow__node', { hasText: 'second' })).toBeVisible()
})

test('connects from the visible left handle and preserves drag direction', async ({ page }) => {
  await seedTwoConcepts(page)
  await deselect(page)

  await dragConnect(page, nodeByText(page, 'Alpha'), nodeByText(page, 'Beta'), 'left', 'right')

  const relationChip = page.getByTestId('relation-chip-subtype-of')
  await expect(edges(page)).toHaveCount(0)
  await expect(relationChip).toBeVisible()

  await relationChip.click()
  await expect(edges(page)).toHaveCount(1)

  await selectEdge(page)
  const inspector = page.locator('[data-chrome]').filter({
    has: page.getByTestId('edge-current-relation'),
  })
  await expect(inspector).toHaveText(/Alpha.*subtype of.*Beta/)
})

test('connects from the left handle and drops on node body using fallback', async ({ page }) => {
  await seedTwoConcepts(page)
  await deselect(page)

  // Drop on Beta's body, not on its handle — exercises onConnectEnd fallback.
  await dragConnect(
    page,
    nodeByText(page, 'Alpha'),
    nodeByText(page, 'Beta'),
    'left',
    // omit toSide — drops on node body, triggering onConnectEnd fallback
  )

  const relationChip = page.getByTestId('relation-chip-subtype-of')
  await expect(edges(page)).toHaveCount(0)
  await expect(relationChip).toBeVisible()

  await relationChip.click()
  await expect(edges(page)).toHaveCount(1)

  await selectEdge(page)
  const inspector = page.locator('[data-chrome]').filter({
    has: page.getByTestId('edge-current-relation'),
  })
  await expect(inspector).toHaveText(/Alpha.*subtype of.*Beta/)
})
