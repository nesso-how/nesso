// SPDX-License-Identifier: MIT

export type ShortcutAction =
  | 'close-modals'
  | 'toggle-shortcuts'
  | 'toggle-settings'
  | 'toggle-search'
  | 'undo'
  | 'redo'
  | 'delete-selection'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'select-all'
  | 'edit-selected-node'
  | 'open-review'
  | 'add-concept'
  | 'fit-view'
  | 'block'

export interface ShortcutContext {
  /** A modal/overlay is open: canvas edit + navigation shortcuts are suppressed. */
  anyModalOpen: boolean
  /** The current selection is a concept node (drives Enter-to-edit). */
  hasSelectedNode: boolean
}

/** Structural subset of `KeyboardEvent` that the resolver reads. */
export interface ShortcutKey {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export interface ResolvedShortcut {
  action: ShortcutAction
  preventDefault: boolean
}

/**
 * Map a keydown to a canvas action. Pure: the caller guards editable targets,
 * applies `preventDefault`, and dispatches the returned action against the store.
 * Returns null when the key is not a shortcut (or is suppressed by a modal).
 */
export function resolveShortcut(e: ShortcutKey, ctx: ShortcutContext): ResolvedShortcut | null {
  const mod = e.metaKey || e.ctrlKey
  if (e.key === 'Escape') return { action: 'close-modals', preventDefault: false }
  if (e.key === '?') return { action: 'toggle-shortcuts', preventDefault: false }
  if (e.key === ',' && mod) return { action: 'toggle-settings', preventDefault: true }
  if (e.key === 'k' && mod) return { action: 'toggle-search', preventDefault: true }
  // Everything below edits or navigates the canvas — never while a modal is open
  // (e.g. Backspace during a review must not delete the selection).
  if (ctx.anyModalOpen) return null
  if (e.key === 'z' && mod && !e.shiftKey) return { action: 'undo', preventDefault: true }
  if (e.key === 'z' && mod && e.shiftKey) return { action: 'redo', preventDefault: true }
  if (e.key === 'Delete' || e.key === 'Backspace')
    return { action: 'delete-selection', preventDefault: true }
  if (e.key === 'c' && mod) return { action: 'copy', preventDefault: true }
  if (e.key === 'x' && mod) return { action: 'cut', preventDefault: true }
  if (e.key === 'v' && mod) return { action: 'paste', preventDefault: true }
  if (e.key === 'd' && mod) return { action: 'duplicate', preventDefault: true }
  if (e.key === 'a' && mod) return { action: 'select-all', preventDefault: true }
  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey)
    return ctx.hasSelectedNode ? { action: 'edit-selected-node', preventDefault: true } : null
  if (e.key === 'r' && !e.metaKey && !e.ctrlKey)
    return { action: 'open-review', preventDefault: false }
  if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey)
    return { action: 'add-concept', preventDefault: false }
  if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey)
    return { action: 'fit-view', preventDefault: false }
  if (e.key === '/') return { action: 'block', preventDefault: true }
  return null
}
