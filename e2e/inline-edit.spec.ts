// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test'
import { createConceptAt, gotoApp, newEmptyGraph, nodeByText } from './helpers'

test.beforeEach(async ({ page }) => {
  await gotoApp(page)
  await newEmptyGraph(page)
})

test('multiline definition field grows without ResizeObserver errors', async ({ page }) => {
  // Collect page errors to assert no ResizeObserver loop warnings
  const errors: string[] = []
  page.on('pageerror', (err) => {
    errors.push(err.message)
  })

  // Create a concept node on the canvas
  await createConceptAt(page, 0.4, 0.5, 'Test Concept')

  // Click the node to open the inspector
  await nodeByText(page, 'Test Concept').click()

  // The definition field uses InlineEdit with borderedPlaceholder={true}.
  // When empty, it renders a dashed-border <div> containing the placeholder
  // text "In your own words…" (English locale).
  // Find the placeholder directly by its text — it only appears in the
  // definition field inside the inspector.
  const defPlaceholder = page.getByText('In your own words…')
  await expect(defPlaceholder).toBeVisible()

  // Click the placeholder to start editing. Since multiline={true} and
  // noEditBorder={true}, a <textarea> replaces the placeholder div directly.
  await defPlaceholder.click()

  // The textarea should now appear (the only one visible at this point)
  const textarea = page.locator('textarea')
  await expect(textarea).toBeVisible()

  // Record initial height before typing to assert multiline auto-grow
  const initialBox = await textarea.boundingBox()
  expect(initialBox).toBeTruthy()
  const initialHeight = initialBox!.height
  expect(initialHeight).toBeGreaterThan(0)

  // Use fill() to set initial text (dispatches input events React can capture).
  // The narrow inspector panel (~270px) forces wrapping past a single line.
  await textarea.fill(
    'This is a long definition that should wrap across multiple lines and test the auto-grow behavior',
  )

  // Shift+Enter inserts a literal newline (Enter alone commits via the onSave
  // handler; onShiftEnter is undefined for the definition field, so Shift+Enter
  // falls through both guard branches and the textarea gains a newline).
  await textarea.press('Shift+Enter')
  await textarea.type('Another line of text to ensure multiple wraps occur')
  await textarea.press('Shift+Enter')
  await textarea.type('Third line to exercise the observer further')

  // Assert the textarea grew in height as multiline content was added
  const grownBox = await textarea.boundingBox()
  expect(grownBox).toBeTruthy()
  expect(grownBox!.height).toBeGreaterThan(initialHeight)

  // Commit the edit by pressing Enter (without Shift)
  await textarea.press('Enter')

  // After commit, the textarea should disappear
  await expect(textarea).not.toBeVisible()

  // Verify the display shows the multiline text.
  // The display div renders with whiteSpace: pre-wrap, preserving newlines.
  await expect(page.getByText('Third line to exercise')).toBeVisible()
  await expect(page.getByText('This is a long definition')).toBeVisible()

  // Verify no ResizeObserver loop errors were emitted
  const resizeLoopErrors = errors.filter((e) => e.includes('ResizeObserver'))
  expect(resizeLoopErrors).toHaveLength(0)
})
