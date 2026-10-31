import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { cn } from 'cn'
import { Annotation, Compartment, EditorState, Transaction } from '@codemirror/state'
import { EditorView, ViewPlugin, keymap } from '@codemirror/view'
import { defaultKeymap, history as editorHistory, historyKeymap } from '@codemirror/commands'
import {
  continueMarkdownList,
  indentMarkdownList,
  markdownDecorations,
  toggleMarkdownFormat,
} from './markdown'

type MarkdownInputProps = Omit<ComponentProps<'div'>, 'onChange' | 'children' | 'defaultValue'> & {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  history?: boolean
  onOpenLink?: (url: string) => void
}

const externalChange = Annotation.define<boolean>()
const livePreview = ViewPlugin.define(
  (view) => ({
    decorations: markdownDecorations(view.state, view.hasFocus && !view.state.readOnly),
    update(update) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.focusChanged ||
        update.startState.readOnly !== update.state.readOnly
      )
        this.decorations = markdownDecorations(
          update.state,
          update.view.hasFocus && !update.state.readOnly,
        )
    },
  }),
  { decorations: (plugin) => plugin.decorations },
)

export function MarkdownInput({
  value,
  onChange,
  readOnly = false,
  history = true,
  onOpenLink,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: MarkdownInputProps) {
  const container = useRef<HTMLDivElement>(null)
  const editor = useRef<EditorView | null>(null)
  const callbacks = useRef({ onChange, onOpenLink })
  const [configuration] = useState(() => new Compartment())
  const [initialValue] = useState(value)

  useLayoutEffect(() => {
    callbacks.current = { onChange, onOpenLink }
  }, [onChange, onOpenLink])

  useLayoutEffect(() => {
    const view = new EditorView({
      parent: container.current!,
      doc: initialValue,
      extensions: [
        EditorView.lineWrapping,
        EditorView.theme({
          '&.cm-focused': { outline: 'none' },
          '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit', overflow: 'visible' },
          '.cm-content, .cm-line': { padding: '0' },
          '.cm-line.nesso-markdown-list-item': {
            paddingInlineStart: 'var(--nesso-list-padding)',
            textIndent: 'calc(-1 * var(--nesso-list-padding))',
          },
        }),
        livePreview,
        configuration.of([]),
        keymap.of([
          ...(['Tab', 'Shift-Tab'] as const).map((key) => ({
            key,
            run: (view: EditorView) => {
              const transaction = indentMarkdownList(view.state, key === 'Shift-Tab')
              if (!transaction) return false
              view.dispatch({ ...transaction, scrollIntoView: true })
              return true
            },
          })),
          {
            key: 'Enter',
            run: (view) => {
              const transaction = continueMarkdownList(view.state)
              if (!transaction) return false
              view.dispatch({ ...transaction, scrollIntoView: true })
              return true
            },
          },
          ...(['**', '*'] as const).map((marker) => ({
            key: marker === '**' ? 'Mod-b' : 'Mod-i',
            run: (view: EditorView) => {
              const transaction = toggleMarkdownFormat(view.state, marker)
              if (!transaction) return false
              view.dispatch(transaction)
              return true
            },
          })),
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !update.transactions.some((t) => t.annotation(externalChange)))
            callbacks.current.onChange(update.state.doc.toString())
        }),
        EditorView.domEventHandlers({
          click(event, view) {
            const link = (event.target as Element).closest('[data-markdown-link]')
            const url = link?.getAttribute('data-markdown-link')
            if (!url || !(event.metaKey || event.ctrlKey || view.state.readOnly)) return false
            event.preventDefault()
            callbacks.current.onOpenLink?.(url)
            return true
          },
        }),
      ],
    })
    editor.current = view
    return () => {
      editor.current = null
      view.destroy()
    }
  }, [configuration, initialValue])

  useLayoutEffect(() => {
    editor.current?.dispatch({
      effects: configuration.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({
          ...(id ? { id } : {}),
          ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
          ...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {}),
          'aria-multiline': 'true',
          'aria-readonly': String(readOnly),
          spellcheck: 'true',
        }),
        ...(history ? [editorHistory(), keymap.of(historyKeymap)] : []),
      ]),
    })
  }, [configuration, readOnly, history, id, ariaLabel, ariaLabelledBy])

  useLayoutEffect(() => {
    const view = editor.current
    if (!view || value === view.state.doc.toString()) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: [externalChange.of(true), Transaction.addToHistory.of(false)],
    })
  }, [value])

  return (
    <div
      {...props}
      ref={container}
      className={cn(
        'nesso-input nesso-markdown-input min-h-24 w-full overflow-y-auto border border-input bg-background px-2.5 py-2 focus-within:border-muted-foreground',
        className,
      )}
    />
  )
}
