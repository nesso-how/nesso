import { useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { cn } from 'cn'
import { Annotation, Compartment, EditorState, Transaction } from '@codemirror/state'
import { EditorView, ViewPlugin, keymap, placeholder as editorPlaceholder } from '@codemirror/view'
import { defaultKeymap, history as editorHistory, historyKeymap, redo } from '@codemirror/commands'
import {
  continueMarkdownList,
  indentMarkdownList,
  markdownDecorations,
  markdownTasks,
  toggleMarkdownFormat,
  toggleMarkdownTask,
} from './markdown'

type MarkdownInputProps = Omit<ComponentProps<'div'>, 'onChange' | 'children' | 'defaultValue'> & {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  history?: boolean | 'focus'
  tasks?: boolean
  onOpenLink?: (url: string) => void
  placeholder?: string
}

const externalChange = Annotation.define<boolean>()
const resetHistory = (view: EditorView, compartment: Compartment) => {
  view.dispatch({ effects: compartment.reconfigure([]) })
  view.dispatch({ effects: compartment.reconfigure(editorHistory()) })
}
const livePreview = ViewPlugin.define(
  (view) => ({
    decorations: markdownDecorations(view.state, view.hasFocus && !view.state.readOnly),
    update(update) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.focusChanged ||
        update.startState.readOnly !== update.state.readOnly ||
        update.startState.facet(markdownTasks) !== update.state.facet(markdownTasks)
      )
        this.decorations = markdownDecorations(
          update.state,
          update.view.hasFocus && !update.state.readOnly,
        )
    },
  }),
  { decorations: (plugin) => plugin.decorations },
)
const taskCheckboxes = EditorView.domEventHandlers({
  mousedown(event, view) {
    const task = (event.target as Element).closest('.nesso-markdown-task')
    if (!task) return false
    event.preventDefault()
    const transaction = toggleMarkdownTask(view.state, view.posAtDOM(task))
    if (transaction) view.dispatch(transaction)
    return true
  },
  click(event) {
    if (!(event.target as Element).closest('.nesso-markdown-task')) return false
    event.preventDefault()
    return true
  },
})

export function MarkdownInput({
  value,
  onChange,
  readOnly = false,
  history = true,
  tasks,
  onOpenLink,
  placeholder,
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
  const [historyState] = useState(() => new Compartment())
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
            textIndent: 'calc(-1 * var(--nesso-list-indent))',
          },
        }),
        livePreview,
        taskCheckboxes,
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
        markdownTasks.of(tasks),
        EditorView.contentAttributes.of({
          ...(id ? { id } : {}),
          ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
          ...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {}),
          'aria-multiline': 'true',
          'aria-readonly': String(readOnly),
          spellcheck: 'true',
        }),
        ...(history
          ? [
              historyState.of(editorHistory()),
              keymap.of([
                ...historyKeymap,
                { key: 'Mod-Shift-z', run: redo, preventDefault: true },
              ]),
            ]
          : []),
        ...(history === 'focus'
          ? [
              EditorView.domEventHandlers({
                blur(_event, view) {
                  resetHistory(view, historyState)
                },
              }),
            ]
          : []),
        ...(placeholder ? [editorPlaceholder(placeholder)] : []),
      ]),
    })
  }, [
    configuration,
    historyState,
    readOnly,
    history,
    tasks,
    id,
    ariaLabel,
    ariaLabelledBy,
    placeholder,
  ])

  useLayoutEffect(() => {
    const view = editor.current
    if (!view || value === view.state.doc.toString()) return
    if (history === 'focus') resetHistory(view, historyState)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: [externalChange.of(true), Transaction.addToHistory.of(false)],
    })
  }, [value, history, historyState])

  return (
    <div
      {...props}
      ref={container}
      data-local-history={history ? '' : undefined}
      className={cn(
        'nesso-input nesso-markdown-input nesso-scroll min-h-24 w-full overflow-y-auto border border-input bg-background px-2.5 py-2 focus-within:border-muted-foreground',
        className,
      )}
    />
  )
}
