import {
  countColumn,
  EditorSelection,
  Facet,
  type ChangeSpec,
  type EditorState,
  type Line,
  type Range,
  type Text,
} from '@codemirror/state'
import { Decoration, WidgetType, type DecorationSet, type EditorView } from '@codemirror/view'
import { parser, TaskList } from '@lezer/markdown'

type SyntaxNode = ReturnType<ReturnType<typeof parser.parse>['resolveInner']>
type MarkdownRange = { from: number; to: number }
type InlineMarker = '**' | '*' | '`'
type MarkdownList = 'bullet' | 'numbered' | 'task'
type InlineFormat = { marker: InlineMarker; mark: string; decoration: Decoration }

const listPrefix = /^(\s*)([-+*]|(\d{1,9})([.)]))([\t ]+|$)/
const taskPrefix = /^\[[ xX]\]([\t ]+|$)/
const taskParser = parser.configure(TaskList)
const literalBlocks = new Set(['FencedCode', 'CodeBlock', 'HTMLBlock', 'HorizontalRule'])
const inlineFormats: Partial<Record<string, InlineFormat>> = {
  StrongEmphasis: {
    marker: '**',
    mark: 'EmphasisMark',
    decoration: Decoration.mark({ class: 'nesso-markdown-bold' }),
  },
  Emphasis: {
    marker: '*',
    mark: 'EmphasisMark',
    decoration: Decoration.mark({ class: 'nesso-markdown-italic' }),
  },
  InlineCode: {
    marker: '`',
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

const parse = (state: EditorState, doc = state.doc) =>
  (state.facet(markdownTasks) ? taskParser : parser).parse(doc.toString())

function hasCodeSpanPadding(content: string) {
  return /^[ \n]/.test(content) && /[ \n]$/.test(content) && /[^ \n]/.test(content)
}

function markdownInlineBounds(doc: Text, node: SyntaxNode, mark: string) {
  const [open, close] = node.getChildren(mark)
  const padded =
    node.name === 'InlineCode' && hasCodeSpanPadding(doc.sliceString(open.to, close.from))
  return { open, close, from: open.to + Number(padded), to: close.from - Number(padded) }
}

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

      const format = inlineFormats[node.name]
      if (format) {
        const { open, close, from, to } = markdownInlineBounds(state.doc, node.node, format.mark)
        decorations.push(format.decoration.range(from, to))
        syntax(open.from, open.to, active)
        syntax(open.to, from, active)
        syntax(to, close.from, active)
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

function previousListItem(item: SyntaxNode) {
  return item.prevSibling ?? item.parent?.prevSibling?.lastChild
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
    const previous = previousListItem(node)
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

function inlineFormatDelimiters(
  { from, to }: MarkdownRange,
  doc: Text,
  tree: ReturnType<typeof parse>,
  merge?: InlineMarker,
) {
  const enclosing: Partial<Record<InlineMarker, MarkdownRange[]>> = {}
  const contained: MarkdownRange[] = []
  tree.iterate({
    from,
    to,
    enter(node) {
      const format = inlineFormats[node.name]
      if (!format) return
      const { marker, mark } = format
      const bounds = markdownInlineBounds(doc, node.node, mark)
      const { open, close } = bounds
      const delimiters = [
        { from: open.from, to: bounds.from },
        { from: bounds.to, to: close.to },
      ]
      if ((from === node.from && to === node.to) || (from >= open.to && to <= close.from)) {
        enclosing[marker] = delimiters
      } else if (marker === merge && from <= node.from && node.to <= to) {
        contained.push(...delimiters)
      }
    },
  })
  return { enclosing, contained }
}

function inlineFormatTarget(state: EditorState) {
  const selection = state.selection.main
  const { from, to, head } = selection
  if (!selection.empty) {
    const content = state.sliceDoc(from, to)
    const start = to - content.trimStart().length
    const end = from + content.trimEnd().length
    if (start >= end) return null
    const range = { from: start, to: end }
    return { wrap: range, match: range }
  }
  const word = state.wordAt(head)
  return word && word.from < head && head < word.to ? { wrap: word, match: selection } : null
}

function codeSpanDelimiters(
  state: EditorState,
  { from, to }: MarkdownRange,
  contained: MarkdownRange[],
) {
  const removed = state.changes(contained)
  const content = removed.apply(state.doc).sliceString(removed.mapPos(from), removed.mapPos(to))
  let length = 1
  for (const run of content.matchAll(/`+/g)) length = Math.max(length, run[0].length + 1)
  const fence = '`'.repeat(length)
  const padding =
    content.startsWith('`') || content.endsWith('`') || hasCodeSpanPadding(content) ? ' ' : ''
  return { open: fence + padding, close: padding + fence }
}

function wrapInlineFormat(
  state: EditorState,
  range: MarkdownRange,
  marker: InlineMarker,
  contained: MarkdownRange[],
) {
  const { from, to } = range
  const { open, close } =
    marker === '`' ? codeSpanDelimiters(state, range, contained) : { open: marker, close: marker }
  const changes = state.changes([{ from, insert: open }, ...contained, { from: to, insert: close }])
  if (marker === '`' || contained.length) {
    const formatted = { from: changes.mapPos(from, 1), to: changes.mapPos(to, -1) }
    const doc = changes.apply(state.doc)
    if (!inlineFormatDelimiters(formatted, doc, parse(state, doc)).enclosing[marker]) return null
  }
  return changes
}

export function toggleMarkdownFormat(state: EditorState, marker: InlineMarker) {
  if (state.readOnly) return null
  const target = inlineFormatTarget(state)
  if (!target) return null
  const { enclosing, contained } = inlineFormatDelimiters(
    target.match,
    state.doc,
    parse(state),
    marker,
  )
  const delimiters = enclosing[marker]
  const changes = delimiters
    ? state.changes(delimiters)
    : wrapInlineFormat(state, target.wrap, marker, contained)
  if (!changes) return null
  return {
    changes,
    selection: state.selection.map(changes),
    userEvent: 'input.format',
  }
}

function markdownListLine(line: Line, tree: ReturnType<typeof parse>, tasks: boolean) {
  const indent = line.text.match(/^[\t ]*/)![0]
  const from = line.from + indent.length
  const token = tree.resolveInner(from, 1)
  for (let node: SyntaxNode | null = token; node; node = node.parent) {
    if (literalBlocks.has(node.name)) return null
  }
  const prefix = token.name === 'ListMark' && line.text.match(listPrefix)
  if (!prefix) return { from, to: from, indent, token }
  const taskLength = tasks
    ? (line.text.slice(prefix[0].length).match(taskPrefix)?.[0].length ?? 0)
    : 0
  const kind: MarkdownList = taskLength ? 'task' : prefix[3] ? 'numbered' : 'bullet'
  return { from, to: line.from + prefix[0].length + taskLength, indent, token, prefix, kind }
}

function markdownListLines(state: EditorState, tree: ReturnType<typeof parse>) {
  const { from, to } = state.selection.main
  const first = state.doc.lineAt(from)
  const last = state.doc.lineAt(to > from ? to - 1 : to)
  const tasks = state.facet(markdownTasks)
  const lines = []
  for (let number = first.number; number <= last.number; number++) {
    const line = state.doc.line(number)
    if (first.number !== last.number && !line.text.trim()) continue
    const item = markdownListLine(line, tree, tasks)
    if (item) lines.push({ ...item, line })
  }
  return lines
}

function activeListKind(lines: ReturnType<typeof markdownListLines>) {
  const kind = lines[0]?.kind
  return kind && lines.every((line) => line.kind === kind) ? kind : undefined
}

export function activeMarkdownFormats(state: EditorState): (InlineMarker | MarkdownList)[] {
  const tree = parse(state)
  const target = inlineFormatTarget(state)
  const formats = target
    ? (Object.keys(
        inlineFormatDelimiters(target.match, state.doc, tree).enclosing,
      ) as InlineMarker[])
    : []
  const kind = activeListKind(markdownListLines(state, tree))
  return kind ? [...formats, kind] : formats
}

type ListLine = ReturnType<typeof markdownListLines>[number]
type ListShift = { start: number; end: number; column: number; offset: number }

function listContentColumn(line: Line, prefix: RegExpMatchArray) {
  const markerEnd = countColumn(prefix[1], 4) + prefix[2].length
  const content = countColumn(prefix[0], 4)
  return content - markerEnd >= 5 || prefix[0].length === line.length ? markerEnd + 1 : content
}

function listScope(doc: Text, { token, prefix, indent }: ListLine) {
  let node = prefix ? token.parent?.parent?.parent : token.parent
  const column = countColumn(indent, 4)
  for (; node; node = node.parent) {
    if (node.name !== 'ListItem') continue
    const line = doc.lineAt(node.from)
    const marker = line.text.match(listPrefix)
    if (!marker || column >= listContentColumn(line, marker)) return node.from
  }
  return -1
}

function initialListNumber(doc: Text, { token, prefix }: ListLine) {
  const previous = prefix ? previousListItem(token.parent!) : null
  if (previous?.name === 'ListItem') {
    const prior = doc.lineAt(previous.from).text.match(listPrefix)
    if (prior?.[3]) return { next: Number(prior[3]) + 1, separator: prior[4] }
  }
  return { next: Number(prefix?.[3] ?? 1), separator: '.' }
}

function listNumbering(doc: Text) {
  const siblings = new Map<number, ReturnType<typeof initialListNumber>>()
  return (line: ListLine) => {
    const scope = listScope(doc, line)
    const sequence = siblings.get(scope) ?? initialListNumber(doc, line)
    const { next, separator } = sequence
    sequence.next++
    siblings.set(scope, sequence)
    return next <= 999999999 ? `${next}${separator} ` : null
  }
}

function listBodyShift(doc: Text, { line, prefix, indent, token }: ListLine, width: number) {
  if (!prefix) return null
  const column = listContentColumn(line, prefix)
  const offset = countColumn(indent, 4) + width - column
  const end = doc.lineAt(token.parent!.to).number
  return offset && end > line.number ? { start: line.number + 1, end, column, offset } : null
}

function shiftListLine(
  line: Line,
  tree: ReturnType<typeof parse>,
  parents: ListShift[],
  markerChanged: boolean,
) {
  const indent = line.text.match(/^[\t ]*/)![0]
  const column = countColumn(indent, 4)
  const offset = parents.reduce(
    (total, parent) => total + (column >= parent.column ? parent.offset : 0),
    0,
  )
  if (!offset || indent.length === line.length) return []
  const from = line.from + indent.length
  const edits = [{ from: line.from, to: from, insert: ' '.repeat(column + offset) }]
  const prefix = !markerChanged && line.text.match(listPrefix)
  if (prefix && prefix[5].includes('\t') && tree.resolveInner(from, 1).name === 'ListMark') {
    const markerEnd = column + prefix[2].length
    edits.push({
      from: from + prefix[2].length,
      to: line.from + prefix[0].length,
      insert: ' '.repeat(countColumn(prefix[0], 4) - markerEnd),
    })
  }
  return edits
}

function listBodyEdits(
  doc: Text,
  tree: ReturnType<typeof parse>,
  shifts: ListShift[],
  changedMarkers: Map<number, ChangeSpec>,
) {
  if (!shifts.length) return []
  const edits: ChangeSpec[] = []
  const parents: ListShift[] = []
  const last = shifts.reduce((end, shift) => Math.max(end, shift.end), 0)
  let index = 0
  for (let number = shifts[0].start; number <= last; number++) {
    while (parents.length && parents.at(-1)!.end < number) parents.pop()
    if (shifts[index]?.start === number) parents.push(shifts[index++])
    if (parents.length)
      edits.push(...shiftListLine(doc.line(number), tree, parents, changedMarkers.has(number)))
  }
  return edits
}

export function toggleMarkdownList(state: EditorState, kind: MarkdownList) {
  if (state.readOnly || (kind === 'task' && !state.facet(markdownTasks))) return null
  const { doc } = state
  const tree = parse(state)
  const lines = markdownListLines(state, tree)
  if (!lines.length) return null
  const remove = activeListKind(lines) === kind
  const numberMarker = listNumbering(doc)
  const markers = new Map<number, ChangeSpec>()
  const shifts: ListShift[] = []
  for (const target of lines) {
    if (!remove && kind !== 'numbered' && target.kind === kind) continue
    const marker = remove ? '' : kind === 'numbered' ? numberMarker(target) : '- '
    if (marker === null) return null
    const { from, to, line } = target
    markers.set(line.number, {
      from,
      to,
      insert: marker + (kind === 'task' && !remove ? '[ ] ' : ''),
    })
    const shift = listBodyShift(doc, target, marker.length)
    if (shift) shifts.push(shift)
  }
  const changes = state.changes([...listBodyEdits(doc, tree, shifts, markers), ...markers.values()])
  return { changes, selection: state.selection.map(changes, 1), userEvent: 'input.format' }
}
