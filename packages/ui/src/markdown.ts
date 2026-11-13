import { EditorSelection, Facet, type EditorState, type Range } from '@codemirror/state'
import { Decoration, WidgetType, type DecorationSet, type EditorView } from '@codemirror/view'
import { parser, TaskList } from '@lezer/markdown'

type SyntaxNode = ReturnType<ReturnType<typeof parser.parse>['resolveInner']>

const listPrefix = /^(\s*)([-+*]|(\d{1,9})([.)]))([\t ]+|$)/
const taskPrefix = /^\[[ xX]\]([\t ]+|$)/
const taskParser = parser.configure(TaskList)
const formats = {
  '**': {
    node: 'StrongEmphasis',
    mark: 'EmphasisMark',
    decoration: Decoration.mark({ class: 'nesso-markdown-bold' }),
  },
  '*': {
    node: 'Emphasis',
    mark: 'EmphasisMark',
    decoration: Decoration.mark({ class: 'nesso-markdown-italic' }),
  },
  '`': {
    node: 'InlineCode',
    mark: 'CodeMark',
    decoration: Decoration.mark({
      class: 'nesso-markdown-code',
      attributes: { spellcheck: 'false' },
    }),
  },
}

export const markdownTasks = Facet.define<boolean | undefined, boolean>({
  combine: (values) => values.some(Boolean),
})

const parse = (state: EditorState) =>
  (state.facet(markdownTasks) ? taskParser : parser).parse(state.doc.toString())

class ListMarker extends WidgetType {
  readonly label: string
  readonly checked: boolean | null

  constructor(label: string, checked: boolean | null = null) {
    super()
    this.label = label
    this.checked = checked
  }

  eq(other: ListMarker) {
    return this.label === other.label && this.checked === other.checked
  }

  toDOM(view: EditorView) {
    const document = view.dom.ownerDocument
    const marker = document.createElement('span')
    marker.className = 'nesso-markdown-list-marker'
    marker.textContent = this.label
    if (this.label === '• ') {
      const bullet = document.createElement('span')
      bullet.className = 'nesso-markdown-bullet'
      bullet.textContent = '•'
      marker.replaceChildren(bullet, document.createTextNode(' '))
    }
    if (this.checked !== null) {
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'nesso-markdown-task'
      checkbox.checked = this.checked
      checkbox.tabIndex = -1
      marker.append(checkbox)
    }
    return marker
  }

  ignoreEvent() {
    return false
  }
}

function markerWidth(item: SyntaxNode) {
  const marker = item.getChild('ListMark')!
  const task = item.getChild('Task') ? 1.4 : 0
  return item.parent?.name === 'BulletList'
    ? { ch: 0, em: task || 1 }
    : { ch: marker.to - marker.from - 1, em: 0.75 + task }
}

function markerLabel(state: EditorState, item: SyntaxNode, checked: boolean | null) {
  if (item.parent?.name !== 'BulletList') {
    const marker = item.getChild('ListMark')!
    return `${state.sliceDoc(marker.from, marker.to)} `
  }
  return checked === null ? '• ' : ''
}

function listPadding(item: SyntaxNode) {
  const padding = { ch: 0, em: 0 }
  for (let node: SyntaxNode | null = item; node; node = node.parent) {
    if (node.name !== 'ListItem') continue
    const width = markerWidth(node)
    padding.ch += width.ch
    padding.em += width.em
  }
  return padding
}

function listItemDecorations(state: EditorState, item: SyntaxNode, active: boolean) {
  const marker = item.getChild('ListMark')!
  const task = item.getChild('Task')
  const taskMarker = task?.getChild('TaskMarker')
  const checked = taskMarker
    ? state.sliceDoc(taskMarker.from + 1, taskMarker.from + 2) !== ' '
    : null
  const line = state.doc.lineAt(marker.from)
  const from = /^[\t ]*$/.test(state.sliceDoc(line.from, marker.from)) ? line.from : marker.from
  const start = taskMarker?.to ?? marker.to
  const end = start + state.sliceDoc(start, line.to).match(/^[\t ]*/)![0].length
  const label = markerLabel(state, item, checked)
  const width = markerWidth(item)
  const padding = listPadding(item)
  const decorations = [
    Decoration.line({
      class: 'nesso-markdown-list-item',
      attributes: {
        style: `--nesso-list-indent: calc(${width.ch}ch + ${width.em}em); --nesso-list-padding: calc(var(--nesso-list-inset) + ${padding.ch}ch + ${padding.em}em)`,
      },
    }).range(line.from),
    (active
      ? Decoration.mark({ class: 'nesso-markdown-syntax nesso-markdown-list-marker' })
      : Decoration.replace({ widget: new ListMarker(label, checked) })
    ).range(from, end),
  ]
  if (checked && task && end < task.to)
    decorations.push(Decoration.mark({ class: 'nesso-markdown-task-done' }).range(end, task.to))
  return decorations
}

export function markdownDecorations(state: EditorState, focused: boolean): DecorationSet {
  const source = state.doc.toString()
  const decorations: Range<Decoration>[] = []
  const syntax = (from: number, to: number, active: boolean) => {
    if (from >= to || source.slice(from, to).includes('\n')) return
    const decoration = active
      ? Decoration.mark({ class: 'nesso-markdown-syntax' })
      : Decoration.replace({})
    decorations.push(decoration.range(from, to))
  }

  parse(state).iterate({
    enter(node) {
      if (['Image', 'FencedCode', 'CodeBlock', 'HTMLBlock'].includes(node.name)) return false
      const active =
        focused &&
        state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)

      if (node.name === 'ListItem')
        decorations.push(...listItemDecorations(state, node.node, active))

      const format = Object.values(formats).find((format) => format.node === node.name)
      if (format) {
        const [open, close] = node.node.getChildren(format.mark)
        decorations.push(format.decoration.range(open.to, close.from))
        syntax(open.from, open.to, active)
        syntax(close.from, close.to, active)
      }

      if (node.name === 'Link') {
        const url = node.node.getChild('URL')
        if (!url) return
        const [open, close] = node.node.getChildren('LinkMark')
        decorations.push(
          Decoration.mark({
            class: 'nesso-markdown-link',
            attributes: {
              'data-markdown-link': source.slice(url.from, url.to).replace(/^<|>$/g, ''),
            },
          }).range(open.to, close.from),
        )
        syntax(open.from, open.to, active)
        syntax(close.from, node.to, active)
      }
    },
  })

  return Decoration.set(decorations, true)
}

function markdownListItem(state: EditorState) {
  if (state.readOnly || state.selection.ranges.length !== 1) return null
  const { from, to } = state.selection.main
  const line = state.doc.lineAt(from)
  if (to > line.to) return null
  let node = parse(state).resolveInner(from, -1)
  while (node.name !== 'ListItem') {
    if (['FencedCode', 'CodeBlock', 'HTMLBlock'].includes(node.name) || !node.parent) return null
    node = node.parent
  }
  const firstLine = state.doc.lineAt(node.from)
  const prefix = firstLine.text.match(listPrefix)
  if (!prefix || to > node.to) return null
  return { node, firstLine, prefix }
}

function nextListPrefix(prefix: RegExpMatchArray) {
  const number = prefix[3] ? Number(prefix[3]) + 1 : null
  if (number !== null && number > 999999999) return null
  const marker = number === null ? prefix[2] : `${number}${prefix[4]}`
  return `${prefix[1]}${marker}${prefix[5] || ' '}`
}

export function indentMarkdownList(state: EditorState, outdent = false) {
  const item = markdownListItem(state)
  if (!item) return null
  const { node, firstLine, prefix } = item
  const parent = node.parent?.parent
  let indentation = ''
  if (outdent) {
    if (!prefix[1]) return {}
    if (parent?.name === 'ListItem') {
      const parentPrefix = state.doc.lineAt(parent.from).text.match(listPrefix)
      if (!parentPrefix) return {}
      indentation = parentPrefix[1]
    }
  } else {
    const previous = node.prevSibling ?? node.parent?.prevSibling?.lastChild
    if (previous?.name !== 'ListItem') return {}
    const previousPrefix = state.doc.lineAt(previous.from).text.match(listPrefix)
    if (!previousPrefix) return {}
    indentation =
      previousPrefix[1] + ' '.repeat(previousPrefix[0].length - previousPrefix[1].length)
  }
  const difference = indentation.length - prefix[1].length
  if (difference === 0) return {}
  const edits = []
  for (let number = firstLine.number; number <= state.doc.lineAt(node.to).number; number++) {
    const line = state.doc.line(number)
    if (!line.text) continue
    edits.push({
      from: line.from,
      to:
        line.from +
        (difference < 0 ? Math.min(-difference, line.text.match(/^\s*/)![0].length) : 0),
      insert: difference > 0 ? ' '.repeat(difference) : '',
    })
  }
  const changes = state.changes(edits)
  return { changes, selection: state.selection.map(changes, 1), userEvent: 'input.indent' }
}

export function continueMarkdownList(state: EditorState) {
  const item = markdownListItem(state)
  if (!item) return null
  const { node, firstLine, prefix } = item
  let { from, to } = state.selection.main
  const task = state.facet(markdownTasks)
    ? (firstLine.text.slice(prefix[0].length).match(taskPrefix)?.[0] ?? '')
    : ''
  if (from < firstLine.from + prefix[0].length + task.length) return null
  const next = (prefix: RegExpMatchArray) => {
    const marker = nextListPrefix(prefix)
    return marker === null ? null : marker + (task && '[ ] ')
  }
  let insert = next(prefix)
  if (
    state.doc.lineAt(from).from === firstLine.from &&
    !firstLine.text.slice(prefix[0].length + task.length).trim()
  ) {
    const parent = node.parent?.parent
    const parentPrefix =
      parent?.name === 'ListItem' ? state.doc.lineAt(parent.from).text.match(listPrefix) : null
    insert = parentPrefix ? next(parentPrefix) : ''
    from = firstLine.from
    to = firstLine.to
  } else if (insert !== null) insert = `\n${insert}`
  if (insert === null) return null
  return {
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + insert.length),
    userEvent: 'input',
  }
}

export function toggleMarkdownTask(state: EditorState, position: number) {
  if (state.readOnly || !state.facet(markdownTasks)) return null
  const marker = parse(state)
    .resolveInner(position, 1)
    .parent?.getChild('Task')
    ?.getChild('TaskMarker')
  if (!marker) return null
  const from = marker.from + 1
  return {
    changes: { from, to: from + 1, insert: state.sliceDoc(from, from + 1) === ' ' ? 'x' : ' ' },
    userEvent: 'input.toggle',
  }
}

export function toggleMarkdownFormat(state: EditorState, marker: keyof typeof formats) {
  if (state.readOnly) return null
  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)
  const format = formats[marker]
  let delimiters: { from: number; to: number }[] | undefined
  parse(state).iterate({
    enter(node) {
      if (node.name !== format.node) return
      const [open, close] = node.node.getChildren(format.mark)
      if ((from === node.from && to === node.to) || (from >= open.to && to <= close.from))
        delimiters = [open, close].map(({ from, to }) => ({ from, to }))
    },
  })
  if (delimiters) {
    const changes = state.changes(delimiters)
    return {
      changes,
      selection: state.selection.map(changes),
      userEvent: 'input.format',
    }
  }
  return {
    changes: { from, to, insert: `${marker}${selected}${marker}` },
    selection: EditorSelection.range(from + marker.length, to + marker.length),
    userEvent: 'input.format',
  }
}
