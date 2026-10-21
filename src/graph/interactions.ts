import { useLayoutEffect, useRef, type ClipboardEvent, type ComponentProps, type RefObject } from 'react'
import { defaultLocale } from '@nesso/i18n'
import { relationKey, type Position } from '@nesso/schema'
import type { HostStore } from '../store/types.ts'
import { notifications } from '../notifications/index.ts'
import { useNessoStore } from '../store/index.ts'
import { translate } from '../i18n/index.ts'
import { copyGraph, pasteOperations, selectionCoversGraph } from './commands.ts'

export const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')

export function useGraphInteractions(store: HostStore, { readOnly, preview, onDeleteView, focusRef }: { readOnly: boolean; preview: boolean; onDeleteView?: () => void; focusRef: RefObject<HTMLElement | null> }) {
  const epoch = useNessoStore((state) => state.documentEpoch, store)
  const canvas = useRef<HTMLDivElement>(null)
  const editable = useRef(!readOnly)
  const pasted = useRef({ epoch, text: '', count: 0 })
  useLayoutEffect(() => { editable.current = !readOnly }, [readOnly])
  const focus = () => focusRef.current?.focus()
  const notify = (key: 'pasteFailed' | 'commandFailed' | 'clipboardUnavailable') => notifications.api.notify({ tone: 'warning', title: translate(store.getState().preferences.locale ?? defaultLocale)(key) })
  const canCut = () => {
    const { selected, graph } = store.getState()
    return selected.length > 0 && selected.filter(({ kind }) => kind === 'concept').length < graph.concepts.length
  }
  const remove = () => store.applyOperations(store.getState().selected.map(({ kind, id }) => ({ kind: kind === 'concept' ? 'concept.remove' : 'relation.remove', id })))
  const selectAll = () => {
    const { viewGraph } = store.getState()
    store.setSelection([
      ...viewGraph.concepts.map(({ id }) => ({ kind: 'concept' as const, id })),
      ...viewGraph.relations.map((relation) => ({ kind: 'relation' as const, id: relationKey(relation) })),
    ])
  }
  const commands = {
    deleteSelection: () => {
      if (readOnly) return
      const { selected, viewGraph } = store.getState()
      if (selectionCoversGraph(selected, viewGraph)) onDeleteView?.()
      else if (canCut()) remove()
    },
    copy: async (cut = false, event?: ClipboardEvent<HTMLDivElement>) => {
      if (cut && (readOnly || !canCut())) return
      if (event && (event.defaultPrevented || isEditableTarget(event.target) || window.getSelection()?.isCollapsed === false)) return
      const before = store.getState()
      const element = canvas.current
      try {
        const text = copyGraph(before.graph, before.selected)
        if (!text) return
        if (event) {
          event.preventDefault()
          event.clipboardData.setData('text/plain', text)
        } else await navigator.clipboard.writeText(text)
      } catch {
        if (canvas.current === element) notify('clipboardUnavailable')
        return
      }
      if (canvas.current !== element || store.getState() !== before) return
      if (cut && editable.current) remove()
      focus()
    },
    paste: async (text?: string, position?: Position) => {
      if (readOnly) return
      const before = store.getState()
      const element = canvas.current
      if (text === undefined) {
        try { text = await navigator.clipboard.readText() }
        catch {
          if (canvas.current === element) notify('clipboardUnavailable')
          return
        }
      }
      if (canvas.current !== element || store.getState() !== before || !editable.current) return
      const count = pasted.current.epoch === epoch && pasted.current.text === text ? pasted.current.count + 1 : 1
      let operations: ReturnType<typeof pasteOperations>
      try { operations = pasteOperations(text, position, count * 40) }
      catch { notify('pasteFailed'); return }
      try { store.applyOperations(operations) }
      catch { notify('commandFailed'); return }
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
        if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.shiftKey || isEditableTarget(event.target)) return
        if (document.querySelector('[data-data-transfer][data-open]')) return
        if (event.metaKey || event.ctrlKey) {
          if (!readOnly && event.key.toLowerCase() === 'a') { event.preventDefault(); selectAll() }
        } else if (event.key === 'Escape' && (!readOnly || preview)) { event.preventDefault(); store.setSelection([]) }
        else if (!readOnly && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); commands.deleteSelection() }
      },
      onCopy: (event) => { void commands.copy(false, event) },
      onCut: (event) => { void commands.copy(true, event) },
      onPaste: (event) => {
        if (event.defaultPrevented || isEditableTarget(event.target) || readOnly) return
        event.preventDefault()
        void commands.paste(event.clipboardData.getData('text/plain'))
      },
    } satisfies ComponentProps<'div'>,
  }
}
