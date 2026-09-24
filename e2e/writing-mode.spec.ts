// SPDX-License-Identifier: MIT
import { expect, test, type Locator } from '@playwright/test'
import { createConceptAt, gotoApp, nodeByText, nodes } from './helpers'

test('inspector shows the empty notes placeholder before the editor receives focus', async ({
  page,
}) => {
  await gotoApp(page)
  await expect(nodes(page).first()).toBeVisible()
  await createConceptAt(page, 0.3, 0.5, 'Empty notes')

  const editor = page.getByTestId('inspector-notes-inline').locator('.ProseMirror')
  const placeholder = editor.locator('p.is-editor-empty[data-placeholder]')
  await expect(editor).not.toBeFocused()
  await expect(placeholder).toHaveAttribute('data-placeholder', 'Elaborate on this concept…')
  await expect(editor).not.toBeFocused()
})

test('inline notes clip at a max height, scroll vertically, and never show Show more', async ({
  page,
}) => {
  await gotoApp(page)
  await expect(nodes(page).first()).toBeVisible()
  await createConceptAt(page, 0.3, 0.5, 'Scrollable notes')
  const inline = page.getByTestId('inspector-notes-inline')
  const editor = inline.locator('.ProseMirror')

  // Short notes: nothing to scroll, no expansion control.
  await editor.fill('Short note')
  expect(await inline.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true)
  await expect(page.getByTestId('inspector-notes-toggle')).toHaveCount(0)

  // Long notes: clipped at the max height and scrollable in place.
  await editor.fill(Array.from({ length: 16 }, (_, i) => `Paragraph ${i + 1}`).join('\n'))
  await expect(page.getByTestId('inspector-notes-toggle')).toHaveCount(0)
  const clipped = await inline.evaluate((el) => ({
    overflows: el.scrollHeight > el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
  }))
  expect(clipped.overflows).toBe(true)
  expect(clipped.overflowY).toBe('auto')
})

test('a heading at the start of a note has no extra top margin in inspector or dialog', async ({
  page,
}) => {
  await gotoApp(page)
  await expect(nodes(page).first()).toBeVisible()
  await createConceptAt(page, 0.3, 0.5, 'Heading note')

  const inline = page.getByTestId('inspector-notes-inline').locator('.ProseMirror')
  await inline.click()
  await page.keyboard.type('## My heading')
  const inlineHeading = inline.locator(':scope > h2')
  await expect(inlineHeading).toHaveText('My heading')
  await expect(inlineHeading).toHaveCSS('margin-top', '0px')

  await page.getByTestId('inspector-notes-write').click()
  const dialogHeading = page.getByTestId('writing-mode').locator('.ProseMirror > h2')
  await expect(dialogHeading).toHaveText('My heading')
  await expect(dialogHeading).toHaveCSS('margin-top', '0px')
})

test('empty note shows its hint again after clearing all text, in inspector and dialog', async ({
  page,
}) => {
  await gotoApp(page)
  await expect(nodes(page).first()).toBeVisible()
  await createConceptAt(page, 0.3, 0.5, 'Clearable note')
  const hintVisible = async (editor: Locator) => {
    const hint = editor.locator('p.is-editor-empty[data-placeholder]')
    await expect(hint).toHaveCount(1)
    expect(await hint.evaluate((el) => getComputedStyle(el, '::before').content)).toContain(
      'Elaborate on this concept…',
    )
  }

  // Clear inside the inline editor, then blur with Escape and expect the hint back.
  const inline = page.getByTestId('inspector-notes-inline').locator('.ProseMirror')
  await inline.click()
  await page.keyboard.type('Soon gone')
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Escape')
  await hintVisible(inline)

  // Clear inside the dialog too: typing then deleting must not lose the hint.
  await page.getByTestId('inspector-notes-write').click()
  const dialog = page.getByTestId('writing-mode').locator('.ProseMirror')
  await expect(dialog).toBeFocused()
  await page.keyboard.type('Also gone')
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.press('Backspace')
  await page.getByTestId('writing-mode-title').click()
  await hintVisible(dialog)
})

test('writing mode: open from inspector, write, insert quote via /, close, persists across reload', async ({
  page,
}) => {
  await gotoApp(page)
  // The seed graph loads asynchronously and can remount the React Flow pane;
  // wait for it to settle so the canvas is stable before creating a concept.
  await expect(nodes(page).first()).toBeVisible()
  await createConceptAt(page, 0.3, 0.5, 'Alpha')

  // Open Writing Mode from the Inspector's inline notes section.
  await nodeByText(page, 'Alpha').click()
  await expect(page.getByTestId('inspector-notes-write')).toBeVisible()
  await expect(page.getByTestId('inspector-notes-preview')).toHaveCount(0)
  await page.getByTestId('inspector-notes-write').click()
  await expect(page.getByTestId('writing-mode')).toBeVisible()
  // The content column opens with an H1 of the node name as context.
  await expect(page.getByTestId('writing-mode-title')).toHaveText('Alpha')
  // The TipTap editor mounts and autofocuses asynchronously after the overlay;
  // wait for focus so the first keystroke lands in the document.
  await expect(page.locator('.writing-editor .ProseMirror')).toBeFocused()

  // Write, then insert the Quote snippet through the slash menu.
  await page.keyboard.type('First thought ')
  await page.keyboard.type('/')
  await page.getByTestId('slash-item-blockquote').click()
  // The menu click refocuses the editor asynchronously; wait for focus so the
  // first keystroke of the snippet body is not swallowed.
  await expect(page.locator('.writing-editor .ProseMirror')).toBeFocused()
  await page.keyboard.type('Key quote')
  // `toggleBlockquote` wraps the current paragraph, so the quote holds the line.
  await expect(page.locator('.writing-editor .ProseMirror blockquote')).toContainText('Key quote')

  // WritingMode closes on Escape via a capture-phase window listener that
  // decides before ProseMirror can consume the key, so it works while the
  // editor is focused. The pending edit flushes on unmount and the deferred
  // save (a macrotask after the flush) persists it — give it time to hit
  // IndexedDB before reloading.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('writing-mode')).toHaveCount(0)
  await page.waitForTimeout(1000)

  // Reload → notes persist through the existing autosave path. Verify by
  // reopening Writing Mode and reading the text and quote inside the editor.
  await page.reload()
  await expect(page.locator('.react-flow__pane')).toBeVisible()
  await nodeByText(page, 'Alpha').click()
  await expect(page.getByTestId('inspector-notes-write')).toBeVisible()
  await page.getByTestId('inspector-notes-write').click()
  await expect(page.getByTestId('writing-mode')).toBeVisible()
  await expect(page.getByTestId('writing-mode-title')).toHaveText('Alpha')
  await expect(page.locator('.writing-editor .ProseMirror')).toContainText('First thought')
  await expect(page.locator('.writing-editor .ProseMirror blockquote')).toContainText('Key quote')
})
