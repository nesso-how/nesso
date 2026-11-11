import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type ComponentProps,
  type RefObject,
} from 'react'
import { defaultLocale } from '@nesso-how/i18n'
import type { Position } from '@nesso-how/schema'
import type { HostStore } from '../store/types.ts'
import { notifications } from '../notifications/index.ts'
import { useNessoStore } from '../store/index.ts'
import { translate } from '../i18n/index.ts'
import {
  copyGraph,
  deleteOperations,
  deletionNeedsConfirmation,
  graphSelection,
  pasteOperations,
  selectionCoversGraph,
} from './commands.ts'

export const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')

export function useGraphInteractions(
  store: HostStore,
  {
    readOnly,
    preview,
    onDeleteView,
    onConfirmDelete,
    focusRef,
  }: {
    readOnly: boolean
    preview: boolean
    onDeleteView?: () => void
    onConfirmDelete?: () => void
    focusRef: RefObject<HTMLElement | null>
  },
) {
  const epoch = useNessoStore((state) => state.documentEpoch, store)
  const canvas = useRef<HTMLDivElement>(null)
  const clipboardEpoch = useRef(0)
  const pasted = useRef({ epoch, text: '', count: 0 })
  const cutText = useRef({ epoch, text: '' })
  useLayoutEffect(
    () => () => {
      clipboardEpoch.current++
    },
    [readOnly],
  )
  const focus = () => focusRef.current?.focus()
  const notify = (key: 'pasteFailed' | 'commandFailed' | 'clipboardUnavailable') =>
    notifications.api.notify({
      tone: 'warning',
      title: translate(store.getState().preferences.locale ?? defaultLocale)(key),
    })
  const canCut = () => {
    const { selected, graph } = store.getState()
    return (
      selected.length > 0 &&
      selected.filter(({ kind }) => kind === 'concept').length < graph.concepts.length
    )
  }
  const remove = () => {
    const state = store.getState()
    if (deletionNeedsConfirmation(state)) onConfirmDelete?.()
    else store.applyOperations(deleteOperations(state))
  }
  const selectAll = useCallback(() => {
    const { viewGraph } = store.getState()
    store.setSelection(graphSelection(viewGraph))
  }, [store])
  useEffect(() => {
    if (readOnly) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey)
      )
        return
      if (event.key.toLowerCase() !== 'a') return
      if (document.querySelector('[data-data-transfer][data-open]')) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      if (isEditableTarget(event.target)) return
      event.preventDefault()
      selectAll()
      focusRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly, store, focusRef, selectAll])
  const commands = {
    deleteSelection: () => {
      if (readOnly) return
      const { selected, viewGraph } = store.getState()
      if (selectionCoversGraph(selected, viewGraph)) onDeleteView?.()
      else if (canCut()) remove()
    },
    copy: async (cut = false, event?: ClipboardEvent<HTMLDivElement>) => {
      if (cut && (readOnly || !canCut())) return
      if (
        event &&
        (event.defaultPrevented ||
          isEditableTarget(event.target) ||
          window.getSelection()?.isCollapsed === false)
      )
        return
      const before = store.getState()
      const element = canvas.current
      const version = clipboardEpoch.current
      const text = copyGraph(before.viewGraph, before.selected)
      if (!text) return
      try {
        if (event) {
          event.preventDefault()
          event.clipboardData.setData('text/plain', text)
        } else await navigator.clipboard.writeText(text)
      } catch {
        if (canvas.current === element && clipboardEpoch.current === version)
          notify('clipboardUnavailable')
        return
      }
      if (
        canvas.current !== element ||
        clipboardEpoch.current !== version ||
        store.getState() !== before
      )
        return
      if (cut) {
        cutText.current = { epoch, text }
        remove()
      }
      focus()
    },
    paste: async (text?: string, position?: Position) => {
      if (readOnly) return
      const before = store.getState()
      const element = canvas.current
      const version = clipboardEpoch.current
      if (text === undefined) {
        try {
          text = await navigator.clipboard.readText()
        } catch {
          if (canvas.current === element && clipboardEpoch.current === version)
            notify('clipboardUnavailable')
          return
        }
      }
      if (
        canvas.current !== element ||
        clipboardEpoch.current !== version ||
        store.getState() !== before
      )
        return
      const count =
        pasted.current.epoch === epoch && pasted.current.text === text
          ? pasted.current.count + 1
          : 1
      let operations: ReturnType<typeof pasteOperations>
      try {
        operations = pasteOperations(
          text,
          position,
          count * 40,
          before.workspace.activeViewId !== null,
          cutText.current.epoch === epoch && cutText.current.text === text
            ? { graph: before.graph, viewId: before.workspace.activeViewId }
            : undefined,
        )
      } catch {
        notify('pasteFailed')
        return
      }
      try {
        store.applyOperations(operations)
      } catch {
        notify('commandFailed')
        return
      }
      pasted.current = { epoch, text, count }
      focus()
    },
  }
  return {
    epoch,
    commands,
    surfaceProps: {
      ref: canvas,
      onKeyDown: (event) => {
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          event.altKey ||
          event.shiftKey ||
          isEditableTarget(event.target)
        )
          return
        if (document.querySelector('[data-data-transfer][data-open]')) return
        if (event.metaKey || event.ctrlKey) {
          if (!readOnly && event.key === 'Enter') {
            event.preventDefault()
            if (event.repeat) return
            try {
              store.addConcept()
            } catch {
              notify('commandFailed')
              return
            }
            focus()
          }
        } else if (event.key === 'Escape' && (!readOnly || preview)) {
          event.preventDefault()
          store.setSelection([])
        } else if (!readOnly && (event.key === 'Delete' || event.key === 'Backspace')) {
          event.preventDefault()
          commands.deleteSelection()
        }
      },
      onCopy: (event) => {
        void commands.copy(false, event)
      },
      onCut: (event) => {
        void commands.copy(true, event)
      },
      onPaste: (event) => {
        if (event.defaultPrevented || isEditableTarget(event.target) || readOnly) return
        event.preventDefault()
        void commands.paste(event.clipboardData.getData('text/plain'))
      },
    } satisfies ComponentProps<'div'>,
  }
}
