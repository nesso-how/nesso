import assert from 'node:assert/strict'
import test from 'node:test'
import { EditorSelection, EditorState } from '@codemirror/state'
import {
  continueMarkdownList,
  indentMarkdownList,
  markdownDecorations,
  markdownTasks,
  toggleMarkdownFormat,
  toggleMarkdownTask,
} from '../src/markdown.ts'

function preview(source: string, selection?: { anchor: number; head?: number }, tasks = false) {
  const state = EditorState.create({ doc: source, selection, extensions: markdownTasks.of(tasks) })
  const hidden: { from: number; to: number; label: string }[] = []
  const marks: string[] = []
  const links: string[] = []
  markdownDecorations(state, selection !== undefined).between(
    0,
    source.length,
    (from, to, value) => {
      if (value.spec.attributes?.['data-markdown-link'])
        links.push(value.spec.attributes['data-markdown-link'])
      if (value.spec.class) marks.push(value.spec.class)
      else {
        const widget = value.spec.widget
        const box = widget?.checked == null ? '' : widget.checked ? '☑ ' : '☐ '
        hidden.push({ from, to, label: (widget?.label ?? '') + box })
      }
    },
  )
  let text = source
  for (const { from, to, label } of hidden.sort((a, b) => b.from - a.from))
    text = text.slice(0, from) + label + text.slice(to)
  return { text, marks, links }
}

test('live preview renders emphasis and links but leaves code and images literal', () => {
  const source = '**Bold** *italic* ***both*** [Nesso](<https://nesso.how> "Title")'
  const result = preview(source)
  assert.equal(result.text, 'Bold italic both Nesso')
  assert.ok(result.marks.includes('nesso-markdown-bold'))
  assert.ok(result.marks.includes('nesso-markdown-italic'))
  assert.ok(result.marks.includes('nesso-markdown-link'))
  assert.deepEqual(result.links, ['https://nesso.how'])
  const literal = '`**code**`\n\n```\n- code\n```\n\n![**image**](https://nesso.how/image.png)'
  assert.equal(preview(literal).text, literal)
})

test('cursor and selections reveal only the Markdown they touch', () => {
  const source = '**Bold** and *italic*'
  assert.equal(preview(source, { anchor: 4 }).text, '**Bold** and italic')
  assert.equal(preview(source, { anchor: 17 }).text, 'Bold and *italic*')
  assert.equal(preview(source, { anchor: 10 }).text, 'Bold and italic')
  assert.equal(preview(source, { anchor: 3, head: 17 }).text, source)
  const link = '[**Nesso**](<https://nesso.how> "Title")'
  assert.equal(preview(link, { anchor: 5 }).text, link)
})

test('lists render inline formatting and reveal markers in active items', () => {
  const source = '- **Bold**\n  - *italic*\n\n3) [Nesso](https://nesso.how)\n4) Next'
  const result = preview(source)
  assert.equal(result.text, '• Bold\n• italic\n\n3) Nesso\n4) Next')
  assert.equal(result.marks.filter((mark) => mark === 'nesso-markdown-list-item').length, 4)
  const items = '- First\n+ Second'
  assert.equal(preview(items, { anchor: 4 }).text, '- First\n• Second')
  assert.equal(preview(items, { anchor: 3, head: 13 }).text, items)
})

test('task lists render checkboxes only when enabled', () => {
  const source = '- [ ] Open\n- [x] Done\n1. [X] Numbered'
  assert.equal(preview(source).text, '• [ ] Open\n• [x] Done\n1. [X] Numbered')
  const result = preview(source, undefined, true)
  assert.equal(result.text, '☐ Open\n☑ Done\n1. ☑ Numbered')
  assert.equal(result.marks.filter((mark) => mark === 'nesso-markdown-task-done').length, 2)
  assert.equal(preview(source, { anchor: 3 }, true).text, '- [ ] Open\n☑ Done\n1. ☑ Numbered')
})

test('task toggles flip the item marker and respect read-only and disabled fields', () => {
  const source = '- [ ] Open\n  - [x] Nested\n- Plain'
  const state = EditorState.create({ doc: source, extensions: markdownTasks.of(true) })
  const toggle = (position: number) => state.update(toggleMarkdownTask(state, position)!).state
  assert.equal(toggle(0).doc.toString(), '- [x] Open\n  - [x] Nested\n- Plain')
  assert.equal(toggle(13).doc.toString(), '- [ ] Open\n  - [ ] Nested\n- Plain')
  assert.equal(toggleMarkdownTask(state, source.indexOf('- Plain')), null)
  assert.equal(toggleMarkdownTask(EditorState.create({ doc: source }), 0), null)
  const readonly = EditorState.create({
    doc: source,
    extensions: [markdownTasks.of(true), EditorState.readOnly.of(true)],
  })
  assert.equal(toggleMarkdownTask(readonly, 0), null)
})

test('Enter continues task lists with unchecked items and exits empty ones', () => {
  for (const [source, anchor, expected] of [
    ['- [x] Done', 10, '- [x] Done\n- [ ] '],
    ['2. [ ] Next', 11, '2. [ ] Next\n3. [ ] '],
    ['- [ ] Open\n- [ ] ', 17, '- [ ] Open\n'],
    ['- Parent\n  - [ ] ', 17, '- Parent\n- [ ] '],
  ] as const) {
    const state = EditorState.create({
      doc: source,
      selection: { anchor },
      extensions: markdownTasks.of(true),
    })
    const next = state.update(continueMarkdownList(state)!).state
    assert.equal(next.doc.toString(), expected)
    assert.equal(next.selection.main.head, anchor + expected.length - source.length)
  }
  const inside = EditorState.create({
    doc: '- [ ] Open',
    selection: { anchor: 3 },
    extensions: markdownTasks.of(true),
  })
  assert.equal(continueMarkdownList(inside), null)
  const disabled = EditorState.create({ doc: '- [ ] Open', selection: { anchor: 10 } })
  assert.equal(
    disabled.update(continueMarkdownList(disabled)!).state.doc.toString(),
    '- [ ] Open\n- ',
  )
})

test('Enter continues or splits lists, promotes empty nested items and exits empty top-level items', () => {
  for (const [source, anchor, head, expected] of [
    ['- First', 7, 7, '- First\n- '],
    ['9. First', 8, 8, '9. First\n10. '],
    ['3) First', 8, 8, '3) First\n4) '],
    ['- First second', 7, 8, '- First\n- second'],
    ['  - First', 9, 9, '  - First\n  - '],
    ['- First\n  continued', 19, 19, '- First\n  continued\n- '],
    ['1. First\n2. Next', 8, 8, '1. First\n2. \n2. Next'],
    ['- First\n- ', 10, 10, '- First\n'],
    ['- Parent\n  - ', 13, 13, '- Parent\n- '],
    ['10. Parent\n    1. ', 18, 18, '10. Parent\n11. '],
  ] as const) {
    const state = EditorState.create({ doc: source, selection: { anchor, head } })
    const transaction = continueMarkdownList(state)
    assert.ok(transaction, source)
    const next = state.update(transaction).state
    assert.equal(next.doc.toString(), expected)
    assert.equal(next.selection.main.head, head + expected.length - source.length)
  }
})

test('list indentation moves children together and handles repeated shortcuts at level boundaries', () => {
  for (const [source, anchor, expected] of [
    [
      '- Parent\n- Child\n  continued\n  - Grandchild\n- Next',
      12,
      '- Parent\n  - Child\n    continued\n    - Grandchild\n- Next',
    ],
    ['10. Parent\n11. Child', 20, '10. Parent\n    11. Child'],
    ['1. Parent\n- Child', 17, '1. Parent\n   - Child'],
    ['- First', 7, '- First'],
  ] as const) {
    const state = EditorState.create({ doc: source, selection: { anchor } })
    const transaction = indentMarkdownList(state)
    assert.ok(transaction)
    const nested = state.update(transaction).state
    assert.equal(nested.doc.toString(), expected)
    const repeatedIndent = indentMarkdownList(nested)
    assert.ok(repeatedIndent)
    assert.equal(nested.update(repeatedIndent).docChanged, false)
    const restored = nested.update(indentMarkdownList(nested, true)!).state
    assert.equal(restored.doc.toString(), source)
    assert.equal(restored.selection.main.head, anchor)
    const repeatedOutdent = indentMarkdownList(restored, true)
    assert.ok(repeatedOutdent)
    assert.equal(restored.update(repeatedOutdent).docChanged, false)
  }
})

test('list shortcuts leave ordinary text, code, read-only fields and cross-line selections alone', () => {
  for (const command of [continueMarkdownList, indentMarkdownList]) {
    for (const source of ['Text', '```\n- code\n```']) {
      const anchor = source.includes('code') ? source.indexOf('code') + 4 : source.length
      assert.equal(command(EditorState.create({ doc: source, selection: { anchor } })), null)
    }
    const readonly = EditorState.create({
      doc: '- Item',
      extensions: EditorState.readOnly.of(true),
    })
    assert.equal(command(readonly), null)
    const selected = EditorState.create({
      doc: '- First\n- Second',
      selection: { anchor: 3, head: 12 },
    })
    assert.equal(command(selected), null)
  }
})

test('formatting shortcuts wrap selections and remove selected or surrounding delimiters', () => {
  for (const marker of ['*', '**'] as const) {
    const plain = EditorState.create({ doc: 'Text', selection: EditorSelection.range(0, 4) })
    const wrapped = plain.update(toggleMarkdownFormat(plain, marker)!).state
    assert.equal(wrapped.doc.toString(), `${marker}Text${marker}`)
    assert.equal(wrapped.sliceDoc(wrapped.selection.main.from, wrapped.selection.main.to), 'Text')
    assert.equal(
      wrapped.update(toggleMarkdownFormat(wrapped, marker)!).state.doc.toString(),
      'Text',
    )
    const selected = wrapped.update({
      selection: EditorSelection.range(0, wrapped.doc.length),
    }).state
    assert.equal(
      selected.update(toggleMarkdownFormat(selected, marker)!).state.doc.toString(),
      'Text',
    )
  }
  const readonly = EditorState.create({ extensions: EditorState.readOnly.of(true) })
  assert.equal(toggleMarkdownFormat(readonly, '**'), null)
})

test('formatting shortcuts preserve the other emphasis style and work at the cursor', () => {
  const bold = EditorState.create({ doc: '**Text**', selection: EditorSelection.range(2, 6) })
  const both = bold.update(toggleMarkdownFormat(bold, '*')!).state
  assert.equal(both.doc.toString(), '***Text***')
  assert.equal(both.update(toggleMarkdownFormat(both, '*')!).state.doc.toString(), '**Text**')
  assert.equal(both.update(toggleMarkdownFormat(both, '**')!).state.doc.toString(), '*Text*')
  const cursor = bold.update({ selection: { anchor: 4 } }).state
  assert.equal(cursor.update(toggleMarkdownFormat(cursor, '**')!).state.doc.toString(), 'Text')
})
