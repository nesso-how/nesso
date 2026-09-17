// SPDX-License-Identifier: MIT
import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useGraphStore } from '@/store'
import { focusFlowNodes } from '@/lib/focusFlowSelection'
import { resolveShortcut, isTextControlFocused } from '@/lib/shortcuts'
import type { ResolvedShortcut, ShortcutAction } from '@/lib/shortcuts'

type SetBoolean = Dispatch<SetStateAction<boolean>>

/** Everything the keyboard-shortcuts effect closes over (moved verbatim from App). */
export interface KeyboardShortcutOptions {
  anyModalOpen: boolean
  undo: () => void
  redo: () => void
  copySelection: () => void
  cutSelection: () => void
  pasteSelection: (at?: { x: number; y: number }) => string[] | null
  duplicateSelection: () => string[] | null
  selectAll: () => void
  deleteSelection: () => void
  requestEditNode: (id: string) => void
  handleAddConcept: () => void
  openReview: () => void
  fitView: () => void
  setShowReview: SetBoolean
  setShowShortcuts: SetBoolean
  setShowSettings: SetBoolean
  setShowRelationTypes: SetBoolean
  setShowSearch: SetBoolean
  setShowAbout: SetBoolean
}

/**
 * Resolve a keydown to a shortcut action, or null when shortcuts are
 * suppressed (text control focused) or the key is unbound. Pure read of the
 * resolver plus the current selection — no side effects.
 */
function resolveKeyAction(e: KeyboardEvent, anyModalOpen: boolean): ResolvedShortcut | null {
  if (isTextControlFocused()) return null
  return resolveShortcut(e, {
    anyModalOpen,
    hasSelectedNode: useGraphStore.getState().selected?.kind === 'node',
  })
}

/**
 * Global keyboard shortcuts: resolves each keydown via `resolveShortcut` and
 * dispatches it to store actions, modal setters, and canvas helpers. Skipped
 * while a text control has focus.
 */
export function useKeyboardShortcuts({
  anyModalOpen,
  undo,
  redo,
  copySelection,
  cutSelection,
  pasteSelection,
  duplicateSelection,
  selectAll,
  deleteSelection,
  requestEditNode,
  handleAddConcept,
  openReview,
  fitView,
  setShowReview,
  setShowShortcuts,
  setShowSettings,
  setShowRelationTypes,
  setShowSearch,
  setShowAbout,
}: KeyboardShortcutOptions): void {
  useEffect(() => {
    // Per-action dispatch table: keeps each branch independently small
    // instead of one large switch body. `Record<ShortcutAction, …>` makes an
    // unhandled action a compile error rather than a silent no-op.
    const handlers: Record<ShortcutAction, () => void> = {
      'close-modals': () => {
        setShowReview(false)
        setShowShortcuts(false)
        setShowSettings(false)
        setShowRelationTypes(false)
        setShowSearch(false)
        setShowAbout(false)
      },
      'toggle-shortcuts': () => setShowShortcuts((s) => !s),
      'toggle-settings': () => setShowSettings((s) => !s),
      'toggle-search': () => setShowSearch((s) => !s),
      undo: () => undo(),
      redo: () => redo(),
      'delete-selection': () => deleteSelection(),
      copy: () => copySelection(),
      cut: () => cutSelection(),
      paste: () => {
        const ids = pasteSelection()
        if (ids?.length) focusFlowNodes(ids)
      },
      duplicate: () => {
        const ids = duplicateSelection()
        if (ids?.length) focusFlowNodes(ids)
      },
      'select-all': () => selectAll(),
      'edit-selected-node': () => {
        const sel = useGraphStore.getState().selected
        if (sel?.kind === 'node') requestEditNode(sel.id)
      },
      'open-review': () => {
        if (useGraphStore.getState().settings.reviewEnabled) openReview()
      },
      'add-concept': () => handleAddConcept(),
      'fit-view': () => fitView(),
      block: () => {},
    }
    const onKey = (e: KeyboardEvent) => {
      const resolved = resolveKeyAction(e, anyModalOpen)
      if (!resolved) return
      if (resolved.preventDefault) e.preventDefault()
      handlers[resolved.action]()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Note: the `setShow*` setters are listed for `useExhaustiveDependencies`
    // even though React guarantees `useState` dispatchers are referentially
    // stable — Biome cannot prove stability through hook params, and listing
    // them keeps this file warning-free without changing behavior.
  }, [
    undo,
    redo,
    copySelection,
    cutSelection,
    pasteSelection,
    duplicateSelection,
    selectAll,
    deleteSelection,
    requestEditNode,
    handleAddConcept,
    openReview,
    fitView,
    anyModalOpen,
    setShowReview,
    setShowShortcuts,
    setShowSettings,
    setShowRelationTypes,
    setShowSearch,
    setShowAbout,
  ])
}
