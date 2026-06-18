// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import { gotoApp } from './helpers'

test('toggle dark mode applies the theme to the document', async ({ page }) => {
  await gotoApp(page)
  await page.keyboard.press('ControlOrMeta+,')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await dialog.getByRole('button', { name: 'Light', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
})

test('switching language re-renders the UI', async ({ page }) => {
  await gotoApp(page)
  await page.keyboard.press('ControlOrMeta+,')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Settings', { exact: true })).toBeVisible()

  await dialog.getByRole('button', { name: 'English' }).click()
  await dialog.getByRole('button', { name: 'Italiano' }).click()

  await expect(dialog.getByText('Impostazioni', { exact: true })).toBeVisible()
})
