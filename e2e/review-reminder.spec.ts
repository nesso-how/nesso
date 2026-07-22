// SPDX-License-Identifier: MIT
import { expect, test } from '@playwright/test'
import {
  createConceptAt,
  gotoApp,
  makeCurrentGraphConceptStudiedAndDue,
  newEmptyGraph,
} from './helpers'

async function seedEligibleGraph(page: Parameters<typeof gotoApp>[0]) {
  await gotoApp(page)
  await newEmptyGraph(page)
  await createConceptAt(page, 0.45, 0.45, 'Studied concept')
  await page.waitForTimeout(700)
  await makeCurrentGraphConceptStudiedAndDue(page)
}

function reviewReminder(page: Parameters<typeof gotoApp>[0]) {
  return page.getByRole('alert').filter({ hasText: /concept you have studied/i })
}

test('shows for a studied due concept and starts the unfiltered Review UI', async ({ page }) => {
  await seedEligibleGraph(page)
  const banner = reviewReminder(page)
  await expect(banner).toContainText('1 concept you have studied is ready for review.')
  await banner.getByRole('button', { name: 'Start review' }).click()
  await expect(banner).toBeHidden()
  await expect(page.getByText('Recall its relations before revealing.')).toBeVisible()
})

test('close suppresses the reminder after reload on the same local day', async ({ page }) => {
  await seedEligibleGraph(page)
  const banner = reviewReminder(page)
  await banner.getByRole('button', { name: '✕' }).click()
  await expect(banner).toBeHidden()
  await page.reload()
  await expect(page.locator('.react-flow__pane')).toBeVisible()
  await expect(page.getByText(/concept you have studied.*ready for review/i)).toHaveCount(0)
})

test('the setting disables reminders without disabling Review mode', async ({ page }) => {
  await gotoApp(page)
  await page.keyboard.press('ControlOrMeta+,')
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Learning' }).click()
  const row = dialog.getByText('Review reminder', { exact: true }).locator('..').locator('..')
  await row.getByRole('switch').click()
  await dialog.getByRole('button', { name: '✕' }).click()
  await newEmptyGraph(page)
  await createConceptAt(page, 0.45, 0.45, 'Studied concept')
  await page.waitForTimeout(700)
  await makeCurrentGraphConceptStudiedAndDue(page)
  await expect(page.getByText(/concept you have studied.*ready for review/i)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Review/ })).toBeVisible()
})
