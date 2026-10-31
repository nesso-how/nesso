import { EditorSelection, type EditorState, type Range } from '@codemirror/state'
import { Decoration, WidgetType, type DecorationSet, type EditorView } from '@codemirror/view'
import { parser } from '@lezer/markdown'

const listPrefix = /^(\s*)([-+*]|(\d{1,9})([.)]))([\t ]+|$)/

class ListMarker extends WidgetType {
  readonly label: string

  constructor(label: string) {
    super()
    this.label = label
  }

  eq(other: ListMarker) {
    return this.label === other.label
  }

  toDOM(view: EditorView) {
    const marker = view.dom.ownerDocument.createElement('span')
    marker.className = 'nesso-markdown-list-marker'
    marker.textContent = this.label
    return marker
  }

  ignoreEvent() {
    return false
  }
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

  parser.parse(source).iterate({
    enter(node) {
      if (['Image', 'InlineCode', 'FencedCode', 'CodeBlock', 'HTMLBlock'].includes(node.name))
        return false
      const active =
        focused &&
        state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)

      if (node.name === 'ListItem') {
        const marker = node.node.getChild('ListMark')!
        const line = state.doc.lineAt(marker.from)
        const end = marker.to + (source.slice(marker.to, line.to).match(/^[\t ]*/)?.[0].length ?? 0)
        const label =
          node.node.parent?.name === 'BulletList' ? '•' : source.slice(marker.from, marker.to)
        const width = Math.max(3, end - marker.from)
        decorations.push(
          Decoration.line({
            class: 'nesso-markdown-list-item',
            attributes: {
              style: `--nesso-list-indent: ${width}ch; --nesso-list-padding: ${marker.from - line.from + width}ch`,
            },
          }).range(line.from),
          (active
            ? Decoration.mark({ class: 'nesso-markdown-syntax nesso-markdown-list-marker' })
            : Decoration.replace({ widget: new ListMarker(`${label} `) })
          ).range(marker.from, end),
        )
      }

      if (node.name === 'StrongEmphasis' || node.name === 'Emphasis') {
        const [open, close] = node.node.getChildren('EmphasisMark')
        decorations.push(
          Decoration.mark({
            class: node.name === 'StrongEmphasis' ? 'nesso-markdown-bold' : 'nesso-markdown-italic',
          }).range(open.to, close.from),
        )
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
  let node = parser.parse(state.doc.toString()).resolveInner(from, -1)
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
  if (from < firstLine.from + prefix[0].length) return null
  let insert = nextListPrefix(prefix)
  if (
    state.doc.lineAt(from).from === firstLine.from &&
    !firstLine.text.slice(prefix[0].length).trim()
  ) {
    const parent = node.parent?.parent
    const parentPrefix =
      parent?.name === 'ListItem' ? state.doc.lineAt(parent.from).text.match(listPrefix) : null
    insert = parentPrefix ? nextListPrefix(parentPrefix) : ''
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

export function toggleMarkdownFormat(state: EditorState, marker: '*' | '**') {
  if (state.readOnly) return null
  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)
  let delimiters: { from: number; to: number }[] | undefined
  parser.parse(state.doc.toString()).iterate({
    enter(node) {
      if (node.name !== (marker === '**' ? 'StrongEmphasis' : 'Emphasis')) return
      const [open, close] = node.node.getChildren('EmphasisMark')
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
