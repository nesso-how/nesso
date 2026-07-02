// SPDX-License-Identifier: MIT
/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { resolveShortcut, isTextControlFocused, type ShortcutKey } from './shortcuts'

const key = (over: Partial<ShortcutKey> & { key: string }): ShortcutKey => ({
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
})

const NO_MODAL = { anyModalOpen: false, hasSelectedNode: false }

describe('resolveShortcut', () => {
  it('closes modals on Escape without preventing default', () => {
    expect(resolveShortcut(key({ key: 'Escape' }), NO_MODAL)).toEqual({
      action: 'close-modals',
      preventDefault: false,
    })
  })

  it('toggles settings/search on Cmd or Ctrl and prevents default', () => {
    expect(resolveShortcut(key({ key: ',', metaKey: true }), NO_MODAL)).toEqual({
      action: 'toggle-settings',
      preventDefault: true,
    })
    expect(resolveShortcut(key({ key: ',', ctrlKey: true }), NO_MODAL)?.action).toBe(
      'toggle-settings',
    )
    expect(resolveShortcut(key({ key: 'k', metaKey: true }), NO_MODAL)?.action).toBe(
      'toggle-search',
    )
  })

  it('requires a modifier for comma and k', () => {
    expect(resolveShortcut(key({ key: ',' }), NO_MODAL)).toBeNull()
    expect(resolveShortcut(key({ key: 'k' }), NO_MODAL)).toBeNull()
  })

  it('distinguishes undo from redo by shift', () => {
    expect(resolveShortcut(key({ key: 'z', metaKey: true }), NO_MODAL)?.action).toBe('undo')
    expect(
      resolveShortcut(key({ key: 'z', metaKey: true, shiftKey: true }), NO_MODAL)?.action,
    ).toBe('redo')
  })

  it('deletes the selection on Delete and Backspace', () => {
    expect(resolveShortcut(key({ key: 'Delete' }), NO_MODAL)?.action).toBe('delete-selection')
    expect(resolveShortcut(key({ key: 'Backspace' }), NO_MODAL)?.action).toBe('delete-selection')
  })

  it('maps the clipboard shortcuts', () => {
    expect(resolveShortcut(key({ key: 'c', metaKey: true }), NO_MODAL)?.action).toBe('copy')
    expect(resolveShortcut(key({ key: 'x', metaKey: true }), NO_MODAL)?.action).toBe('cut')
    expect(resolveShortcut(key({ key: 'v', metaKey: true }), NO_MODAL)?.action).toBe('paste')
    expect(resolveShortcut(key({ key: 'd', metaKey: true }), NO_MODAL)?.action).toBe('duplicate')
    expect(resolveShortcut(key({ key: 'a', metaKey: true }), NO_MODAL)?.action).toBe('select-all')
  })

  it('suppresses canvas shortcuts while a modal is open but keeps Escape and Cmd-K', () => {
    const MODAL = { anyModalOpen: true, hasSelectedNode: true }
    expect(resolveShortcut(key({ key: 'Backspace' }), MODAL)).toBeNull()
    expect(resolveShortcut(key({ key: 'z', metaKey: true }), MODAL)).toBeNull()
    expect(resolveShortcut(key({ key: 'r' }), MODAL)).toBeNull()
    expect(resolveShortcut(key({ key: 'Escape' }), MODAL)?.action).toBe('close-modals')
    expect(resolveShortcut(key({ key: 'k', metaKey: true }), MODAL)?.action).toBe('toggle-search')
  })

  it('edits the selected node on Enter only when a node is selected', () => {
    expect(
      resolveShortcut(key({ key: 'Enter' }), { anyModalOpen: false, hasSelectedNode: true }),
    ).toEqual({ action: 'edit-selected-node', preventDefault: true })
    expect(resolveShortcut(key({ key: 'Enter' }), NO_MODAL)).toBeNull()
  })

  it('maps bare navigation keys and is case-insensitive for n and f', () => {
    expect(resolveShortcut(key({ key: 'r' }), NO_MODAL)?.action).toBe('open-review')
    expect(resolveShortcut(key({ key: 'N' }), NO_MODAL)?.action).toBe('add-concept')
    expect(resolveShortcut(key({ key: 'F' }), NO_MODAL)?.action).toBe('fit-view')
  })

  it('blocks the browser quick-find on slash', () => {
    expect(resolveShortcut(key({ key: '/' }), NO_MODAL)).toEqual({
      action: 'block',
      preventDefault: true,
    })
  })

  it('returns null for unmapped keys', () => {
    expect(resolveShortcut(key({ key: 'q' }), NO_MODAL)).toBeNull()
  })
})

describe('isTextControlFocused', () => {
  it('is true for focused input and textarea elements', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    expect(isTextControlFocused()).toBe(true)
    input.remove()
  })

  it('is true for readonly inputs', () => {
    const input = document.createElement('input')
    input.readOnly = true
    document.body.appendChild(input)
    input.focus()
    expect(isTextControlFocused()).toBe(true)
    input.remove()
  })

  it('is false when focus is on the document body', () => {
    document.body.focus()
    expect(isTextControlFocused()).toBe(false)
  })
})
