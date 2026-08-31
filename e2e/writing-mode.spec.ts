// SPDX-License-Identifier: MIT
import { expect, test } from '@playwright/test'
import { createConceptAt, gotoApp, nodeByText, nodes } from './helpers'

test('writing mode: open from inspector, write, insert callout via /, close, persists across reload', async ({
  page,
}) => {
  await gotoApp(page)
  // The seed graph loads asynchronously and can remount the React Flow pane;
  // wait for it to settle so the canvas is stable before creating a concept.
  await expect(nodes(page).first()).toBeVisible()
  await createConceptAt(page, 0.3, 0.5, 'Alpha')

  // Open Writing Mode from the Inspector NOTES section.
  await nodeByText(page, 'Alpha').click()
  await expect(page.getByTestId('inspector-notes-write')).toBeVisible()
  await expect(page.getByTestId('inspector-notes-preview')).toContainText(/No notes yet/i)
  await page.getByTestId('inspector-notes-write').click()
  await expect(page.getByTestId('writing-mode')).toBeVisible()
  // The TipTap editor mounts asynchronously after the overlay; wait for the
  // editable surface before typing so keystrokes land in the document.
  await expect(page.locator('.writing-editor .ProseMirror')).toBeVisible()

  // Write, then insert the Callout snippet through the slash menu.
  await page.keyboard.type('First thought ')
  await page.keyboard.type('/')
  await page.getByTestId('slash-item-callout').click()
  // The menu click refocuses the editor asynchronously; wait for focus so the
  // first keystroke of the snippet body is not swallowed.
  await expect(page.locator('.writing-editor .ProseMirror')).toBeFocused()
  await page.keyboard.type('Key takeaway')
  // `setCallout` wraps the current paragraph, so the callout holds the line.
  await expect(page.locator('.writing-callout')).toContainText('Key takeaway')

  // WritingMode closes on Escape via a capture-phase window listener that
  // decides before ProseMirror can consume the key, so it works while the
  // editor is focused. The pending edit flushes on unmount and the deferred
  // save (a macrotask after the flush) persists it — give it time to hit
  // IndexedDB before reloading.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('writing-mode')).toHaveCount(0)
  await expect(page.getByTestId('inspector-notes-preview')).toContainText('Key takeaway')
  await page.waitForTimeout(1000)

  // Reload → notes persist through the existing autosave path.
  await page.reload()
  await expect(page.locator('.react-flow__pane')).toBeVisible()
  await nodeByText(page, 'Alpha').click()
  await expect(page.getByTestId('inspector-notes-preview')).toContainText('Key takeaway')
  await expect(page.getByTestId('inspector-notes-write')).toBeVisible()
})
