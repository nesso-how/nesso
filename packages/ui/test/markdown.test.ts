import assert from 'node:assert/strict'
import test from 'node:test'
import { EditorSelection, EditorState } from '@codemirror/state'
import {
  activeMarkdownFormats,
  continueMarkdownList,
  indentMarkdownList,
  markdownDecorations,
  markdownTasks,
  toggleMarkdownFormat,
  toggleMarkdownList,
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

test('live preview renders emphasis, inline code and links but leaves code blocks and images literal', () => {
  const source = '**Bold** *italic* ***both*** [Nesso](<https://nesso.how> "Title")'
  const result = preview(source)
  assert.equal(result.text, 'Bold italic both Nesso')
  assert.ok(result.marks.includes('nesso-markdown-bold'))
  assert.ok(result.marks.includes('nesso-markdown-italic'))
  assert.ok(result.marks.includes('nesso-markdown-link'))
  assert.deepEqual(result.links, ['https://nesso.how'])
  const code = preview('`**code**` and `` `a ``')
  assert.equal(code.text, '**code** and `a')
  assert.deepEqual(code.marks, ['nesso-markdown-code', 'nesso-markdown-code'])
  const literal = '```\n- code\n```\n\n![**image**](https://nesso.how/image.png)'
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
  const code = 'Run `npm test` now'
  assert.equal(preview(code, { anchor: 6 }).text, code)
  assert.equal(preview(code, { anchor: 1 }).text, 'Run npm test now')
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
  for (const marker of ['*', '**', '`'] as const) {
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

test('combined emphasis can be toggled independently', () => {
  const bold = EditorState.create({ doc: '**Text**', selection: EditorSelection.range(2, 6) })
  const both = bold.update(toggleMarkdownFormat(bold, '*')!).state
  assert.equal(both.doc.toString(), '***Text***')
  assert.deepEqual(new Set(activeMarkdownFormats(both)), new Set(['*', '**']))
  assert.equal(both.update(toggleMarkdownFormat(both, '*')!).state.doc.toString(), '**Text**')
  assert.equal(both.update(toggleMarkdownFormat(both, '**')!).state.doc.toString(), '*Text*')
})

test('applying emphasis merges the same formatting inside the selection', () => {
  for (const [marker, doc, content] of [
    ['**', '  **One** and ***two*** with `**code**`  ', 'One and *two* with `**code**`'],
    ['*', '  One and _two_ with **three**  ', 'One and two with **three**'],
  ] as const) {
    const state = EditorState.create({ doc, selection: { anchor: doc.length, head: 0 } })
    const formatted = state.update(toggleMarkdownFormat(state, marker)!).state
    const expected = `  ${marker}${content}${marker}  `
    assert.equal(formatted.doc.toString(), expected)
    assert.equal(formatted.selection.main.anchor, expected.length)
    assert.equal(formatted.selection.main.head, 0)
    assert.deepEqual(activeMarkdownFormats(formatted), [marker])
    const cleared = formatted.update(toggleMarkdownFormat(formatted, marker)!).state
    assert.equal(cleared.doc.toString(), `  ${content}  `)
  }
})

test('applying inline code merges contained spans while preserving literal text', () => {
  for (const [doc, merged, unwrapped] of [
    [
      '  One `two` and `three` with **four**  ',
      '  `One two and three with **four**`  ',
      '  One two and three with **four**  ',
    ],
    ['`` `one `` and `two`', '`` `one and two ``', '`one and two'],
    ['One ``a`b`` and `three`', '``One a`b and three``', 'One a`b and three'],
  ]) {
    const state = EditorState.create({ doc, selection: { anchor: doc.length, head: 0 } })
    const formatted = state.update(toggleMarkdownFormat(state, '`')!).state
    assert.equal(formatted.doc.toString(), merged)
    assert.deepEqual(activeMarkdownFormats(formatted), ['`'])
    const cleared = formatted.update(toggleMarkdownFormat(formatted, '`')!).state
    assert.equal(cleared.doc.toString(), unwrapped)
    assert.equal(cleared.selection.main.anchor, unwrapped.length)
    assert.equal(cleared.selection.main.head, 0)
  }
})

test('existing inline formatting is kept when one span would be invalid across Markdown blocks', () => {
  for (const marker of ['**', '`'] as const) {
    const doc = `One ${marker}two${marker}\n\nThree`
    const state = EditorState.create({ doc, selection: { anchor: 0, head: doc.length } })
    assert.equal(toggleMarkdownFormat(state, marker), null)
  }
})

test('inline formatting applies to the whole word under the caret without selecting it', () => {
  const doc = 'Un caffè caldo'
  const anchor = 6
  for (const marker of ['**', '*', '`'] as const) {
    const state = EditorState.create({ doc, selection: { anchor } })
    const formatted = state.update(toggleMarkdownFormat(state, marker)!).state
    assert.equal(formatted.doc.toString(), `Un ${marker}caffè${marker} caldo`)
    assert.ok(formatted.selection.main.empty)
    assert.equal(formatted.selection.main.head, anchor + marker.length)
    assert.ok(activeMarkdownFormats(formatted).includes(marker))
    const restored = formatted.update(toggleMarkdownFormat(formatted, marker)!).state
    assert.equal(restored.doc.toString(), doc)
    assert.equal(restored.selection.main.head, anchor)
  }
})

test('inline formatting does nothing without a selection or a caret inside a word', () => {
  for (const [doc, anchor] of [
    ['Text', 0],
    ['Text', 4],
    ['**Two  words**', 6],
  ] as const) {
    const state = EditorState.create({ doc, selection: { anchor } })
    assert.deepEqual(activeMarkdownFormats(state), [])
    for (const marker of ['**', '*', '`'] as const)
      assert.equal(toggleMarkdownFormat(state, marker), null)
  }
})

test('list toggles format the selected lines without moving the selection past their text', () => {
  const source = 'First\n\nSecond\nOutside'
  const anchor = source.indexOf('Outside')
  for (const [kind, first, second] of [
    ['bullet', '- ', '- '],
    ['numbered', '1. ', '2. '],
    ['task', '- [ ] ', '- [ ] '],
  ] as const) {
    const state = EditorState.create({
      doc: source,
      selection: { anchor, head: 0 },
      extensions: markdownTasks.of(true),
    })
    const listed = state.update(toggleMarkdownList(state, kind)!).state
    assert.equal(listed.doc.toString(), `${first}First\n\n${second}Second\nOutside`)
    assert.deepEqual(activeMarkdownFormats(listed), [kind])
    const restored = listed.update(toggleMarkdownList(listed, kind)!).state
    assert.equal(restored.doc.toString(), source)
    assert.equal(restored.selection.main.anchor, anchor)
    assert.equal(restored.selection.main.head, 0)
  }
})

test('list toggles preserve checked items when filling out a mixed task list', () => {
  const source = '- [X] Parent\n  + Child\n- Last'
  const state = EditorState.create({
    doc: source,
    selection: { anchor: 0, head: source.lastIndexOf('- Last') },
    extensions: markdownTasks.of(true),
  })
  const listed = state.update(toggleMarkdownList(state, 'task')!).state
  assert.equal(listed.doc.toString(), '- [X] Parent\n  - [ ] Child\n- Last')
  const bullets = listed.update(toggleMarkdownList(listed, 'bullet')!).state
  assert.equal(bullets.doc.toString(), '- Parent\n  - Child\n- Last')
})

test('numbering a mixed selection uses a consistent marker and sequence', () => {
  const doc = '1) First\n- Second\nThird'
  const state = EditorState.create({ doc, selection: { anchor: 0, head: doc.length } })
  const listed = state.update(toggleMarkdownList(state, 'numbered')!).state
  assert.equal(listed.doc.toString(), '1. First\n2. Second\n3. Third')
  assert.deepEqual(activeMarkdownFormats(listed), ['numbered'])
})

test('converting nested lists keeps their hierarchy and restarts numbering under each parent', () => {
  const doc = '- Parent\n  - First\n    - Grandchild\n  - Second\n- Next\n  - Child'
  const state = EditorState.create({ doc, selection: { anchor: 0, head: doc.length } })
  const numbered = state.update(toggleMarkdownList(state, 'numbered')!).state
  assert.equal(
    numbered.doc.toString(),
    '1. Parent\n   1. First\n      1. Grandchild\n   2. Second\n2. Next\n   1. Child',
  )
  assert.deepEqual(activeMarkdownFormats(numbered), ['numbered'])
  assert.equal(numbered.update(toggleMarkdownList(numbered, 'bullet')!).state.doc.toString(), doc)
})

test('numbering from mid-list continues the sequence and keeps unselected content nested', () => {
  const doc = '8) First\n9) Second\n   - Child\n- Last\n  -\tUnselected\n    continuation'
  const state = EditorState.create({
    doc,
    selection: { anchor: doc.indexOf('9)'), head: doc.indexOf('\n  -\tUnselected') },
  })
  const numbered = state.update(toggleMarkdownList(state, 'numbered')!).state
  assert.equal(
    numbered.doc.toString(),
    '8) First\n9) Second\n   1. Child\n10) Last\n    - Unselected\n      continuation',
  )
})

test('list toggles respect read-only fields, task settings, and literal Markdown', () => {
  const readOnly = EditorState.create({ extensions: EditorState.readOnly.of(true) })
  assert.equal(toggleMarkdownList(readOnly, 'bullet'), null)
  for (const doc of ['```\n- code\n```', '    - code', '- - -']) {
    const state = EditorState.create({ doc, selection: { anchor: doc.indexOf('-') + 1 } })
    assert.equal(toggleMarkdownList(state, 'bullet'), null)
    assert.deepEqual(activeMarkdownFormats(state), [])
  }
  const state = EditorState.create({ doc: '- [x] Text' })
  assert.equal(toggleMarkdownList(state, 'task'), null)
  assert.equal(state.update(toggleMarkdownList(state, 'bullet')!).state.doc.toString(), '[x] Text')
  const empty = EditorState.create()
  const item = empty.update(toggleMarkdownList(empty, 'bullet')!).state
  assert.equal(item.doc.toString(), '- ')
  assert.equal(item.selection.main.head, 2)
})
