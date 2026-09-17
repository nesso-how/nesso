// SPDX-License-Identifier: MIT
import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useGraphStore } from '@/store'
import { focusFlowNodes } from '@/lib/focusFlowSelection'
import { resolveShortcut, isTextControlFocused } from '@/lib/shortcuts'

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
    const onKey = (e: KeyboardEvent) => {
      if (isTextControlFocused()) return
      const resolved = resolveShortcut(e, {
        anyModalOpen,
        hasSelectedNode: useGraphStore.getState().selected?.kind === 'node',
      })
      if (!resolved) return
      if (resolved.preventDefault) e.preventDefault()
      switch (resolved.action) {
        case 'close-modals':
          setShowReview(false)
          setShowShortcuts(false)
          setShowSettings(false)
          setShowRelationTypes(false)
          setShowSearch(false)
          setShowAbout(false)
          break
        case 'toggle-shortcuts':
          setShowShortcuts((s) => !s)
          break
        case 'toggle-settings':
          setShowSettings((s) => !s)
          break
        case 'toggle-search':
          setShowSearch((s) => !s)
          break
        case 'undo':
          undo()
          break
        case 'redo':
          redo()
          break
        case 'delete-selection':
          deleteSelection()
          break
        case 'copy':
          copySelection()
          break
        case 'cut':
          cutSelection()
          break
        case 'paste': {
          const ids = pasteSelection()
          if (ids?.length) focusFlowNodes(ids)
          break
        }
        case 'duplicate': {
          const ids = duplicateSelection()
          if (ids?.length) focusFlowNodes(ids)
          break
        }
        case 'select-all':
          selectAll()
          break
        case 'edit-selected-node': {
          const sel = useGraphStore.getState().selected
          if (sel?.kind === 'node') requestEditNode(sel.id)
          break
        }
        case 'open-review':
          if (useGraphStore.getState().settings.reviewEnabled) openReview()
          break
        case 'add-concept':
          handleAddConcept()
          break
        case 'fit-view':
          fitView()
          break
        case 'block':
          break
      }
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
