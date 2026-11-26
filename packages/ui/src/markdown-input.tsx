import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from 'cn'
import { Annotation, Compartment, EditorState, Transaction } from '@codemirror/state'
import { EditorView, ViewPlugin, keymap, placeholder as editorPlaceholder } from '@codemirror/view'
import { defaultKeymap, history as editorHistory, historyKeymap, redo } from '@codemirror/commands'
import { Bold, Code, Italic, List, ListOrdered, ListTodo } from 'lucide-react'
import { Button } from './button'
import {
  activeMarkdownFormats,
  continueMarkdownList,
  indentMarkdownList,
  markdownDecorations,
  markdownTasks,
  toggleMarkdownFormat,
  toggleMarkdownList,
  toggleMarkdownTask,
} from './markdown'

const formattingActions = [
  { label: 'bold', format: '**', key: 'b', shift: false, Icon: Bold },
  { label: 'italic', format: '*', key: 'i', shift: false, Icon: Italic },
  { label: 'code', format: '`', key: 'e', shift: false, Icon: Code },
  { label: 'bullet', format: 'bullet', key: '8', shift: true, Icon: List },
  { label: 'numbered', format: 'numbered', key: '7', shift: true, Icon: ListOrdered },
  { label: 'task', format: 'task', key: '9', shift: true, Icon: ListTodo },
] as const

type Format = ReturnType<typeof activeMarkdownFormats>[number]
type ToolbarLabels = Record<'label' | (typeof formattingActions)[number]['label'], string>

type MarkdownInputProps = Omit<ComponentProps<'div'>, 'onChange' | 'children' | 'defaultValue'> & {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  history?: boolean | 'focus'
  tasks?: boolean
  onOpenLink?: (url: string) => void
  placeholder?: string
  toolbar?: ToolbarLabels
  compactToolbar?: boolean
  readOnlyToolbar?: boolean
  toolbarEnd?: ReactNode
}

function runFormat(view: EditorView, format: Format) {
  const transaction =
    format === '**' || format === '*' || format === '`'
      ? toggleMarkdownFormat(view.state, format)
      : toggleMarkdownList(view.state, format)
  if (!transaction) return false
  view.dispatch(transaction)
  return true
}

const formattingKeymap = keymap.of(
  formattingActions.map(({ format, key, shift }) => ({
    key: `Mod-${shift ? 'Shift-' : ''}${key}`,
    preventDefault: format === '**' || format === '*' || format === '`',
    run: (view: EditorView) => runFormat(view, format),
  })),
)

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
  toolbar,
  compactToolbar,
  readOnlyToolbar,
  toolbarEnd,
  className,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: MarkdownInputProps) {
  const container = useRef<HTMLDivElement>(null)
  const toolbarElement = useRef<HTMLDivElement>(null)
  const editor = useRef<EditorView | null>(null)
  const callbacks = useRef({ onChange, onOpenLink })
  const [configuration] = useState(() => new Compartment())
  const [historyState] = useState(() => new Compartment())
  const [initialValue] = useState(value)
  const [activeFormats, setActiveFormats] = useState<Format[]>([])
  const showToolbar = !!toolbar && (!readOnly || readOnlyToolbar)
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

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
          '.cm-content': { caretColor: 'var(--foreground)' },
          '.cm-content, .cm-line': { padding: '0' },
          '.cm-line.nesso-markdown-list-item': {
            paddingInlineStart: 'var(--nesso-list-padding)',
            textIndent: 'calc(-1 * var(--nesso-list-indent))',
          },
        }),
        livePreview,
        taskCheckboxes,
        configuration.of([]),
        formattingKeymap,
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
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of(({ docChanged, selectionSet, state, transactions }) => {
          if (docChanged && !transactions.some((t) => t.annotation(externalChange)))
            callbacks.current.onChange(state.doc.toString())
          if (toolbarElement.current && (docChanged || selectionSet))
            setActiveFormats(activeMarkdownFormats(state))
        }),
        EditorView.scrollMargins.of(({ scrollDOM }) => {
          const toolbar = toolbarElement.current
          return toolbar &&
            toolbar.getBoundingClientRect().bottom > scrollDOM.getBoundingClientRect().top
            ? { top: toolbar.offsetHeight }
            : {}
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
    const view = editor.current
    if (!view) return
    view.dispatch({
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
    if (showToolbar) setActiveFormats(activeMarkdownFormats(view.state))
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
    showToolbar,
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
      data-local-history={history ? '' : undefined}
      className={cn(
        'nesso-input nesso-markdown-input nesso-scroll min-h-24 w-full flex-col overflow-y-auto border border-input bg-background px-2.5 py-2 focus-within:border-muted-foreground',
        className,
      )}
    >
      {showToolbar && (
        <div
          ref={toolbarElement}
          className="sticky top-0 z-10 mb-2 flex shrink-0 items-start justify-between gap-2 border-b border-border bg-background pb-1"
        >
          <div role="group" aria-label={toolbar.label} className="flex min-w-0 flex-wrap gap-0.5">
            {formattingActions.map(({ label, format, key, shift, Icon }) => {
              if (format === 'task' && !tasks) return null
              const shortcut = mac
                ? `⌘${shift ? '⇧' : ''}${key.toUpperCase()}`
                : `Ctrl+${shift ? 'Shift+' : ''}${key.toUpperCase()}`
              return (
                <Button
                  key={format}
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    'aria-pressed:bg-accent',
                    compactToolbar
                      ? 'size-6 any-pointer-coarse:size-10 [&_svg]:size-3'
                      : 'pointer-coarse:size-10',
                  )}
                  aria-label={toolbar[label]}
                  aria-keyshortcuts={`${mac ? 'Meta' : 'Control'}+${shift ? 'Shift+' : ''}${key}`}
                  aria-pressed={activeFormats.includes(format)}
                  disabled={readOnly}
                  title={`${toolbar[label]} (${shortcut})`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const view = editor.current
                    if (!view) return
                    view.focus()
                    runFormat(view, format)
                  }}
                >
                  <Icon aria-hidden="true" />
                </Button>
              )
            })}
          </div>
          {toolbarEnd && <div className="flex shrink-0">{toolbarEnd}</div>}
        </div>
      )}
      <div ref={container} className="flex min-h-0 min-w-0 flex-1" />
    </div>
  )
}
